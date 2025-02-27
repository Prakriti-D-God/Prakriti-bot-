module.exports = {
 name: 'adduser',
 alias: ['add'],
 desc: 'Add a user to the group',
 usage: '+adduser <number>',
 category: 'group',
 permission: 2, // Bot Admin only

 async run({ sock, m, args }) {
 if (!m.key.remoteJid.endsWith('@g.us')) {
 return await sock.sendMessage(m.key.remoteJid, { text: '❌ This command can only be used in groups.' }, { quoted: m });
 }

 if (args.length === 0) {
 return await sock.sendMessage(m.key.remoteJid, { text: '⚠️ Please provide a phone number to add.' }, { quoted: m });
 }

 let number = args[0].replace(/\D/g, ''); // Remove non-numeric characters
 if (!number.endsWith('@s.whatsapp.net')) {
 number = number + '@s.whatsapp.net';
 }

 try {
 await sock.groupParticipantsUpdate(m.key.remoteJid, [number], 'add');
 await sock.sendMessage(m.key.remoteJid, { text: `✅ Successfully added @${number.split('@')[0]}`, mentions: [number] }, { quoted: m });
 } catch (error) {
 await sock.sendMessage(m.key.remoteJid, { text: `❌ Failed to add @${number.split('@')[0]}. Make sure the number is valid and can be added.` }, { quoted: m });
 }
 }
};