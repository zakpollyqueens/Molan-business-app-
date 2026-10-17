const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('node:path');

let mainWindow = null;
let pendingHandoffToken = '';
let pendingAccessEvent = false;

function tokenFromProtocolUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'molanbusiness:' || url.hostname !== 'auth-handoff') return '';
    const token = url.searchParams.get('token') || '';
    return /^[a-f0-9]{64}$/.test(token) ? token : '';
  } catch (_) { return ''; }
}

function acceptProtocolUrl(value) {
  const token = tokenFromProtocolUrl(value);
  if (!token) return false;
  pendingHandoffToken = token;
  pendingAccessEvent = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    const notify = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.executeJavaScript("window.dispatchEvent(new Event('molan-access-handoff'))").catch(() => {});
      }
    };
    if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', notify);
    else notify();
    mainWindow.show();
    mainWindow.focus();
  }
  return true;
}

ipcMain.on('molan-business:get-pending-handoff-token', event => {
  event.returnValue = pendingHandoffToken;
});
ipcMain.on('molan-business:clear-pending-handoff-token', () => {
  pendingHandoffToken = '';
  pendingAccessEvent = false;
});
ipcMain.on('molan-business:close-app-access', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.executeJavaScript("window.dispatchEvent(new Event('molan-close-app-access'))").catch(() => {});
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  const initialProtocolUrl = process.argv.find(arg => String(arg).startsWith('molanbusiness://'));
  if (initialProtocolUrl) acceptProtocolUrl(initialProtocolUrl);

  app.on('second-instance', (_event, argv) => {
    const protocolUrl = argv.find(arg => String(arg).startsWith('molanbusiness://'));
    if (protocolUrl) acceptProtocolUrl(protocolUrl);
    if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });

  app.whenReady().then(() => {
    app.setAsDefaultProtocolClient('molanbusiness');
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    acceptProtocolUrl(url);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    title: 'Molan Business',
    backgroundColor: '#081a35',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  windowLoad();
  function windowLoad() {
    mainWindow.loadFile(path.join(__dirname, '..', 'www', 'index.html'));
    mainWindow.webContents.once('did-finish-load', () => {
      if (pendingAccessEvent) mainWindow.webContents.executeJavaScript("window.dispatchEvent(new Event('molan-access-handoff'))").catch(() => {});
    });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('tel:')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
