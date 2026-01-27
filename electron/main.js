const { app, BrowserWindow, ipcMain, Menu, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Import IPC handlers (will create these next)
// require('./ipc/notes');
// require('./ipc/settings');
// require('./ipc/files');

function createWindow() {
  Menu.setApplicationMenu(null); // Remove native menu bar
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false, // Frameless window
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true // Keep security enabled, use custom protocol
    },
  });

  // Window Controls IPC
  ipcMain.on('window-minimize', () => win.minimize());
  ipcMain.on('window-maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  ipcMain.on('window-close', () => win.close());

  const isDev = !app.isPackaged; // or check process.env.NODE_ENV

  if (isDev && !process.env.PLAYWRIGHT_TEST) {
    win.loadURL('http://localhost:5173');
    // win.webContents.openDevTools(); // Disabled as per user request
  } else if (isDev && process.env.PLAYWRIGHT_TEST) {
     win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  // Register custom protocol 'noteq://' to serve files from user-data
  protocol.registerFileProtocol('noteq', (request, callback) => {
    const url = request.url.substr(8); // Strip 'noteq://'
    
    // Check if it's a project file request
    if (url.startsWith('project/')) {
        const { getProjectPath } = require('./ipc/project_system');
        const projectPath = getProjectPath();
        if (projectPath) {
            // Strip 'project/' and decode URI components (spaces, etc)
            const relativePath = decodeURI(url.substr(8));
            const filePath = path.join(projectPath, relativePath);
            callback({ path: filePath });
            return;
        }
    }
    
    // Fallback/Legacy (if any)
    callback({ error: -6 }); // net::ERR_FILE_NOT_FOUND
  });

  createWindow();

  // Load IPC handlers
  // require('./ipc/files');
  // require('./ipc/notes');
  require('./ipc/settings');
  require('./ipc/auth');
  require('./ipc/project_system');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
