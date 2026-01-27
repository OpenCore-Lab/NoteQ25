const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');
const Store = require('electron-store');
const { v4: uuidv4 } = require('uuid');

const store = new Store();

function getProjectPath() {
    return store.get('project.path');
}

// Helper to ensure category structure
async function ensureCategoryStructure(projectPath, category) {
    const catPath = path.join(projectPath, category);
    await fs.mkdir(path.join(catPath, 'notes'), { recursive: true });
    await fs.mkdir(path.join(catPath, 'images'), { recursive: true });
    await fs.mkdir(path.join(catPath, 'files'), { recursive: true });
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
            if (cat.isDirectory()) {
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

ipcMain.handle('save-note', async (event, note) => {
    const projectPath = getProjectPath();
    if (!projectPath) return { success: false, error: 'No project path set' };
    
    try {
        const category = note.category || 'General';
        await ensureCategoryStructure(projectPath, category);
        
        // Prepare Frontmatter data
        const data = {
            id: note.id,
            title: note.title,
            tags: note.tags || [],
            color: note.color,
            created_at: note.created_at,
            updated_at: new Date().toISOString(),
            preview: note.preview
        };
        
        // Create Markdown content
        const fileContent = matter.stringify(note.content || '', data);
        
        const fileName = `${note.id}.md`;
        const relativePath = path.join(category, 'notes', fileName);
        const fullPath = path.join(projectPath, relativePath);
        
        await fs.writeFile(fullPath, fileContent, 'utf-8');
        
        // If category changed, delete old file? 
        // Logic handled by frontend usually, but for now we just write.
        
        return { success: true, note: { ...note, file: relativePath } };
    } catch (error) {
        console.error('Failed to save note:', error);
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
            if (cat.isDirectory()) {
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
        return dirs.filter(d => d.isDirectory()).map(d => d.name);
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
