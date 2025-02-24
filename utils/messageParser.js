const { config } = require('../config/globals');

const extractMessageContent = (m) => {
    if (!m || !m.message) {
        console.error("extractMessageContent: Invalid or undefined message object received.");
        return '';
    }

    const types = {
        'conversation': msg => msg.message.conversation || '',
        'imageMessage': msg => msg.message.imageMessage?.caption || '',
        'documentMessage': msg => msg.message.documentMessage?.caption || '',
        'videoMessage': msg => msg.message.videoMessage?.caption || '',
        'extendedTextMessage': msg => msg.message.extendedTextMessage?.text || '',
        'buttonsResponseMessage': msg => msg.message.buttonsResponseMessage?.selectedButtonId || '',
        'templateButtonReplyMessage': msg => msg.message.templateButtonReplyMessage?.selectedId || ''
    };

    return types[m.mtype] ? types[m.mtype](m) : '';
};

module.exports = { extractMessageContent };