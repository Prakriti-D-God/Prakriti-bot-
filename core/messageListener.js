const { logError } = require('../utils/logger');

function initializeMessageListener(ptz, store) {
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

            // Remove restriction on public/private mode to allow all messages
            // This ensures the bot reads messages from groups, individuals, and itself
            // Previously, this condition was blocking messages from other users
            // if (!ptz.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;

            // Allow all messages, including group messages (@g.us) and private messages (@s.whatsapp.net)
            console.log(`Received message from: ${mek.key.remoteJid}`);

            // Process the message
            require("../handler")(ptz, mek, store);
        } catch (err) {
            logError(`Error in messageListener: ${err.message}`);
        }
    });
}

module.exports = { initializeMessageListener };