const { app, BrowserWindow, session, dialog, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

const PORT = 3001;
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
}

function killServer() {
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
}

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  // Usa GitHub Releases (provider do package.json) - nao precisa de latest.yml no repo
  autoUpdater.on('checking-for-update', () => {
    if (mainWindow) mainWindow.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info.version);
    }
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

  // Verifica atualizações 5s após iniciar, e novamente após 60s (fallback)
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 5000);
  setTimeout(() => autoUpdater.checkForUpdatesAndNotify(), 60000);
}

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('check-for-updates', () => {
  if (app.isPackaged && autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify();
    return true;
  }
  return false;
});

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
    setupAutoUpdater();
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
