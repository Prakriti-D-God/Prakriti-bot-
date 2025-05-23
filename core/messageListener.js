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