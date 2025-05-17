/**
 * Message Editor Utility
 * Provides helper functions for editing messages in WhatsApp
 */

/**
 * Edit a previously sent message
 * @param {Object} sock - Socket connection
 * @param {String} jid - Chat ID to send the message to
 * @param {String} text - New text content
 * @param {Object} key - Message key of the message to edit
 * @returns {Promise} - Promise resolving to the edited message
 */
async function editMessage(sock, jid, text, key) {
    try {
        return await sock.sendMessage(jid, {
            text: text,
            edit: {
                key: {
                    remoteJid: jid,
                    id: key.id,
                    fromMe: true
                }
            }
        });
    } catch (error) {
        console.error("Error editing message:", error);
        throw error;
    }
}

/**
 * Fallback method to handle message editing
 * Sends a new message quoting the original if editing fails
 * @param {Object} sock - Socket connection
 * @param {String} jid - Chat ID to send the message to
 * @param {String} text - New text content
 * @param {Object} key - Message key to quote
 * @returns {Promise} - Promise resolving to the new message
 */
async function editMessageFallback(sock, jid, text, key) {
    try {
        return await sock.sendMessage(jid, {
            text: text,
            quoted: { key: key }
        });
    } catch (error) {
        console.error("Error with edit fallback:", error);
        throw error;
    }
}

module.exports = {
    editMessage,
    editMessageFallback
};