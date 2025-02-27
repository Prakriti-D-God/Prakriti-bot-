module.exports = {
 name: "all",
 description: "Tags all members with an optional message.",
 permission: 1, // Requires Group Admin or Bot Admin
 async run({ sock, m, args }) {
 try {
 const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
 const participants = groupMetadata.participants;

 if (participants.length === 0) {
 return await sock.sendMessage(m.key.remoteJid, {
 text: "❌ No members found in the group."
 }, { quoted: m });
 }

 const message = args.length > 0 ? args.join(" ") : "Everyone!";
 const mentions = participants.map((p) => p.id);
 
 // Get member names
 const names = participants.map((p) => p.notify || p.id.split('@')[0]);

 const tagMessage = names.map((name, index) => `@${name}`).join(' ');

 await sock.sendMessage(m.key.remoteJid, {
 text: `${message}\n\n${tagMessage}`,
 mentions
 }, { quoted: m });

 } catch (err) {
 console.error(`Error executing command: ${err.message}`);
 await sock.sendMessage(m.key.remoteJid, {
 text: `❌ Error executing command: ${err.message}`
 }, { quoted: m });
 }
 }
};