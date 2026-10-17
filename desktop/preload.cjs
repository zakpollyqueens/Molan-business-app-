const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('MolanBusinessNative', Object.freeze({
  isNativeApp: true,
  getPendingHandoffToken: () => ipcRenderer.sendSync('molan-business:get-pending-handoff-token'),
  clearPendingHandoffToken: () => ipcRenderer.send('molan-business:clear-pending-handoff-token'),
  closeAppAccess: () => ipcRenderer.send('molan-business:close-app-access')
}));
