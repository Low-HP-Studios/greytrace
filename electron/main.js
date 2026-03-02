import { app, BrowserWindow, globalShortcut, protocol, net } from 'electron';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const distPath = path.join(__dirname, '..', 'dist');

app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.fbx': 'application/octet-stream',
  '.glb': 'application/octet-stream',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    fullscreen: true,
    title: 'Zero Hour',
    autoHideMenuBar: true,
    icon: isDev
      ? path.join(__dirname, '..', 'build', 'icon.png')
      : path.join(process.resourcesPath, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenu(null);

  if (isDev) {
    mainWindow.loadURL('http://localhost:1420');
  } else {
    mainWindow.loadURL('app://game/index.html');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle('app', (request) => {
      let requestPath = new URL(request.url).pathname;
      requestPath = decodeURIComponent(requestPath);

      if (requestPath === '/' || requestPath === '') {
        requestPath = '/index.html';
      }

      const filePath = path.join(distPath, requestPath);
      const normalizedFilePath = path.normalize(filePath);
      if (!normalizedFilePath.startsWith(distPath)) {
        return new Response('Forbidden', { status: 403 });
      }

      if (!fs.existsSync(normalizedFilePath)) {
        return new Response('Not Found', { status: 404 });
      }

      const ext = path.extname(normalizedFilePath).toLowerCase();
      const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
      return net.fetch(pathToFileURL(normalizedFilePath).href, {
        headers: { 'Content-Type': mimeType },
      });
    });
  }

  createWindow();

  globalShortcut.register('F11', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  globalShortcut.register('Alt+Return', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
