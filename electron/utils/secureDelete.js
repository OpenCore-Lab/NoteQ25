const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Securely deletes a file by overwriting it multiple times before unlinking.
 * Adheres to a basic 3-pass secure wipe (0xFF, 0x00, Random).
 * @param {string} filePath - Path to the file to delete.
 */
async function secureDeleteFile(filePath) {
    try {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) return;

        const size = stats.size;
        const fh = await fs.open(filePath, 'r+');

        // Pass 1: All ones (0xFF)
        const bufferOnes = Buffer.alloc(size, 0xFF);
        await fh.write(bufferOnes, 0, size, 0);

        // Pass 2: All zeros (0x00)
        const bufferZeros = Buffer.alloc(size, 0x00);
        await fh.write(bufferZeros, 0, size, 0);

        // Pass 3: Random bytes
        const bufferRandom = crypto.randomBytes(size);
        await fh.write(bufferRandom, 0, size, 0);

        await fh.close();
        await fs.unlink(filePath);
    } catch (error) {
        // If file is locked or other error, try simple unlink as fallback or throw
        console.error(`Secure delete failed for ${filePath}:`, error);
        try {
            await fs.unlink(filePath);
        } catch (e) {
            console.error(`Fallback delete failed for ${filePath}:`, e);
        }
    }
}

/**
 * Recursively securely deletes a directory and its contents.
 * @param {string} dirPath - Path to the directory.
 */
async function secureDeleteDir(dirPath) {
    try {
        const entries = await fs.readdir(dirPath);
        
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry);
            const stats = await fs.lstat(fullPath);

            if (stats.isDirectory()) {
                await secureDeleteDir(fullPath);
            } else {
                await secureDeleteFile(fullPath);
            }
        }
        
        await fs.rmdir(dirPath);
    } catch (error) {
        console.error(`Secure delete dir failed for ${dirPath}:`, error);
    }
}

module.exports = { secureDeleteFile, secureDeleteDir };
