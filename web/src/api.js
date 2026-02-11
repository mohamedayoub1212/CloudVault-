import { API_BASE } from './config';

const TOKEN_KEY = 'cloudvault_access_token';
const REFRESH_KEY = 'cloudvault_refresh_token';
const USER_KEY = 'cloudvault_user';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access, refresh, user = null) {
  if (access) localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser() {
  try {
    const u = localStorage.getItem(USER_KEY);
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated() {
  return !!getToken();
}

async function refreshAccessToken() {
  const refresh = getRefreshToken();
  if (!refresh) throw new Error('Sessão expirada');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh })
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

async function apiFetch(url, options = {}) {
  let token = getToken();
  let res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers
    }
  });

  if (res.status === 401) {
    token = await refreshAccessToken();
    res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      }
    });
  }

  return res;
}

// --- Auth ---

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Email ou senha inválidos');
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token, data.user);
  return data.user;
}

export async function signup(email, password, displayName = '') {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, display_name: displayName })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao criar conta');
  }

  return res.json();
}

export async function logout() {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (_) {}
  }
  clearTokens();
}

// --- Profile ---

export async function getProfile() {
  const res = await apiFetch('/profile');
  if (!res.ok) throw new Error('Erro ao carregar perfil');
  return res.json();
}

// --- Folders ---

export async function getFolders(parentId = null) {
  const params = new URLSearchParams();
  if (parentId) params.set('parent_id', parentId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/folders${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ao carregar pastas (${res.status})`);
  }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  const list = data.data ?? data.folders ?? data.items ?? [];
  return Array.isArray(list) ? list : [];
}

// --- Files ---

export async function getFiles(folderId = null, options = {}) {
  const params = new URLSearchParams();
  if (folderId) params.set('folder_id', folderId);
  if (options.trashed) params.set('trashed', 'true');
  if (options.favorites) params.set('favorites', 'true');
  if (options.shared) params.set('shared', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await apiFetch(`/files${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erro ao carregar arquivos (${res.status})`);
  }
  const data = await res.json();
  // Suporta: array direto, { data: [...] }, { files: [...] }, { items: [...] }
  if (Array.isArray(data)) return data;
  const list = data.data ?? data.files ?? data.items ?? [];
  return Array.isArray(list) ? list : [];
}

export async function uploadFile(file, folderId = null) {
  // 1. Obter URL assinada
  const body = { file_name: file.name, mime_type: file.type || 'application/octet-stream' };
  if (folderId) body.folder_id = folderId;

  const urlRes = await apiFetch('/files/upload-url', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}));
    throw new Error(err.message || 'Erro ao obter URL de upload');
  }

  const urlData = await urlRes.json();
  const { upload_url, storage_path } = urlData;

  if (!upload_url || !storage_path) {
    throw new Error('Resposta inválida do servidor (upload_url/storage_path)');
  }

  // 2. PUT direto na URL assinada
  const putRes = await fetch(upload_url, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    }
  });

  if (!putRes.ok) throw new Error('Erro ao enviar arquivo');

  // 3. Confirmar com POST /files (snake_case conforme documentação)
  const confirmBody = {
    storage_path,
    name: file.name,
    mime_type: file.type || 'application/octet-stream',
    size: file.size
  };
  const confirmRes = await apiFetch('/files', {
    method: 'POST',
    body: JSON.stringify(confirmBody)
  });

  if (!confirmRes.ok) {
    const err = await confirmRes.json().catch(() => ({}));
    const msg = err.message || err.error || err.details || err.hint || `Erro ao confirmar upload (${confirmRes.status})`;
    throw new Error(typeof msg === 'string' ? msg : 'Erro ao confirmar upload');
  }

  return confirmRes.json();
}

export async function downloadFile(file) {
  const res = await apiFetch(`/files/${file.id}/download`);
  if (!res.ok) throw new Error('Erro ao baixar');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name || file.file_name || file.filename || 'download';
  a.click();
  URL.revokeObjectURL(url);
}

export async function getFilePreviewUrl(file) {
  const type = file.mime_type || file.type || file.content_type || '';
  if (!type.startsWith('image/')) return null;

  try {
    const res = await apiFetch(`/files/${file.id}/download`);
    if (!res.ok) return null;

    const contentType = res.headers.get('content-type') || '';

    // API retorna JSON com URL assinada (comum no Supabase)
    if (contentType.includes('application/json')) {
      const data = await res.json();
      const url = data.url || data.signed_url || data.preview_url || data.download_url;
      return url || null;
    }

    // API retorna o arquivo diretamente
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function deleteFile(id) {
  const res = await apiFetch(`/files/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao excluir');
  return res.json();
}
