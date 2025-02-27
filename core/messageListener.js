const { logError } = require('../utils/logger');
const { config } = require('../config/globals');

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

            // Get sender info
            const sender = mek.key.fromMe
                ? ptz.user.id.split(':')[0] + '@s.whatsapp.net'
                : mek.key.participant || mek.key.remoteJid;

            const senderNumber = sender.replace(/[^0-9]/g, ''); // Extract only numbers

            // Debugging Log
            console.log(`📩 Received message from: ${sender} (${senderNumber})`);

            // Admin Only Mode
            if (config.adminOnly.enable && !config.adminOnly.adminNumbers.includes(senderNumber)) {
                console.log("❌ Message blocked (Admin Only Mode)");
                return;
            }

            // Whitelist Mode
            if (config.whiteListMode.enable && !config.whiteListMode.allowedNumbers.includes(senderNumber)) {
                console.log("❌ Message blocked (Whitelist Mode)");
                return;
            }

            // Process the message
            require("../handler")(ptz, mek, store);
        } catch (err) {
            logError(`❌ Error in messageListener: ${err.message}`);
            console.error(err); // Log the full error for debugging
        }
    });

    // Listen for group participants update (Join/Leave)
    ptz.ev.on('group-participants.update', async (update) => {
        try {
            const { id, participants, action } = update;
            if (!id || !participants || !action) return;

            if (action === 'remove') {
                console.log(`🚪 User left: ${participants[0]} in group ${id}`);
                // Optional: Add anti-out logic here
            } else if (action === 'add') {
                console.log(`👤 User added: ${participants[0]} in group ${id}`);
                // Optional: Add welcome logic here
            }
        } catch (err) {
            logError(`❌ Error in group update listener: ${err.message}`);
            console.error(err); // Log the full error for debugging
        }
    });
}

module.exports = { initializeMessageListener };