const { logError } = require('../utils/logger');

function initializeMessageListener(ptz, store) {
    ptz.ev.on('messages.upsert', async (chatUpdate) => {
        try {
            if (!chatUpdate || !chatUpdate.messages || chatUpdate.messages.length === 0) return;

            let mek = chatUpdate.messages[0];

            if (!mek.message) return;
            
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') 
                ? mek.message.ephemeralMessage.message 
                : mek.message;

            if (mek.key && mek.key.remoteJid === 'status@broadcast') return;
            if (!ptz.public && !mek.key.fromMe && chatUpdate.type === 'notify') return;
            if (mek.key.id && mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return;

            
            require("../handler")(ptz, mek, store);
        } catch (err) {
            logError(`Error in messageListener: ${err.message}`);
        }
    });
}

module.exports = { initializeMessageListener };
