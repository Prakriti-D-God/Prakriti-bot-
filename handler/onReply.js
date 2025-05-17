/**
 * OnReply handler for WhatsApp Bot
 * This module handles user replies to specific bot messages
 * that have been registered with yumi.onReply
 */

const { hasPermission } = require('../utils/permission');
const { logInfo, logSuccess, logError } = require('../utils/logger');
const { config } = require('../config/globals');

/**
 * Handles replies to messages that have been registered for callbacks
 * @param {Object} options - Message handling options
 * @param {Object} options.sock - Socket connection
 * @param {Object} options.m - Message object
 * @param {String} options.sender - Message sender
 * @param {String} options.botNumber - Bot's number
 * @returns {Boolean} - True if a reply was handled, false otherwise
 */
async function handleReply({ sock, m, sender, botNumber }) {
    try {
        // Check if this is a reply and if the global onReply map exists
        if (!m.message || !m.message.extendedTextMessage || !m.message.extendedTextMessage.contextInfo || 
            !m.message.extendedTextMessage.contextInfo.stanzaId || !global.yumi || !global.yumi.onReply) {
            return false;
        }

        // Get the ID of the message being replied to
        const repliedMsgId = m.message.extendedTextMessage.contextInfo.stanzaId;

        // Check if this reply is registered in our onReply map
        if (!global.yumi.onReply.has(repliedMsgId)) {
            return false;
        }

        // Get the reply data
        const replyData = global.yumi.onReply.get(repliedMsgId);

        // Add a delete method to remove the reply handler
        replyData.delete = () => {
            global.yumi.onReply.delete(repliedMsgId);
            if (config.logEvents.logCommands) {
                logInfo(`Deleted reply handler for message ID: ${repliedMsgId}`);
            }
        };

        // Store the bot number for message editing
        replyData.botNumber = botNumber;

        // Get user number (clean format for permission check)
        const userNumber = sender.replace(/[^0-9]/g, '');

        // Check if the command requires specific permissions
        if (replyData.permission !== undefined) {
            // Get group metadata if this is a group message
            let groupMetadata = null;
            if (m.key.remoteJid.endsWith('@g.us')) {
                try {
                    groupMetadata = await sock.groupMetadata(m.key.remoteJid);
                } catch (err) {
                    logError(`Failed to fetch group metadata: ${err.message}`);
                }
            }

            // Check if user has required permission level
            if (!hasPermission(userNumber, groupMetadata, replyData.permission)) {
                const permissionMessages = [
                    "This action is available to everyone.",
                    "This action requires Group Admin or Bot Admin privileges.",
                    "This action requires Bot Admin privileges."
                ];

                await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `⚠️ You don't have permission for this action. ${permissionMessages[replyData.permission]}` },
                    { quoted: m }
                );

                // Don't delete the handler so others can still use it
                return true;
            }
        }

        // Log execution
        if (config.logEvents.logCommands) {
            logSuccess(`${sender} executed reply handler for command: ${replyData.commandName || 'Unknown'}`);
        }

        // Execute the callback
        if (typeof replyData.callback === 'function') {
            await replyData.callback({
                sock,
                m,
                replyData,
                sender,
                botNumber,
                args: m.body ? m.body.trim().split(/ +/) : []
            });
        } else {
            logError(`Reply handler for message ID ${repliedMsgId} has no callback function`);
        }

        // Return true to indicate that a reply was handled
        return true;
    } catch (err) {
        logError(`Error in reply handler: ${err.message}`);
        console.error(err);
        return false;
    }
}

module.exports = { handleReply };