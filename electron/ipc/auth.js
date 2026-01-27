const { ipcMain, app, dialog } = require('electron');
const Store = require('electron-store');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { secureDeleteDir } = require('../utils/secureDelete');

const store = new Store();

// Configuration for Enterprise Security
const BCRYPT_ROUNDS = 12; // Increased from 10 for higher security

// State for self-destruct mechanism
let failedAttempts = 0;
let selfDestructTimer = null;
let isDestructing = false;

ipcMain.handle('auth-status', async () => {
    const hasPin = store.has('auth.pinHash');
    const projectPath = store.get('project.path');
    
    return {
        isSetup: !!(hasPin && projectPath),
        hasPin: !!hasPin,
        isLocked: !!hasPin, // Default locked if PIN exists
        projectPath: projectPath || null
    };
});

ipcMain.handle('logout', async () => {
    // Clear project path to force re-selection (First Page)
    store.delete('project.path');
    return { success: true };
});

ipcMain.handle('open-project', async (event, { path: projectPath, pin, key }) => {
    if (!projectPath || typeof projectPath !== 'string') return { success: false, error: 'Invalid project path' };
    if (!path.isAbsolute(projectPath)) return { success: false, error: 'Project path must be absolute' };
    if (!pin || typeof pin !== 'string') return { success: false, error: 'Invalid PIN format' };

    let storedPinHash = store.get('auth.pinHash');
    let storedKeyHash = store.get('auth.recoveryKeyHash');
    
    // Check if auth credentials exist locally. If not, try to load from project folder
    // Or if they exist but don't match the project folder (implicit requirement: trust the folder's auth.json)
    // Actually, "restoring old vaults" implies we should ALWAYS check the folder's auth.json first to verify "connection".
    
    try {
        const authFile = path.join(projectPath, '.noteq', 'auth.json');
        await fs.access(authFile);
        const authData = JSON.parse(await fs.readFile(authFile, 'utf-8'));
        
        // Validate structure
        if (authData.pinHash && authData.recoveryKeyHash) {
            // Use these for validation
            storedPinHash = authData.pinHash;
            storedKeyHash = authData.recoveryKeyHash;
            
            // We will update local store ONLY if validation passes below
        }
    } catch (e) {
        // If no auth file in folder, we fall back to local store if it exists?
        // But the user said "projects folder has unique mechanism to verify".
        // If no auth.json, we can't verify against the project.
        if (!storedPinHash) return { success: false, error: 'Not a valid NoteQ Vault (missing auth data)' };
    }

    if (!storedPinHash) return { success: false, error: 'No PIN set' };
    
    // 1. Verify PIN
    const matchPin = await bcrypt.compare(pin, storedPinHash);
    if (!matchPin) {
        failedAttempts++;
        if (failedAttempts >= 10) {
            startSelfDestructSequence(event.sender);
            return { success: false, error: 'Self-destruct initiated', destruct: true };
        }
        return { success: false, error: 'Invalid PIN' };
    }

    // 2. Verify Recovery Key (Required for restore/login per user request)
    if (!key) return { success: false, error: 'Recovery Key required' };
    const cleanKey = key.trim();
    const matchKey = await bcrypt.compare(cleanKey, storedKeyHash);
    
    if (!matchKey) {
        return { success: false, error: 'Invalid Recovery Key' };
    }
    
    failedAttempts = 0;
    
    // Validation Successful: Sync credentials to local store (Restore)
    store.set('auth.pinHash', storedPinHash);
    store.set('auth.recoveryKeyHash', storedKeyHash);
    store.set('project.path', projectPath);
    
    // Try to load profile if available
    try {
        const authFile = path.join(projectPath, '.noteq', 'auth.json');
        const authData = JSON.parse(await fs.readFile(authFile, 'utf-8'));
        if (authData.username) store.set('user.username', authData.username);
        if (authData.avatar) store.set('user.avatar', authData.avatar);
    } catch (e) {}

    return { success: true };
});

ipcMain.handle('setup-auth', async (event, { pin, projectPath, username, avatar }) => {
    try {
        // Hash PIN
        const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        const hash = await bcrypt.hash(pin, salt);
        
        // Generate Recovery Key (120 chars)
        const recoveryKey = crypto.randomBytes(60).toString('hex'); // 120 hex chars
        const recoveryKeyHash = await bcrypt.hash(recoveryKey, salt);
        
        // Save to store
        store.set('auth.pinHash', hash);
        store.set('project.path', projectPath);
        store.set('user.username', username || 'User');
        store.set('user.avatar', avatar || 'ava_01');
        store.set('auth.recoveryKeyHash', recoveryKeyHash); // Store hash of recovery key too
        
        // Save portable auth file to project folder
        try {
            const authDir = path.join(projectPath, '.noteq');
            await fs.mkdir(authDir, { recursive: true });
            await fs.writeFile(path.join(authDir, 'auth.json'), JSON.stringify({
                pinHash: hash,
                recoveryKeyHash: recoveryKeyHash,
                username: username || 'User',
                avatar: avatar || 'ava_01',
                updatedAt: new Date().toISOString()
            }, null, 2));
            
            // Hide the folder on Windows
            if (process.platform === 'win32') {
                 // require('child_process').exec(`attrib +h "${authDir}"`); // Optional polish
            }
        } catch (e) {
            console.error('Failed to save portable auth:', e);
            // Non-critical failure, continue
        }

        return { success: true, recoveryKey };
    } catch (error) {
        console.error('Setup failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-user-profile', async () => {
    return {
        username: store.get('user.username'),
        avatar: store.get('user.avatar')
    };
});

ipcMain.handle('verify-pin', async (event, pin) => {
    if (isDestructing) return { success: false, error: 'Self-destruct in progress' };
    
    const storedHash = store.get('auth.pinHash');
    if (!storedHash) return { success: false, error: 'No PIN set' };
    
    const match = await bcrypt.compare(pin, storedHash);
    
    if (match) {
        failedAttempts = 0;
        return { success: true };
    } else {
        failedAttempts++;
        const remaining = 10 - failedAttempts;
        
        if (failedAttempts >= 10) {
            startSelfDestructSequence(event.sender);
            return { success: false, error: 'Self-destruct sequence initiated', remaining: 0, destruct: true };
        }
        
        return { success: false, error: 'Invalid PIN', remaining };
    }
});

ipcMain.handle('save-key-file', async (event, keyContent) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'Save Recovery Key',
        defaultPath: 'noteq-recovery-key.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    
    if (filePath) {
        await fs.writeFile(filePath, keyContent, 'utf-8');
        return { success: true };
    }
    return { success: false, error: 'Cancelled' };
});

ipcMain.handle('reset-pin', async (event, { pin }) => {
    try {
        const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        const hash = await bcrypt.hash(pin, salt);
        store.set('auth.pinHash', hash);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('recover-with-key', async (event, keyContent) => {
    const storedKeyHash = store.get('auth.recoveryKeyHash');
    if (!storedKeyHash) return { success: false, error: 'No recovery key found' };
    
    const cleanKey = keyContent.trim();
    const match = await bcrypt.compare(cleanKey, storedKeyHash);
    
    if (match) {
        stopSelfDestructSequence();
        // Don't delete pin yet, just return success so UI can show reset screen
        return { success: true };
    }
    
    return { success: false, error: 'Invalid recovery key' };
});

function startSelfDestructSequence(sender) {
    if (isDestructing) return;
    isDestructing = true;
    
    console.log('SELF DESTRUCT SEQUENCE STARTED');
    
    // Notify frontend
    sender.send('self-destruct-warning', { minutes: 10 });
    
    // 10 minutes timer
    selfDestructTimer = setTimeout(async () => {
        await performSelfDestruct();
        sender.send('self-destruct-complete');
        app.quit(); // Or relaunch
    }, 10 * 60 * 1000); 
}

function stopSelfDestructSequence() {
    if (selfDestructTimer) {
        clearTimeout(selfDestructTimer);
        selfDestructTimer = null;
    }
    isDestructing = false;
    failedAttempts = 0;
}

async function performSelfDestruct() {
    try {
        const projectPath = store.get('project.path');
        if (projectPath) {
            // Securely Delete all files in project path (3-pass overwrite)
            await secureDeleteDir(projectPath);
        }
        
        // Clear store
        store.clear();
        console.log('SELF DESTRUCT COMPLETE');
    } catch (error) {
        console.error('Self destruct failed:', error);
    }
}

module.exports = {
    getProjectPath: () => store.get('project.path'),
    isLocked: () => !!store.get('auth.pinHash')
};
