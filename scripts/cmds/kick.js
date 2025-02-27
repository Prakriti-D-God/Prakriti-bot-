module.exports = {
 name: 'kick',
 alias: ['remove'],
 desc: 'Remove a user from the group',
 usage: '+kick <number or mention>',
 category: 'group',
 permission: 2, // Bot Admin only

 async run({ sock, m, args }) {
 if (!m.key.remoteJid.endsWith('@g.us')) {
 return await sock.sendMessage(m.key.remoteJid, { text: '❌ This command can only be used in groups.' }, { quoted: m });
 }

 let number;
 if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo && m.message.extendedTextMessage.contextInfo.mentionedJid) {
 // If a user is mentioned
 number = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
 } else if (args.length > 0) {
 // If a number is provided manually
 number = args[0].replace(/\D/g, '') + '@s.whatsapp.net';
 } else {
 return await sock.sendMessage(m.key.remoteJid, { text: '⚠️ Please provide a phone number or mention a user to kick.' }, { quoted: m });
 }

 try {
 await sock.groupParticipantsUpdate(m.key.remoteJid, [number], 'remove');
 await sock.sendMessage(m.key.remoteJid, { text: `✅ Successfully removed @${number.split('@')[0]}`, mentions: [number] }, { quoted: m });
 } catch (error) {
 await sock.sendMessage(m.key.remoteJid, { text: `❌ Failed to remove @${number.split('@')[0]}. Make sure I have admin rights.` }, { quoted: m });
 }
 }
};