const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const LIVE_APP_URL = 'https://zakpollyqueens.github.io/Molan-business-app-/';

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    title: 'Molan Business',
    backgroundColor: '#081a35',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Load the published HTTPS app so desktop users receive frontend updates
  // without reinstalling the Windows package.
  window.loadURL(LIVE_APP_URL);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
