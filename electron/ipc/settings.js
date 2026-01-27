const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');

const SETTINGS_FILE = path.join(path.resolve(__dirname, '../../user-data'), 'settings.json');

const DEFAULT_SETTINGS = {
  autosaveInterval: 300000,
  theme: 'light',
  markdownPreview: true
};

ipcMain.handle('get-settings', async () => {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
