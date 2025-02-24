const { proto: baileysProto, getContentType, jidDecode } = require("@whiskeysockets/baileys");

function smsg(ptz, m, store) {
    if (!m) return m;
    let M = baileysProto.WebMessageInfo;

    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');

        
        const senderJid = m.fromMe ? ptz.user.id : (m.participant || m.key.participant || m.chat || '');
        m.sender = jidDecode(senderJid)?.user || senderJid;

        if (m.isGroup) {
            m.participant = jidDecode(m.key.participant)?.user || m.key.participant || '';
        }
    }

    if (m.message) {
        m.mtype = getContentType(m.message);
        m.msg = (m.mtype == 'viewOnceMessage') 
            ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)]
            : m.message[m.mtype];

        m.body = m.message.conversation || m.msg?.caption || m.msg?.text 
            || (m.mtype == 'listResponseMessage' && m.msg?.singleSelectReply?.selectedRowId)
            || (m.mtype == 'buttonsResponseMessage' && m.msg?.selectedButtonId)
            || (m.mtype == 'viewOnceMessage' && m.msg?.caption) 
            || m.text;

        if (m.msg?.contextInfo?.quotedMessage) {
            m.quoted = m.msg.contextInfo.quotedMessage;
        }
    }

    return m;
}

module.exports = { smsg };