/**
 * CloudVault - Serviço de sincronização bidirecional
 * Sincroniza pasta local com o armazenamento em nuvem (estilo Google Drive)
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos
const DEBOUNCE_MS = 2000; // 2 segundos para agrupar mudanças locais

let watcher = null;
let pollTimer = null;
let mainWindow = null;
let syncState = {
  active: false,
  folderPath: null,
  token: null,
  apiBase: null,
  status: 'idle', // idle | syncing | error
  lastSync: null,
  error: null,
  progress: { current: 0, total: 0, phase: '' }
};

function emit(event, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-event', event, data);
  }
}

function setStatus(status, error = null) {
  syncState.status = status;
  syncState.error = error;
  syncState.lastSync = status === 'idle' ? new Date().toISOString() : syncState.lastSync;
  emit('status', { status, error, lastSync: syncState.lastSync });
}

function setProgress(current, total, phase) {
  syncState.progress = { current, total, phase };
  emit('progress', syncState.progress);
}

function apiRequest(apiBase, token, method, urlPath, body = null, isBinary = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiBase + urlPath);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` })
      }
    };
    if (body && !isBinary) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    const req = lib.request(options, (res) => {
      let data = '';
      const chunks = [];
      res.on('data', (chunk) => {
        if (isBinary) chunks.push(chunk);
        else data += chunk.toString();
      });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`API ${res.statusCode}: ${data || res.statusMessage}`));
          return;
        }
        if (isBinary) {
          resolve(Buffer.concat(chunks));
        } else {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch {
            resolve(data);
          }
        }
      });
    });
    req.on('error', reject);
    if (body) {
      if (isBinary) req.write(body);
      else req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function getFoldersRecursive(apiBase, token, parentId = null, acc = []) {
  const folders = await apiRequest(apiBase, token, 'GET', `/folders${parentId ? `?parent_id=${parentId}` : ''}`);
  const list = Array.isArray(folders) ? folders : (folders.data ?? folders.folders ?? folders.items ?? []);
  for (const f of list) {
    const folder = { id: f.id, name: f.name || f.folder_name, parent_id: f.parent_id };
    acc.push(folder);
    await getFoldersRecursive(apiBase, token, folder.id, acc);
  }
  return acc;
}

async function getFilesInFolder(apiBase, token, folderId) {
  const res = await apiRequest(apiBase, token, 'GET', `/files?folder_id=${folderId}`);
  return Array.isArray(res) ? res : (res.data ?? res.files ?? res.items ?? []);
}

function downloadFromUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (r) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve(Buffer.concat(chunks)));
      r.on('error', reject);
    }).on('error', reject);
  });
}

function apiRequestWithResponse(apiBase, token, method, urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiBase + urlPath);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: { Authorization: `Bearer ${token}` }
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({ statusCode: res.statusCode, headers: res.headers, body });
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function downloadFileToBuffer(apiBase, token, fileId) {
  const { statusCode, headers, body } = await apiRequestWithResponse(apiBase, token, 'GET', `/files/${fileId}/download`);
  if (statusCode >= 400) throw new Error(`Download falhou: ${statusCode}`);
  const ct = (headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/json')) {
    const json = JSON.parse(body.toString());
    const url = json.url || json.signed_url || json.download_url || json.preview_url;
    if (url) return downloadFromUrl(url);
  }
  return body;
}

async function downloadFile(apiBase, token, file, localPath) {
  const buffer = await downloadFileToBuffer(apiBase, token, file.id);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, buffer);
}

async function getUploadUrl(apiBase, token, fileName, mimeType, folderId) {
  const body = { file_name: fileName, mime_type: mimeType || 'application/octet-stream' };
  if (folderId) body.folder_id = folderId;
  const res = await apiRequest(apiBase, token, 'POST', '/files/upload-url', body);
  return res.upload_url && res.storage_path ? res : null;
}

async function uploadFileToUrl(uploadUrl, filePath, mimeType) {
  const content = fs.readFileSync(filePath);
  return new Promise((resolve, reject) => {
    const u = new URL(uploadUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const options = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'PUT',
      headers: { 'Content-Type': mimeType || 'application/octet-stream' }
    };
    const req = lib.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) resolve();
      else reject(new Error(`Upload falhou: ${res.statusCode}`));
    });
    req.on('error', reject);
    req.write(content);
    req.end();
  });
}

async function confirmFile(apiBase, token, storagePath, name, mimeType, size) {
  return apiRequest(apiBase, token, 'POST', '/files', {
    storage_path: storagePath,
    name,
    mime_type: mimeType || 'application/octet-stream',
    size
  });
}

async function createFolder(apiBase, token, name, parentId = null) {
  const res = await apiRequest(apiBase, token, 'POST', '/folders', { name, parent_id: parentId });
  return res.id ? res : { id: res.data?.id, ...res };
}

function getFolderRelPath(folder, allFolders) {
  const parts = [];
  let cur = folder;
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parent_id ? allFolders.find((x) => x.id === cur.parent_id) : null;
  }
  return parts.join(path.sep);
}

function buildFolderMap(folders) {
  const map = new Map(); // relPath -> { id, name }
  folders.forEach((f) => map.set(getFolderRelPath(f, folders), { id: f.id, name: f.name }));
  return map;
}

async function syncCloudToLocal(apiBase, token, basePath) {
  const allFolders = await getFoldersRecursive(apiBase, token);
  const folderMap = buildFolderMap(allFolders);
  const files = [];

  for (const folder of allFolders) {
    const relPath = getFolderRelPath(folder, allFolders);
    const filesInFolder = await getFilesInFolder(apiBase, token, folder.id);
    for (const f of filesInFolder) {
      files.push({ file: f, relPath });
    }
  }
  const rootFiles = await getFilesInFolder(apiBase, token, null);
  rootFiles.forEach((f) => files.push({ file: f, relPath: '' }));

  for (const folder of allFolders) {
    const dirPath = path.join(basePath, getFolderRelPath(folder, allFolders));
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  }

  const total = files.length;
  setProgress(0, total, 'Baixando da nuvem...');
  for (let i = 0; i < files.length; i++) {
    const { file, relPath } = files[i];
    const name = file.name || file.file_name || file.filename;
    const localPath = path.join(basePath, relPath, name);
    const remoteTime = new Date(file.updated_at || file.created_at || 0).getTime();
    const needDownload = !fs.existsSync(localPath) || (fs.statSync(localPath).mtimeMs || 0) < remoteTime;
    if (needDownload) {
      try {
        await downloadFile(apiBase, token, file, localPath);
      } catch (err) {
        console.error('Erro ao baixar', name, err);
      }
    }
    setProgress(i + 1, total, 'Baixando da nuvem...');
  }
}

async function ensureFolderPath(apiBase, token, relPath, folderMap, allFolders) {
  if (!relPath || relPath === '.') return null;
  const parts = relPath.split(path.sep).filter(Boolean);
  let parentId = null;
  for (let i = 0; i < parts.length; i++) {
    const subPath = parts.slice(0, i + 1).join(path.sep);
    const existing = folderMap.get(subPath);
    if (existing) {
      parentId = existing.id;
      continue;
    }
    const created = await createFolder(apiBase, token, parts[i], parentId);
    const id = created.id || created.data?.id;
    if (!id) throw new Error('Falha ao criar pasta');
    folderMap.set(subPath, { id, name: parts[i] });
    allFolders.push({ id, name: parts[i], parent_id: parentId });
    parentId = id;
  }
  return parentId;
}

async function syncLocalToCloud(apiBase, token, basePath) {
  const allFolders = await getFoldersRecursive(apiBase, token);
  const folderMap = buildFolderMap(allFolders);
  const walk = (dir, relPath = '') => {
    const items = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = relPath ? relPath + path.sep + e.name : e.name;
      if (e.isDirectory()) {
        items.push(...walk(full, rel));
      } else {
        items.push({ full, rel });
      }
    }
    return items;
  };
  const files = walk(basePath);
  const total = files.length;
  setProgress(0, total, 'Enviando para nuvem...');
  for (let i = 0; i < files.length; i++) {
    const { full, rel } = files[i];
    const dirRel = path.dirname(rel);
    const name = path.basename(rel);
    const folderId = await ensureFolderPath(apiBase, token, dirRel === '.' ? '' : dirRel, folderMap, allFolders);
    const urlData = await getUploadUrl(apiBase, token, name, 'application/octet-stream', folderId);
    if (!urlData) continue;
    await uploadFileToUrl(urlData.upload_url, full, 'application/octet-stream');
    await confirmFile(apiBase, token, urlData.storage_path, name, 'application/octet-stream', fs.statSync(full).size);
    setProgress(i + 1, total, 'Enviando para nuvem...');
  }
}

async function runFullSync() {
  if (!syncState.active || !syncState.folderPath || !syncState.token || !syncState.apiBase) return;
  setStatus('syncing');
  try {
    if (!fs.existsSync(syncState.folderPath)) {
      fs.mkdirSync(syncState.folderPath, { recursive: true });
    }
    await syncCloudToLocal(syncState.apiBase, syncState.token, syncState.folderPath);
    await syncLocalToCloud(syncState.apiBase, syncState.token, syncState.folderPath);
    setStatus('idle');
  } catch (err) {
    setStatus('error', err.message);
    emit('error', err.message);
  }
}

let debounceTimer = null;
function scheduleLocalSync() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    runFullSync();
  }, DEBOUNCE_MS);
}

function startWatching() {
  if (watcher) return;
  if (!fs.existsSync(syncState.folderPath)) return;
  watcher = fs.watch(syncState.folderPath, { recursive: true }, (eventType, filename) => {
    if (!filename || filename.includes('~') || filename.endsWith('.tmp')) return;
    scheduleLocalSync();
  });
}

function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(runFullSync, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function start(win, folderPath, token, apiBase) {
  mainWindow = win;
  syncState.active = true;
  syncState.folderPath = folderPath;
  syncState.token = token;
  syncState.apiBase = apiBase;
  setStatus('syncing');
  runFullSync().then(() => {
    setStatus('idle');
    startWatching();
    startPolling();
  }).catch((err) => {
    setStatus('error', err.message);
  });
}

function stop() {
  syncState.active = false;
  stopWatching();
  stopPolling();
  mainWindow = null;
  setStatus('idle');
}

function getStatus() {
  return { ...syncState };
}

function syncNow() {
  if (syncState.active) runFullSync();
}

module.exports = {
  start,
  stop,
  getStatus,
  syncNow,
  setMainWindow: (win) => { mainWindow = win; }
};
