const { ipcMain, app, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const USER_DATA_PATH = path.resolve(__dirname, '../../user-data');
const PROJECTS_PATH = path.join(USER_DATA_PATH, 'projects');
// Store images INSIDE projects folder so the whole project folder is portable
const ASSETS_PATH = path.join(PROJECTS_PATH, 'assets');

// Ensure directories exist
(async () => {
  try {
    await fs.mkdir(USER_DATA_PATH, { recursive: true });
    await fs.mkdir(PROJECTS_PATH, { recursive: true });
    await fs.mkdir(ASSETS_PATH, { recursive: true });
  } catch (err) {
    console.error('Failed to create user data directories:', err);
  }
})();

ipcMain.handle('select-image', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath);
    const fileName = `${uuidv4()}${ext}`;
    const destPath = path.join(ASSETS_PATH, fileName);

    await fs.copyFile(sourcePath, destPath);

    // Return a path compatible with our custom protocol
    // noteq://assets/filename.png
    return { success: true, url: `noteq://assets/${fileName}` };
  } catch (error) {
    console.error('Failed to select image:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const fullPath = path.join(PROJECTS_PATH, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    const fullPath = path.join(PROJECTS_PATH, filePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    const fullPath = path.join(PROJECTS_PATH, filePath);
    await fs.unlink(fullPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-files', async (event, dirPath = '') => {
  try {
    const fullPath = path.join(PROJECTS_PATH, dirPath);
    const files = await fs.readdir(fullPath);
    return { success: true, files };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

module.exports = { PROJECTS_PATH };
