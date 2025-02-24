const fs = require('fs');
const { getPermissionLevel } = require('./utils/permission');
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
      
        if (isCmd && global.commands.has(command)) {
            
            if (!commandManager.canExecuteCommand(sender)) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `You don't have permission to use bot commands.` },
                    { quoted: m }
                );
            }

            const cmd = global.commands.get(command);
            const permissionLevel = getPermissionLevel(sender.replace(/[^0-9]/g, ''), groupMetadata);

            if (cmd.permission > permissionLevel) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `You don't have permission to use "${cmd.name}".` },
                    { quoted: m }
                );
            }

            const cooldownTime = commandManager.checkCooldown(command, sender);
            if (cooldownTime) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `You're using "${command}" too fast. Wait ${cooldownTime}s.` },
                    { quoted: m }
                );
            }

            if (config.logEvents.logCommands) {
                logSuccess(`${sender} executed: ${command}`);
            }

        
            await cmd.run({ sock, m, args, sender, botNumber });

      
            if (config.messageHandling.deleteCommandMessages) {
                await sock.sendMessage(m.key.remoteJid, { delete: m.key });
            }
        } else if (isCmd) {
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
