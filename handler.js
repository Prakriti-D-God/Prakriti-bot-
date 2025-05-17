const fs = require('fs');
const { getPermissionLevel, hasPermission, canUseBot } = require('./utils/permission');
const { logInfo, logSuccess, logError, logMessageDetails } = require('./utils/logger');
const { initializeGlobals, config } = require('./config/globals');
const CommandManager = require('./managers/CommandManager');
const EventManager = require('./managers/EventManager');
const { extractMessageContent } = require('./utils/messageParser');
const { smsg } = require('./utils/messageSerializer');
const { handleReply } = require('./handler/onReply');
const { handleReaction } = require('./handler/onReaction');

const commandManager = new CommandManager();
const eventManager = new EventManager();

initializeGlobals();

commandManager.loadCommands();
eventManager.loadEvents();

// Setup global error handlers
process.on('unhandledRejection', (reason, promise) => {
    logError(`Unhandled Rejection: ${reason}`);
    // Prevent process crash
});

// Helper function to log commands with status
const logCommand = (command, sender, success) => {
    if (success) {
        logSuccess(`${sender} executed: ${command}`);
    } else {
        logError(`${sender} failed to execute: ${command}`);
    }
};

// Safely fetch group metadata with retries
const safelyGetGroupMetadata = async (sock, jid, maxRetries = 3) => {
    let retries = maxRetries;
    let backoffTime = 1000; // Start with 1 second

    while (retries > 0) {
        try {
            const metadata = await sock.groupMetadata(jid);
            return metadata;
        } catch (err) {
            retries--;
            if (retries > 0) {
                logInfo(`Retrying group metadata fetch. Attempts remaining: ${retries}`);
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                backoffTime *= 2; // Double the wait time for next retry
            } else {
                logError(`Failed to fetch group metadata after ${maxRetries} attempts: ${err.message}`);
                // Return default metadata
                return { subject: 'Unknown Group', participants: [] };
            }
        }
    }
};

// Check connection status
const isConnectionActive = (sock) => {
    return sock && sock.user && sock.user.id;
};

module.exports = async (sock, mek, store, messageInfo = {}) => {
    try {
        // Validate connection first
        if (!isConnectionActive(sock)) {
            logError("WhatsApp connection is not active. Skipping message processing.");
            return;
        }

        const m = smsg(sock, mek, store);
        if (!m) return;

        // Auto-read message if configured
        if (config.messageHandling.autoRead) {
            try {
                await sock.readMessages([m.key]);
            } catch (readErr) {
                logError(`Failed to mark message as read: ${readErr.message}`);
                // Continue processing even if read fails
            }
        }

        // Extract message details
        const body = extractMessageContent(m) || '';
        const sender = m.key.fromMe
            ? sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id
            : m.key.participant || m.key.remoteJid;

        const botNumber = sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id;
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const isCmd = body.startsWith(global.prefix);
        const command = isCmd ? body.slice(global.prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);

        // Log incoming message details if configured
        if (config.logEvents.logMessages) {
            logInfo(`${isGroup ? 'Group' : 'Private'} message from ${sender}: ${body.substring(0, 50)}${body.length > 50 ? '...' : ''}`);
        }

        // Get group metadata if needed - with improved error handling
        let groupMetadata = null;
        let groupName = 'Unknown Group';

        if (isGroup) {
            try {
                // Use our safe function with retries
                groupMetadata = await safelyGetGroupMetadata(sock, m.key.remoteJid);
                groupName = groupMetadata.subject || 'Unknown Group';
            } catch (err) {
                // This catch is for unexpected errors in our safe function
                logError(`Unexpected error fetching group metadata: ${err.message}`);
                // Initialize with defaults so the rest of the code can continue
                groupMetadata = { subject: 'Unknown Group', participants: [] };
            }
        }

        // Log command detection if configured
        if (config.logEvents.logCommands && isCmd) {
            logInfo(`Command detected: ${command} from ${sender} in ${isGroup ? groupName : 'DM'}`);
        }

        // Process reactions if this is a reaction message
        if (messageInfo.isReaction) {
            // Add target message ID to messageInfo for reaction handler
            messageInfo.targetMessageID = m.message?.reactionMessage?.key?.id || 
                                        (m.message?.[Object.keys(m.message)[0]]?.contextInfo?.stanzaId);

            try {
                // Handle the reaction
                const isHandledReaction = await handleReaction({ sock, m, sender, botNumber, messageInfo });
                if (isHandledReaction) {
                    // If it was a handled reaction, we can skip normal command processing
                    return;
                }
            } catch (reactionErr) {
                logError(`Error handling reaction: ${reactionErr.message}`);
                // Continue with message processing even if reaction handling fails
            }
        }

        // Check if this is a reply to a message that has a registered handler
        try {
            const isHandledReply = await handleReply({ sock, m, sender, botNumber });
            if (isHandledReply) {
                // If it was a handled reply, we can skip normal command processing
                // Delete command message if enabled
                if (config.messageHandling.deleteCommandMessages) {
                    try {
                        await sock.sendMessage(m.key.remoteJid, { delete: m.key });
                    } catch (deleteErr) {
                        logError(`Failed to delete command message: ${deleteErr.message}`);
                    }
                }
                return;
            }
        } catch (replyErr) {
            logError(`Error handling reply: ${replyErr.message}`);
            // Continue with message processing even if reply handling fails
        }

        // Handle commands
        if (isCmd && global.commands.has(command)) {
            // Extract clean user number 
            const userNumber = sender.replace(/[^0-9]/g, '');

            // Check if user can use the bot at all based on global settings
            if (!canUseBot(userNumber)) {
                try {
                    await sock.sendMessage(
                        m.key.remoteJid,
                        { text: `⚠️ You don't have permission to use this bot.` },
                        { quoted: m }
                    );
                } catch (sendErr) {
                    logError(`Failed to send permission denial message: ${sendErr.message}`);
                }
                return;
            }

            const cmd = global.commands.get(command);

            // Default permission level is 0 if not specified in command
            const requiredPermission = cmd.permission || 0;

            // Check if user has the required permission level
            if (!hasPermission(userNumber, groupMetadata, requiredPermission)) {
                const permissionMessages = [
                    "This command is available to everyone.",
                    "This command requires Group Admin or Bot Admin privileges.",
                    "This command requires Bot Admin privileges."
                ];

                try {
                    await sock.sendMessage(
                        m.key.remoteJid,
                        { text: `⚠️ You don't have permission to use "${cmd.name}". ${permissionMessages[requiredPermission]}` },
                        { quoted: m }
                    );
                } catch (sendErr) {
                    logError(`Failed to send permission message: ${sendErr.message}`);
                }
                return;
            }

            // Check for cooldown
            const cooldownTime = commandManager.checkCooldown(command, sender);
            if (cooldownTime) {
                try {
                    await sock.sendMessage(
                        m.key.remoteJid,
                        { text: `⏳ Please wait ${cooldownTime}s before using "${command}" again.` },
                        { quoted: m }
                    );
                } catch (sendErr) {
                    logError(`Failed to send cooldown message: ${sendErr.message}`);
                }
                return;
            }

            // Apply command cooldown before execution to prevent spam
            commandManager.applyCooldown(command, sender);

            // Execute the command
            try {
                await cmd.run({ 
                    sock, 
                    m, 
                    args, 
                    sender, 
                    botNumber, 
                    messageInfo,
                    groupMetadata,
                    groupName,
                    isGroup
                });

                // Log successful command execution
                if (config.logEvents.logCommands) {
                    logCommand(command, sender, true);
                }
            } catch (error) {
                logError(`Error executing command ${command}: ${error.message}`);
                try {
                    await sock.sendMessage(
                        m.key.remoteJid,
                        { text: `❌ Error executing command: ${error.message}` },
                        { quoted: m }
                    );
                } catch (sendErr) {
                    logError(`Failed to send error message: ${sendErr.message}`);
                }

                // Log failed command execution
                if (config.logEvents.logCommands) {
                    logCommand(command, sender, false);
                }
            }

            // Delete command message if enabled
            if (config.messageHandling.deleteCommandMessages) {
                try {
                    await sock.sendMessage(m.key.remoteJid, { delete: m.key });
                } catch (deleteErr) {
                    logError(`Failed to delete command message: ${deleteErr.message}`);
                }
            }

        } else if (isCmd) {
            // Command not found response
            try {
                await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `Command "${command}" not found. Try ${global.prefix}help for a list of commands.` },
                    { quoted: m }
                );
            } catch (sendErr) {
                logError(`Failed to send command not found message: ${sendErr.message}`);
            }
        }

        // Handle custom events
        try {
            eventManager.handleEvents({ 
                sock, 
                m, 
                sender, 
                messageInfo,
                groupMetadata,
                groupName,
                isGroup
            });
        } catch (eventErr) {
            logError(`Error in event handler: ${eventErr.message}`);
        }

    } catch (err) {
        if (config.logEvents.logErrors) {
            logError(`Critical error in main handler: ${err.message}`);
            console.error(err); // Log the full error stack for debugging
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