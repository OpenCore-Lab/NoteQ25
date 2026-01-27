const { ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const { PROJECTS_PATH } = require('./files');
const { v4: uuidv4 } = require('uuid');

const INDEX_FILE = path.join(path.resolve(__dirname, '../../user-data'), 'index.json');

async function getIndex() {
  try {
    const data = await fs.readFile(INDEX_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    if (!parsed.notes) parsed.notes = [];
    if (!parsed.tags) parsed.tags = [];
    return parsed;
  } catch (error) {
    return { notes: [], tags: [] };
  }
}

async function saveIndex(index) {
  await fs.writeFile(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
}

ipcMain.handle('get-notes', async () => {
  const index = await getIndex();
  return index.notes;
});

ipcMain.handle('get-tags', async () => {
  const index = await getIndex();
  return index.tags || [];
});

ipcMain.handle('save-tags', async (event, tags) => {
  try {
    const index = await getIndex();
    index.tags = tags;
    await saveIndex(index);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-note', async (event, note) => {
  try {
    const index = await getIndex();
    const existingNoteIndex = index.notes.findIndex(n => n.id === note.id);
    
    // Construct file path
    // Use category as folder
    const safeCategory = (note.category || 'General').replace(/[^a-z0-9]/gi, '_');
    const fileName = `${note.id}.md`;
    const relativePath = path.join(safeCategory, fileName);
    const fullPath = path.join(PROJECTS_PATH, relativePath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Save Markdown Content
    // Note: The renderer sends 'content' which is the markdown string
    // The 'note' object contains metadata + content
    await fs.writeFile(fullPath, note.content || '', 'utf-8');

    // Update Metadata
    const metadata = {
      id: note.id,
      title: note.title,
      category: note.category,
      tags: note.tags,
      color: note.color,
      created_at: note.created_at,
      updated_at: new Date().toISOString(),
      file: relativePath,
      preview: note.preview // Optional: store preview text in metadata for faster list loading
    };

    if (existingNoteIndex >= 0) {
      index.notes[existingNoteIndex] = { ...index.notes[existingNoteIndex], ...metadata };
    } else {
      index.notes.push(metadata);
    }

    await saveIndex(index);
    return { success: true, note: metadata };
  } catch (error) {
    console.error(error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-note', async (event, noteId) => {
  try {
    const index = await getIndex();
    const noteIndex = index.notes.findIndex(n => n.id === noteId);
    
    if (noteIndex === -1) return { success: false, error: 'Note not found' };

    const note = index.notes[noteIndex];
    const fullPath = path.join(PROJECTS_PATH, note.file);

    // Delete file
    try {
      await fs.unlink(fullPath);
    } catch (e) {
      console.warn('File not found, removing from index anyway', e);
    }

    // Remove from index
    index.notes.splice(noteIndex, 1);
    await saveIndex(index);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-category', async (event, categoryName) => {
  try {
    const safeCategory = categoryName.replace(/[^a-z0-9]/gi, '_');
    const categoryPath = path.join(PROJECTS_PATH, safeCategory);
    await fs.mkdir(categoryPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-category', async (event, categoryName) => {
  try {
    const safeCategory = categoryName.replace(/[^a-z0-9]/gi, '_');
    const categoryPath = path.join(PROJECTS_PATH, safeCategory);
    
    // Check if exists
    try {
      await fs.access(categoryPath);
    } catch {
      return { success: false, error: 'Category not found' };
    }

    // Delete folder and all contents
    await fs.rm(categoryPath, { recursive: true, force: true });
    
    // Also remove all notes in this category from index
    const index = await getIndex();
    index.notes = index.notes.filter(n => n.category !== categoryName);
    await saveIndex(index);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
