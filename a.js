//handler.js
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

//core/messageListener.js
//core/messageListener.js
const { logError, logMessage } = require('../utils/logger');
const { config } = require('../config/globals');

function initializeMessageListener(ptz, store) {
    // Handle regular messages
    ptz.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!chatUpdate || !chatUpdate.messages || chatUpdate.messages.length === 0) return;

            let mek = chatUpdate.messages[0];
            if (!mek.message) return;

            // Handle ephemeral messages
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') 
                ? mek.message.ephemeralMessage.message 
                : mek.message;

            // Ignore status updates
            if (mek.key && mek.key.remoteJid === 'status@broadcast') return;

            // Get sender info
            const sender = mek.key.fromMe
                ? ptz.user.id.split(':')[0] + '@s.whatsapp.net'
                : mek.key.participant || mek.key.remoteJid;

            const senderNumber = sender.replace(/[^0-9]/g, ''); // Extract only numbers

            // Determine message type
            let messageType = 'unknown';
            let chatName = '';

            // Check if it's a group message
            const isGroup = mek.key.remoteJid.endsWith('@g.us');
            // Check if it's a community message (communities have a different structure)
            const isCommunity = isGroup && mek.message?.senderKeyDistributionMessage?.groupId;
            // Check if it's a channel message
            const isChannel = mek.key.remoteJid.endsWith('@newsletter');
            // Check if it's a private chat
            const isPrivate = !isGroup && !isChannel;

            if (isPrivate) {
                messageType = 'private';
                // Try to get contact name
                try {
                    const contact = await ptz.contactsStore.contacts[sender];
                    chatName = contact?.name || contact?.notify || senderNumber;
                } catch (err) {
                    chatName = senderNumber;
                }
            } else if (isGroup) {
                if (isCommunity) {
                    messageType = 'community';
                    try {
                        // Get community and group name
                        const communityInfo = await ptz.groupMetadata(mek.message.senderKeyDistributionMessage.groupId);
                        const groupInfo = await ptz.groupMetadata(mek.key.remoteJid);
                        chatName = `${communityInfo.subject} > ${groupInfo.subject}`;
                    } catch (err) {
                        chatName = 'Unknown Community';
                    }
                } else {
                    messageType = 'group';
                    try {
                        // Get group name
                        const groupInfo = await ptz.groupMetadata(mek.key.remoteJid);
                        chatName = groupInfo.subject;
                    } catch (err) {
                        chatName = 'Unknown Group';
                    }
                }
            } else if (isChannel) {
                messageType = 'channel';
                try {
                    // Get channel name
                    const channelInfo = await ptz.channelMetadata(mek.key.remoteJid);
                    chatName = channelInfo.subject;
                } catch (err) {
                    chatName = 'Unknown Channel';
                }
            }

            // Get message content type
            const contentType = Object.keys(mek.message)[0];

            // Check for attachments
            let hasAttachment = false;
            let attachmentType = null;

            // Fix: Check for attachments in all message types
            if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(contentType)) {
                hasAttachment = true;
                attachmentType = contentType.replace('Message', '');
            } else {
                // Check for attachments in other message types (like extendedTextMessage)
                const contentObj = mek.message[contentType];
                if (contentObj?.contextInfo?.quotedMessage) {
                    const quotedType = Object.keys(contentObj.contextInfo.quotedMessage)[0];
                    if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(quotedType)) {
                        // The quoted message has an attachment
                        hasAttachment = true;
                        attachmentType = `quoted-${quotedType.replace('Message', '')}`;
                    }
                }
            }

            // FIX: Check if this is a reaction message specifically
            const isReaction = contentType === 'reactionMessage' || 
                               (mek.message[contentType]?.contextInfo?.hasOwnProperty('reactionMessage'));

            let reaction = null;

            // Fix: Properly extract reaction data
            if (isReaction) {
                if (contentType === 'reactionMessage') {
                    // Direct reaction message
                    reaction = mek.message.reactionMessage.text;
                } else if (mek.message[contentType]?.contextInfo?.reactionMessage) {
                    // Reaction in context info
                    reaction = mek.message[contentType].contextInfo.reactionMessage.text;
                }
            }

            // Check if message is forwarded
            const isForwarded = mek.message[contentType]?.contextInfo?.isForwarded || false;

            // Check if message is a reply
            const isReply = mek.message[contentType]?.contextInfo?.quotedMessage ? true : false;
            let repliedTo = null;

            if (isReply) {
                const quotedSender = mek.message[contentType].contextInfo.participant;
                const quotedSenderName = quotedSender ? await getSenderName(ptz, quotedSender) : 'Unknown';
                const quotedMsgType = Object.keys(mek.message[contentType].contextInfo.quotedMessage)[0];
                const quotedMsg = getTextContent(mek.message[contentType].contextInfo.quotedMessage);
                repliedTo = `@${quotedSenderName} - "${quotedMsg?.substring(0, 20)}${quotedMsg?.length > 20 ? '...' : ''}"`;
            }

            // Get timestamp
            const timestamp = new Date(mek.messageTimestamp * 1000).toLocaleTimeString();

            // Get message text content - Fix: Enhanced function call
            const messageText = getTextContent(mek.message);

            // Use the new optimized logging function
            logMessage({
                messageType,
                chatName,
                sender,
                senderName: await getSenderName(ptz, sender),
                messageText,
                hasAttachment,
                attachmentType,
                isForwarded,
                isReply,
                repliedTo,
                isReaction,
                reaction,
                timestamp,
                fromMe: mek.key.fromMe
            });

            // Admin Only Mode
            if (config.adminOnly.enable && !config.adminOnly.adminNumbers.includes(senderNumber) && !mek.key.fromMe) {
                console.log("❌ Message blocked (Admin Only Mode)");
                return;
            }

            // Whitelist Mode
            if (config.whiteListMode.enable && !config.whiteListMode.allowedNumbers.includes(senderNumber) && !mek.key.fromMe) {
                console.log("❌ Message blocked (Whitelist Mode)");
                return;
            }

            // Process the message
            require("../handler")(ptz, mek, store, {
                messageType, 
                chatName, 
                hasAttachment,
                attachmentType,
                isForwarded,
                isReply,
                repliedTo,
                isReaction,
                reaction,
                timestamp
            });
        } catch (err) {
            logError(`❌ Error in messageListener: ${err.message}`);
            console.error(err); // Log the full error for debugging
        }
    });

    // Rest of the event listeners remain unchanged
    // Listen for group participants update (Join/Leave)
    ptz.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            if (!id || !participants || !action) return;

            // Get group info
            let groupName = 'Unknown Group';
            try {
                const groupInfo = await ptz.groupMetadata(id);
                groupName = groupInfo.subject;
            } catch (err) {
                // Couldn't get group name
            }

            if (action === 'remove') {
                console.log(`\n🚪 User left: ${participants[0]} from group ${groupName} (${id})`);
                // Optional: Add anti-out logic here
            } else if (action === 'add') {
                console.log(`\n👤 User added: ${participants[0]} to group ${groupName} (${id})`);
                // Optional: Add welcome logic here
            }
        } catch (err) {
            logError(`❌ Error in group update listener: ${err.message}`);
            console.error(err); // Log the full error for debugging
        }
    });

    // Listen for call events
    ptz.ev.on('call', async (callUpdate) => {
        try {
            for (const call of callUpdate) {
                if (call.status === "MISSED") {
                    console.log(`\n📞 Missed Call Notification`);
                    console.log(`📞 Caller: ${call.from}`);
                    console.log(`📌 Call Type: ${call.isVideo ? 'Video Call' : 'Voice Call'}`);
                    console.log(`❌ Missed Call at ${new Date(call.timestamp * 1000).toLocaleTimeString()}`);
                } else if (call.status === "INCOMING") {
                    console.log(`\n📞 Incoming ${call.isVideo ? 'Video' : 'Voice'} Call`);
                    console.log(`📞 Caller: ${await getSenderName(ptz, call.from)}`);
                    console.log(`📌 Call Type: ${call.isVideo ? 'Video Call' : 'Voice Call'}`);
                    console.log(`📲 Incoming Call at ${new Date(call.timestamp * 1000).toLocaleTimeString()}`);
                    console.log(`🔔 Status: Ringing...`);
                }
            }
        } catch (err) {
            logError(`❌ Error in call listener: ${err.message}`);
            console.error(err);
        }
    });

    // Listen for contacts update (joined WhatsApp)
    ptz.ev.on('contacts.update', async (contacts) => {
        try {
            for (const contact of contacts) {
                if (contact.notify && contact.status === 200) {
                    console.log(`\n✅ Contact Joined WhatsApp`);
                    console.log(`👤 New Contact: ${contact.notify} (${contact.id})`);
                    console.log(`🔔 Notification: ${contact.notify} just joined WhatsApp!`);
                }
            }
        } catch (err) {
            logError(`❌ Error in contacts update listener: ${err.message}`);
            console.error(err);
        }
    });

    // Listen for group invitations
    ptz.ev.on('groups.invite', async (invite) => {
        try {
            console.log(`\n🔔 Group Invitation Received`);
            console.log(`📩 Invitation to Join: ${invite.subject || 'Unknown Group'}`);
            console.log(`👤 Invited by: ${await getSenderName(ptz, invite.creator)}`);
            console.log(`📨 Accept or Decline?`);
        } catch (err) {
            logError(`❌ Error in group invitation listener: ${err.message}`);
            console.error(err);
        }
    });
}

// Helper function to get text content from different message types - IMPROVED
function getTextContent(messageContent) {
    if (!messageContent) return null;

    // Check for direct message types
    if (messageContent.conversation) return messageContent.conversation;
    if (messageContent.extendedTextMessage?.text) return messageContent.extendedTextMessage.text;
    if (messageContent.imageMessage?.caption) return messageContent.imageMessage.caption;
    if (messageContent.videoMessage?.caption) return messageContent.videoMessage.caption;
    if (messageContent.documentMessage?.caption) return messageContent.documentMessage.caption;

    // If none of the above, check each property for text content
    for (const key in messageContent) {
        if (key === 'contextInfo' || key === 'messageContextInfo') continue;

        const content = messageContent[key];
        if (typeof content === 'object' && content !== null) {
            // Check if this object has text or caption
            if (content.text) return content.text;
            if (content.caption) return content.caption;

            // For reaction messages
            if (key === 'reactionMessage' && content.text) {
                return `Reaction: ${content.text}`;
            }
        }
    }

    return null;
}

// Helper function to get sender name
async function getSenderName(ptz, jid) {
    try {
        const contactInfo = await ptz.contactsStore.contacts[jid];
        return contactInfo?.name || contactInfo?.notify || jid.replace(/[^0-9]/g, '');
    } catch (err) {
        return jid.replace(/[^0-9]/g, '');
    }
}

module.exports = { initializeMessageListener };