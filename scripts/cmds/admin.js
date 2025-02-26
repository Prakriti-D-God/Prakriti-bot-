const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '../../config.json'); 
let config = require(configPath);

module.exports = {
 name: 'admin',
 alias: ['-a', '-r'],
 desc: 'Manage bot admins',
 usage: '+admin list | +admin add @user | +admin remove @user',
 category: 'admin',
 permission: 2,

 async run({ sock, m, args }) {
 if (!m.key.fromMe && !config.adminOnly.adminNumbers.includes(m.sender.replace(/[^0-9]/g, ''))) {
 return await sock.sendMessage(m.key.remoteJid, { text: '❌ Only bot admins can use this!' }, { quoted: m });
 }

 const action = args[0]?.toLowerCase();
 const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid;
 const adminList = config.adminOnly.adminNumbers.filter(n => n);

 if (!action || action === 'list') {
 return await sock.sendMessage(m.key.remoteJid, { 
 text: `📜 *Bot Admins:*\n${adminList.length ? adminList.map(n => `- @${n}`).join('\n') : 'No bot admins.'}`,
 mentions: adminList.map(n => `${n}@s.whatsapp.net`)
 }, { quoted: m });
 }

 if (!mentionedJid || mentionedJid.length === 0) {
 return await sock.sendMessage(m.key.remoteJid, { text: '❌ Please mention a user!' }, { quoted: m });
 }

 const targetNumber = mentionedJid[0].replace(/[^0-9]/g, '');

 if (action === 'add' || action === '-a') {
 if (adminList.includes(targetNumber)) {
 return await sock.sendMessage(m.key.remoteJid, { text: '⚠️ User is already a bot admin!' }, { quoted: m });
 }
 config.adminOnly.adminNumbers.push(targetNumber);
 } else if (action === 'remove' || action === '-r') {
 if (!adminList.includes(targetNumber)) {
 return await sock.sendMessage(m.key.remoteJid, { text: '⚠️ User is not a bot admin!' }, { quoted: m });
 }
 config.adminOnly.adminNumbers = config.adminOnly.adminNumbers.filter(n => n !== targetNumber);
 } else {
 return await sock.sendMessage(m.key.remoteJid, { text: '❌ Invalid action! Use `+admin list`, `+admin add @user`, or `+admin remove @user`' }, { quoted: m });
 }

 fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

 await sock.sendMessage(m.key.remoteJid, { 
 text: `✅ Successfully ${action === 'add' || action === '-a' ? 'added' : 'removed'} @${targetNumber} as a bot admin!`,
 mentions: [mentionedJid[0]]
 });
 }
};