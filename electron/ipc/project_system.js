const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const matter = require('gray-matter');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

const store = new Store();

// DEBUG LOGGING
const DEBUG_LOG_PATH = path.join(process.env.USERPROFILE || process.env.HOME, 'Desktop', 'noteq_debug.log');
function logDebug(message) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    try {
        fsSync.appendFileSync(DEBUG_LOG_PATH, logLine);
    } catch (e) {
        // Ignore logging errors
    }
}

function getProjectPath() {
    const p = store.get('project.path');
    logDebug(`getProjectPath returned: ${p}`);
    return p;
}

// Helper to ensure category structure
async function ensureCategoryStructure(projectPath, category) {
    const safeCategory = category.trim(); 
    const catPath = path.join(projectPath, safeCategory);
    
    logDebug(`ensureCategoryStructure: ensuring ${catPath}`);

    // Ensure parent folder exists (project path)
    try {
        await fs.access(projectPath);
    } catch {
        logDebug(`ensureCategoryStructure: Project path missing, creating ${projectPath}`);
        await fs.mkdir(projectPath, { recursive: true });
    }

    // Create subfolders
    const notesPath = path.join(catPath, 'notes');
    const imagesPath = path.join(catPath, 'images');
    const filesPath = path.join(catPath, 'files');

    try {
        await fs.mkdir(notesPath, { recursive: true });
        logDebug(`ensureCategoryStructure: Created/Verified ${notesPath}`);
        await fs.mkdir(imagesPath, { recursive: true });
        await fs.mkdir(filesPath, { recursive: true });
    } catch (e) {
        logDebug(`ensureCategoryStructure: Error creating folders: ${e.message}`);
        throw e;
    }
    
    return catPath;
}

ipcMain.handle('select-project-folder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory']
    });
    
    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }
    
    return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('get-notes', async () => {
    const projectPath = getProjectPath();
    if (!projectPath) return []; // Should be handled by auth check
    
    try {
        const categories = await fs.readdir(projectPath, { withFileTypes: true });
        let allNotes = [];
        
        for (const cat of categories) {
            if (cat.isDirectory() && !cat.name.startsWith('.')) {
                const categoryName = cat.name;
                const notesPath = path.join(projectPath, categoryName, 'notes');
                
                try {
                    await fs.access(notesPath);
                    const files = await fs.readdir(notesPath);
                    
                    for (const file of files) {
                        if (file.endsWith('.md')) {
                            const content = await fs.readFile(path.join(notesPath, file), 'utf-8');
                            const parsed = matter(content);
                            
                            // Combine frontmatter and content for the app
                            allNotes.push({
                                ...parsed.data,
                                id: parsed.data.id || path.basename(file, '.md'), // Fallback
                                content: parsed.content, // This is markdown
                                category: categoryName,
                                file: path.join(categoryName, 'notes', file)
                            });
                        }
                    }
                } catch (e) {
                    // Notes folder might not exist in this folder, skip
                }
            }
        }
        return allNotes;
    } catch (error) {
        console.error('Failed to get notes:', error);
        return [];
    }
});

// ... (keep ipcMain handlers) ...

ipcMain.handle('save-note', async (event, note) => {
    logDebug(`[save-note] START: Saving note "${note.title}" (${note.id})`);
    
    const projectPath = getProjectPath();
    if (!projectPath) {
        logDebug(`[save-note] ERROR: No project path set`);
        return { success: false, error: 'No project path set' };
    }
    
    try {
        const category = note.category || 'General';
        logDebug(`[save-note] Category: "${category}"`);
        
        await ensureCategoryStructure(projectPath, category);
        
        // Prepare Frontmatter data
        // sanitize: remove undefined values to prevent YAMLException
        const data = {
            id: note.id || uuidv4(),
            title: (note.title || 'Untitled').toString(),
            tags: Array.isArray(note.tags) ? note.tags.filter(t => t !== undefined && t !== null).map(String) : [],
            color: note.color || '#ffffff',
            created_at: note.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString(),
            preview: (note.preview || '').toString()
        };

        // Double check: explicitly delete undefined keys if any slipped through logic (though defaults above cover it)
        Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);
        
        logDebug(`[save-note] Sanitized Data: ${JSON.stringify(data)}`);

        // Create Markdown content
        const fileContent = matter.stringify((note.content || '').toString(), data);
        
        const fileName = `${note.id}.md`;
        const relativePath = path.join(category.trim(), 'notes', fileName);
        const fullPath = path.join(projectPath, relativePath);
        
        logDebug(`[save-note] Writing to: ${fullPath}`);
        await fs.writeFile(fullPath, fileContent, 'utf-8');
        
        // Verify file was written
        try {
            await fs.access(fullPath);
            logDebug(`[save-note] SUCCESS: File verified at ${fullPath}`);
        } catch (e) {
            logDebug(`[save-note] CRITICAL ERROR: File write succeeded but file not found at ${fullPath}. Error: ${e.message}`);
            throw new Error(`File write failed verification: ${e.message}`);
        }
        
        return { success: true, note: { ...note, file: relativePath } };
    } catch (error) {
        logDebug(`[save-note] EXCEPTION: ${error.message}\n${error.stack}`);
        console.error('[save-note] Failed to save note:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-note', async (event, noteId) => {
    const projectPath = getProjectPath();
    // We need to find the file first since we don't store the path in DB
    // But usually the frontend sends the note object which has 'category'
    // For now, let's scan or assume we pass the category/path
    // To be efficient, let's look up.
    
    // Actually, 'delete-note' usually receives just ID. 
    // We need to find it.
    try {
        // Quick scan
        const categories = await fs.readdir(projectPath, { withFileTypes: true });
        for (const cat of categories) {
            if (cat.isDirectory() && !cat.name.startsWith('.')) {
                const filePath = path.join(projectPath, cat.name, 'notes', `${noteId}.md`);
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                    return { success: true };
                } catch {
                    // Not in this category
                }
            }
        }
        return { success: false, error: 'Note not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('create-category', async (event, categoryName) => {
    const projectPath = getProjectPath();
    try {
        await ensureCategoryStructure(projectPath, categoryName);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-categories', async () => {
    const projectPath = getProjectPath();
    if (!projectPath) return [];
    try {
        const dirs = await fs.readdir(projectPath, { withFileTypes: true });
        return dirs
            .filter(d => d.isDirectory() && !d.name.startsWith('.'))
            .map(d => d.name);
    } catch (error) {
        return [];
    }
});

// Image handling for new structure
ipcMain.handle('save-image', async (event, { filePath, category } = {}) => {
    const projectPath = getProjectPath();
    if (!projectPath) return { success: false, error: 'No project path' };
    
    let sourcePath = filePath;
    
    if (!sourcePath) {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'jpeg', 'webp'] }]
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, canceled: true };
        }
        sourcePath = result.filePaths[0];
    }
    
    try {
        const cat = category || 'General';
        await ensureCategoryStructure(projectPath, cat);
        
        const ext = path.extname(sourcePath);
        const fileName = `${uuidv4()}${ext}`;
        const destPath = path.join(projectPath, cat, 'images', fileName);
        
        await fs.copyFile(sourcePath, destPath);
        
        // Return protocol URL
        return { success: true, url: `noteq://project/${cat}/images/${fileName}`, fileName };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

module.exports = { getProjectPath };

ipcMain.handle('save-project-settings', async (event, settings) => {
    const projectPath = getProjectPath();
    if (!projectPath) return { success: false, error: 'No project open' };

    const settingsDir = path.join(projectPath, '.noteq');
    const settingsFile = path.join(settingsDir, 'settings.json');

    try {
        await fs.mkdir(settingsDir, { recursive: true });
        await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-project-settings', async () => {
    const projectPath = getProjectPath();
    if (!projectPath) return {};

    const settingsFile = path.join(projectPath, '.noteq', 'settings.json');
    try {
        const data = await fs.readFile(settingsFile, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return {}; // Return empty if not found
    }
});

