const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

async function downloadMedia(message) {
    let mime = (message.msg || message).mimetype || '';
    let messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
    const stream = await downloadContentFromMessage(message, messageType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

function initializeMediaHandlers(ptz) {
    ptz.sendText = (jid, text, quoted = '', options) => 
        ptz.sendMessage(jid, { text: text, ...options }, { quoted });

    ptz.downloadMediaMessage = downloadMedia;
}

module.exports = { initializeMediaHandlers };
