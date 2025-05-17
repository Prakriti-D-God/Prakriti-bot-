const fs = require('fs');
const path = require('path');
const { logSuccess, logError, logInfo } = require('../../utils/logger');

module.exports = {
    name: "clean",
    description: "Cleans session, sender-key, and pre-key files from the auth/session directory",
    usage: "{prefix}clean",
    aliases: ["cleansession", "clearcache"],
    cooldown: 10,
    permission: 2, // Bot Admin only
    category: "admin",
    async run({ sock, m, sender, botNumber }) {
        try {
            // Path to the session directory
            const sessionDir = path.join(process.cwd(), 'auth', 'session');

            // Check if directory exists
            if (!fs.existsSync(sessionDir)) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: "❌ Session directory not found!" },
                    { quoted: m }
                );
            }

            // Get all files in the directory
            const files = fs.readdirSync(sessionDir);

            // Filter files by type
            const sessionFiles = files.filter(file => file.startsWith('session'));
            const senderKeyFiles = files.filter(file => file.includes('sender-key'));
            const preKeyFiles = files.filter(file => file.includes('pre-key'));

            // Combine unique files (in case there's overlap)
            const filesToDelete = [...new Set([...sessionFiles, ...senderKeyFiles, ...preKeyFiles])];

            if (filesToDelete.length === 0) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: "ℹ️ No cache files found to clean." },
                    { quoted: m }
                );
            }

            // Counters for deleted files
            let deletedSessionCount = 0;
            let deletedSenderKeyCount = 0;
            let deletedPreKeyCount = 0;
            let failedCount = 0;

            // Delete each file
            for (const file of filesToDelete) {
                const filePath = path.join(sessionDir, file);
                try {
                    fs.unlinkSync(filePath);

                    if (file.startsWith('session')) {
                        deletedSessionCount++;
                    }
                    if (file.includes('sender-key')) {
                        deletedSenderKeyCount++;
                    }
                    if (file.includes('pre-key')) {
                        deletedPreKeyCount++;
                    }

                    logSuccess(`Deleted file: ${file}`);
                } catch (err) {
                    logError(`Failed to delete ${file}: ${err.message}`);
                    failedCount++;
                }
            }

            // Send response message
            const responseText = `🧹 *Cache Cleanup Report*\n\n` +
                                `✅ Session files deleted: ${deletedSessionCount}\n` +
                                `✅ Sender-key files deleted: ${deletedSenderKeyCount}\n` +
                                `✅ Pre-key files deleted: ${deletedPreKeyCount}\n` +
                                `❌ Failed to delete: ${failedCount} files\n\n` +
                                `Total files processed: ${filesToDelete.length}`;

            await sock.sendMessage(
                m.key.remoteJid,
                { text: responseText },
                { quoted: m }
            );

            logInfo(`Clean command executed by ${sender}: ${deletedSessionCount + deletedSenderKeyCount + deletedPreKeyCount} files deleted, ${failedCount} failed`);

        } catch (error) {
            logError(`Error in clean command: ${error.message}`);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: `❌ Error cleaning cache files: ${error.message}` },
                { quoted: m }
            );
        }
    }
};

// Add file watcher for hot reloading
fs.watchFile(__filename, () => {
    fs.unwatchFile(__filename);
    logInfo(`Updated ${__filename}`);
    delete require.cache[__filename];
    require(__filename);
});