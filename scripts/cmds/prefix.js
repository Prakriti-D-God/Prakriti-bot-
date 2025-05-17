const fs = require('fs');
const { logInfo, logSuccess, logError } = require('../../utils/logger');
const { hasPermission } = require('../../utils/permission');
const { registerReactionHandler } = require('../../handler/onReaction');

module.exports = {
    name: "prefix",
    version: "1.1",
    author: "YumiBot",
    permission: 0,
    cooldown: 5,
    description: "Change the command prefix for this chat or for the entire bot",
    category: "config",
    usage: "prefix (shows current prefix) | prefix + (changes chat-specific prefix) | prefix + -g (changes global prefix) | prefix reset",
    // Setting this to true marks this as a non-prefix command that can be triggered by just the keyword
    noPrefix: true,

    run: async function({ sock, m, args, sender, botNumber, groupMetadata, isGroup, body, isCommand }) {
        try {
            const chatId = m.key.remoteJid;
            const currentPrefix = global.prefix;
            const userNumber = sender.replace(/[^0-9]/g, '');

            // Initialize threadData if not exists
            if (!global.yumi) global.yumi = {};
            if (!global.yumi.threadData) global.yumi.threadData = new Map();

            // Get thread-specific prefix
            const threadData = global.yumi.threadData.get(chatId) || { data: {} };
            const threadPrefix = threadData.data?.prefix || global.prefix;

            // Check if this was triggered without prefix (just saying "prefix")
            const isPrefixCheck = !isCommand && body.trim().toLowerCase() === "prefix";

            // If no arguments or just checking prefix status with the keyword "prefix"
            if (!args[0] || isPrefixCheck) {
                await sock.sendMessage(
                    chatId,
                    { text: `🌐 System prefix: ${global.prefix}\n🛸 Current chat prefix: ${threadPrefix}` },
                    { quoted: m }
                );
                return;
            }

            // From here onwards, we need the command to be prefixed
            if (!isCommand) {
                // If user tries to change prefix without using the prefix command properly, ignore
                return;
            }

            // Handle reset command
            if (args[0].toLowerCase() === 'reset') {
                threadData.data.prefix = null;
                global.yumi.threadData.set(chatId, threadData);

                // Save thread data to disk - persistent storage
                try {
                    saveThreadData();
                } catch (err) {
                    logError(`Failed to save thread data: ${err.message}`);
                }

                await sock.sendMessage(
                    chatId,
                    { text: `✅ Your prefix has been reset to default: ${global.prefix}` },
                    { quoted: m }
                );
                return;
            }

            const newPrefix = args[0];
            const isGlobal = args[1] === "-g";

            // Check permissions for global prefix change
            if (isGlobal && !hasPermission(userNumber, groupMetadata, 2)) {
                await sock.sendMessage(
                    chatId,
                    { text: "⚠️ Only bot admins can change the global prefix." },
                    { quoted: m }
                );
                return;
            }

            const confirmText = isGlobal 
                ? `Please react to this message to confirm changing the global bot prefix to "${newPrefix}"\n\nUsing ${currentPrefix}prefix ${newPrefix} -g changes the prefix for the entire system.`
                : `Please react to this message to confirm changing the prefix for this chat to "${newPrefix}"\n\nUsing ${currentPrefix}prefix ${newPrefix} changes the prefix only for this specific chat.`;

            const sentMsg = await sock.sendMessage(
                chatId,
                { text: confirmText },
                { quoted: m }
            );

            // Register reaction handler
            registerReactionHandler({
                messageId: sentMsg.key.id,
                commandName: "prefix",
                permission: 0,
                notifyErrors: true,
                autoDelete: true,
                expireAfter: 60000, // 1 minute timeout
                callback: async ({ reaction, sock, m, sender, targetMessageID, chatId, userNumber: reactionUserNumber, delete: deleteHandler }) => {
                    try {
                        // Make sure it's the same user who initiated the command
                        if (reactionUserNumber !== userNumber) {
                            return;
                        }

                        if (isGlobal) {
                            // Update global prefix
                            global.prefix = newPrefix;

                            try {
                                // Update config file
                                const configPath = './config.json';
                                if (fs.existsSync(configPath)) {
                                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                                    config.botSettings.prefix = newPrefix;
                                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                                    logSuccess(`Global prefix updated to ${newPrefix} in config file`);
                                }
                            } catch (err) {
                                logError(`Failed to update config file: ${err.message}`);
                            }

                            await sock.sendMessage(
                                chatId,
                                { text: `✅ Changed global bot prefix to: ${newPrefix}` },
                                { quoted: m }
                            );
                        } else {
                            // Update thread-specific prefix
                            threadData.data.prefix = newPrefix;
                            global.yumi.threadData.set(chatId, threadData);

                            // Save thread data to disk - persistent storage
                            try {
                                saveThreadData();
                            } catch (err) {
                                logError(`Failed to save thread data: ${err.message}`);
                            }

                            await sock.sendMessage(
                                chatId,
                                { text: `✅ Changed prefix for this chat to: ${newPrefix}` },
                                { quoted: m }
                            );
                        }
                    } catch (err) {
                        logError(`Error in prefix reaction handler: ${err.message}`);
                        await sock.sendMessage(
                            chatId,
                            { text: `❌ Error changing prefix: ${err.message}` },
                            { quoted: m }
                        );
                    }
                }
            });

        } catch (err) {
            logError(`Error in prefix command: ${err.message}`);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: `❌ Error: ${err.message}` },
                { quoted: m }
            );
        }
    }
};

// Function to save thread data to disk
function saveThreadData() {
    if (!global.yumi || !global.yumi.threadData) return;

    // Convert Map to object for storage
    const threadDataObj = {};
    global.yumi.threadData.forEach((value, key) => {
        threadDataObj[key] = value;
    });

    // Save to file
    const dataPath = './database/threadData.json';

    // Ensure directory exists
    const dir = './database';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(dataPath, JSON.stringify(threadDataObj, null, 2));
    logInfo('Thread data saved to disk');
}