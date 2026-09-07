const { app, BrowserWindow, Notification, ipcMain } = require('electron');
const path = require('path');

// Determine environment
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1000,
    minHeight: 700,
    title: 'SmartMail — AI Email Management',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL('http://localhost:5000');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start backend Express server
function startBackendServer() {
  try {
    process.env.PORT = process.env.PORT || '5000';
    console.log('[Electron Main] Starting backend Express server...');
    require('../backend/index.js');
  } catch (err) {
    console.error('[Electron Main] Failed to start backend Express server:', err);
  }
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handler for desktop notifications
ipcMain.on('show-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});
