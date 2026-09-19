const { app, BrowserWindow, dialog, ipcMain, Notification, shell } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const port = app.isPackaged ? 2243 : Number(process.env.RUANG_KAWAN_DESKTOP_PORT || 2242);
const appUrl = `http://127.0.0.1:${port}`;
let mainWindow;
let nextServer;

function waitForServer(timeout = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tryConnection = () => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - started > timeout) reject(new Error('Server aplikasi tidak dapat dijalankan.'));
        else setTimeout(tryConnection, 250);
      });
    };
    tryConnection();
  });
}

function startProductionServer() {
  const serverPath = path.join(process.resourcesPath, 'standalone', 'server.js');
  nextServer = spawn(process.execPath, [serverPath], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', HOSTNAME: '127.0.0.1', PORT: String(port) },
    stdio: 'ignore',
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1080, minHeight: 680, title: 'Ruang Kawan', backgroundColor: '#0b1020',
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { void shell.openExternal(url); return { action: 'deny' }; });
  void mainWindow.loadURL(appUrl);
}

ipcMain.handle('desktop:choose-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], title: 'Pilih berkas' });
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('desktop:reveal-file', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) return false;
  shell.showItemInFolder(filePath); return true;
});
ipcMain.handle('desktop:open-external', async (_event, rawUrl) => {
  try { const url = new URL(rawUrl); if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) return false; await shell.openExternal(url.toString()); return true; } catch { return false; }
});
ipcMain.handle('desktop:notify', (_event, { title, body }) => {
  if (typeof title !== 'string') return false;
  if (Notification.isSupported()) new Notification({ title: title.slice(0, 120), body: typeof body === 'string' ? body.slice(0, 280) : '' }).show();
  return true;
});

app.whenReady().then(async () => {
  if (app.isPackaged) startProductionServer();
  try { await waitForServer(); createWindow(); }
  catch (error) { dialog.showErrorBox('Ruang Kawan', error.message); app.quit(); }
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (nextServer) nextServer.kill(); });
