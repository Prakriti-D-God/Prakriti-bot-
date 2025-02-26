const fs = require('fs');
const { getPermissionLevel, hasPermission, canUseBot } = require('./utils/permission');
const { logInfo, logSuccess, logError, logMessageDetails } = require('./utils/logger');
const { initializeGlobals, config } = require('./config/globals');
const CommandManager = require('./managers/CommandManager');
const EventManager = require('./managers/EventManager');
const { extractMessageContent } = require('./utils/messageParser');
const { smsg } = require('./utils/messageSerializer');

const commandManager = new CommandManager();
const eventManager = new EventManager();

initializeGlobals();

commandManager.loadCommands();
eventManager.loadEvents();

module.exports = async (sock, mek, store) => {
    try {
        const m = smsg(sock, mek, store);
        if (!m) return;

        if (config.messageHandling.autoRead) {
            await sock.readMessages([m.key]);
        }

        const body = extractMessageContent(m) || '';
        const sender = m.key.fromMe
            ? sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id
            : m.key.participant || m.key.remoteJid;

        const botNumber = sock.user.id.includes(':') ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : sock.user.id;
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const isCmd = body.startsWith(global.prefix);
        const command = isCmd ? body.slice(global.prefix.length).trim().split(' ').shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);

        let groupMetadata = null;
        let groupName = '';
        if (isGroup) {
            try {
                groupMetadata = await sock.groupMetadata(m.key.remoteJid);
                groupName = groupMetadata.subject || 'Unknown Group';
            } catch (err) {
                if (config.logEvents.logErrors) {
                    logError(`Failed to fetch group metadata: ${err.message}`);
                }
            }
        }

        if (config.messageHandling.logMessages) {
            logMessageDetails({
                ownerId: global.owner,
                sender: sender,
                groupName: groupName,
                message: body,
                reactions: m.message?.reaction ? {
                    user: m.message.reaction.userJid,
                    emoji: m.message.reaction.emoji
                } : null,
                timezone: config.botSettings.timeZone
            });
        }

        // Handle commands
        if (isCmd && global.commands.has(command)) {
            // Extract clean user number 
            const userNumber = sender.replace(/[^0-9]/g, '');

            // Check if user can use the bot at all based on global settings
            if (!canUseBot(userNumber)) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `⚠️ You don't have permission to use this bot.` },
                    { quoted: m }
                );
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

                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `⚠️ You don't have permission to use "${cmd.name}". ${permissionMessages[requiredPermission]}` },
                    { quoted: m }
                );
            }

            // Check for cooldown
            const cooldownTime = commandManager.checkCooldown(command, sender);
            if (cooldownTime) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `⏳ Please wait ${cooldownTime}s before using "${command}" again.` },
                    { quoted: m }
                );
            }

            // Log command execution
            if (config.logEvents.logCommands) {
                logSuccess(`${sender} executed: ${command}`);
            }

            // Execute the command
            try {
                await cmd.run({ sock, m, args, sender, botNumber });
            } catch (error) {
                logError(`Error executing command ${command}: ${error.message}`);
                await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `❌ Error executing command: ${error.message}` },
                    { quoted: m }
                );
            }

            // Delete command message if enabled
            if (config.messageHandling.deleteCommandMessages) {
                await sock.sendMessage(m.key.remoteJid, { delete: m.key });
            }
        } else if (isCmd) {
            // Command not found response
            await sock.sendMessage(
                m.key.remoteJid,
                { text: `Command "${command}" not found. Try ${global.prefix}help for a list of commands.` },
                { quoted: m }
            );
        }

        eventManager.handleEvents({ sock, m, sender });

    } catch (err) {
        if (config.logEvents.logErrors) {
            logError(`Error in handler: ${err.message}`);
        }
    }
};

fs.watchFile(__filename, () => {
    fs.unwatchFile(__filename);
    logInfo(`Updated ${__filename}`);
    delete require.cache[__filename];
    require(__filename);
});