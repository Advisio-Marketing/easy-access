// main/preload.js
const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded.');

contextBridge.exposeInMainWorld('electronAPI', {
  // Po kliknutí na úvodní tlačítko
  fetchAccountList: () => ipcRenderer.invoke('fetch-account-list'),
  showMainLayout: () => ipcRenderer.invoke('show-main-layout'),

  // Po kliknutí v sidebaru
  selectAccount: (accountInfo) => ipcRenderer.invoke('select-account', accountInfo),

  // Po kliknutí na tab
  switchTab: (accountId) => ipcRenderer.invoke('switch-tab', accountId),

  // Po kliknutí na 'x' na tabu
  closeTab: (accountId) => ipcRenderer.invoke('close-tab', accountId),

  // Listenery pro zprávy z Main procesu
  onTabStatusUpdate: (callback) => {
      const listener = (_event, statusUpdate) => callback(statusUpdate);
      ipcRenderer.on('tab-status-update', listener);
      return () => ipcRenderer.removeListener('tab-status-update', listener);
  },
  onActivateTab: (callback) => {
      const listener = (_event, accountId) => callback(accountId);
      ipcRenderer.on('activate-tab', listener);
      return () => ipcRenderer.removeListener('activate-tab', listener);
  },
  onForceCloseTab: (callback) => {
      const listener = (_event, accountId) => callback(accountId);
      ipcRenderer.on('force-close-tab', listener);
      return () => ipcRenderer.removeListener('force-close-tab', listener);
  }
  
});