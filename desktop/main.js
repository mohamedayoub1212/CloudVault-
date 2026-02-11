const { app, BrowserWindow, session, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const PORT = 3001;
const GITHUB_OWNER = 'mohamedayoub1212';
const GITHUB_REPO = 'CloudVault-';
let mainWindow;
let staticServer;

function getWebDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web-dist');
  }
  return path.join(__dirname, '..', 'web', 'dist');
}

function startServer() {
  const distPath = getWebDistPath();
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };

  return new Promise((resolve) => {
    staticServer = http.createServer((req, res) => {
      const p = req.url === '/' ? '/index.html' : req.url;
      const file = path.join(distPath, p.replace(/\?.*$/, ''));

      fs.readFile(file, (err, data) => {
        if (err) {
          if (p === '/' || !path.extname(p)) {
            fs.readFile(path.join(distPath, 'index.html'), (e, d) => {
              if (e) {
                res.writeHead(404);
                res.end('Not found');
              } else {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(d);
              }
            });
          } else {
            res.writeHead(404);
            res.end('Not found');
          }
        } else {
          const ext = path.extname(file);
          res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
          res.end(data);
        }
      });
    });

    staticServer.listen(PORT, () => resolve());
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'CloudVault',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

function killServer() {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
}

function fetchLatestReleaseTag() {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'CloudVault-Updater' }
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API: ${res.statusCode}`));
          return;
        }
        try {
          const j = JSON.parse(data);
          resolve(j.tag_name);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update-available', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    if (mainWindow) mainWindow.webContents.send('update-not-available');
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) {
      const btn = dialog.showMessageBoxSync(mainWindow, {
        type: 'info',
        title: 'Atualização disponível',
        message: `Versão ${info.version} baixada. Reiniciar agora para atualizar?`,
        buttons: ['Reiniciar agora', 'Mais tarde']
      });
      if (btn === 0) autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('Erro ao verificar atualização:', err);
    if (mainWindow) mainWindow.webContents.send('update-error', err?.message || String(err));
  });
}

function doCheckForUpdates() {
  if (!app.isPackaged || !autoUpdater) return;
  if (mainWindow) mainWindow.webContents.send('update-checking');
  fetchLatestReleaseTag()
    .then((tag) => {
      const baseUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${tag}/`;
      autoUpdater.setFeedURL({ provider: 'generic', url: baseUrl });
      autoUpdater.checkForUpdatesAndNotify();
    })
    .catch((err) => {
      console.error('Erro ao obter release:', err);
      if (mainWindow) mainWindow.webContents.send('update-error', err?.message || String(err));
    });
}

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged && autoUpdater) {
    doCheckForUpdates();
    return true;
  }
  return false;
});

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
    setupAutoUpdater();
    if (app.isPackaged) {
      setTimeout(doCheckForUpdates, 5000);
      setTimeout(doCheckForUpdates, 60000);
    }
  } catch (err) {
    console.error('Erro ao iniciar:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  killServer();
  app.quit();
});

app.on('before-quit', async (event) => {
  killServer();
  event.preventDefault();
  try {
    await session.defaultSession.clearStorageData({ storages: ['localstorage'] });
  } catch (_) {}
  app.exit(0);
});
