const fs = require('fs');
const path = require('path');
const { logSuccess, logError } = require('../../utils/logger');

module.exports = {
 name: 'cmd',
 alias: ['command'],
 desc: 'Manage command and event files',
 usage: 'cmd [action] [filename] [code]',
 category: 'admin',
 permission: 2,

 async run({ sock, m, args }) {
 if (!args[0]) {
 const sentMsg = await sock.sendMessage(m.key.remoteJid, { text: "Processing..." }, { quoted: m });

 const helpText = `Available actions:\n\n` +
 `• cmd load <filename>\n` +
 `• cmd loadall\n` +
 `• cmd unloadall\n` +
 `• cmd install <filename> <code>\n` +
 `• cmd del <filename>\n` +
 `• cmd show <filename>\n\n` +
 `For events:\n` +
 `• event install <filename> <code>\n` +
 `• event del <filename>\n` +
 `• event show <filename>`;

 return await sock.sendMessage(m.key.remoteJid, { edit: sentMsg.key, text: helpText });
 }

 const action = args[0].toLowerCase();
 const filename = args[1];
 const type = action.startsWith('event') ? 'events' : 'cmds';
 const baseDir = path.join(__dirname, `../../scripts/${type}`);

 try {
 const sentMsg = await sock.sendMessage(m.key.remoteJid, { text: "Processing..." }, { quoted: m });

 switch (action) {
 case 'load':
 if (!filename) return await sock.sendMessage(m.key.remoteJid, { edit: sentMsg.key, text: 'Please provide a filename!' });
 await loadFile(filename, baseDir, sock, sentMsg);
 break;

 case 'loadall':
 await loadAllFiles(baseDir, sock, sentMsg);
 break;

 case 'unloadall':
 await unloadAllFiles(baseDir, sock, sentMsg);
 break;

 case 'install':
 case 'event':
 if (!filename || args.length < 3) {
 return await sock.sendMessage(m.key.remoteJid, { 
 edit: sentMsg.key, text: `Please provide both filename and code!\nFormat: ${action} <filename> <code>` 
 });
 }
 const code = args.slice(2).join(' ');
 await installFile(filename, code, type, sock, sentMsg);
 break;

 case 'del':
 if (!filename) return await sock.sendMessage(m.key.remoteJid, { edit: sentMsg.key, text: 'Please provide a filename!' });
 await deleteFile(filename, baseDir, sock, sentMsg);
 break;

 case 'show':
 if (!filename) return await sock.sendMessage(m.key.remoteJid, { edit: sentMsg.key, text: 'Please provide a filename!' });
 await showFile(filename, baseDir, sock, sentMsg);
 break;

 default:
 await sock.sendMessage(m.key.remoteJid, { edit: sentMsg.key, text: 'Invalid action!' });
 }
 } catch (err) {
 logError(`Error in file manager: ${err.message}`);
 await sock.sendMessage(m.key.remoteJid, { edit: m.key, text: `Error: ${err.message}` });
 }
 }
};

async function loadFile(filename, baseDir, sock, sentMsg) {
 const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

 if (!fs.existsSync(filePath)) {
 return await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `File ${filename} not found!` });
 }

 try {
 delete require.cache[require.resolve(filePath)];
 const command = require(filePath);

 if (command.name && typeof command.run === 'function') {
 global.commands.set(command.name, command);
 logSuccess(`Loaded: ${command.name}`);
 await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `Successfully loaded ${filename}!` });
 }
 } catch (err) {
 throw new Error(`Failed to load ${filename}: ${err.message}`);
 }
}

async function loadAllFiles(baseDir, sock, sentMsg) {
 const files = fs.readdirSync(baseDir).filter(file => file.endsWith('.js'));
 let loaded = 0;

 for (const file of files) {
 try {
 await loadFile(file, baseDir, sock, sentMsg);
 loaded++;
 } catch (err) {
 logError(`Failed to load ${file}: ${err.message}`);
 }
 }

 await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `Successfully loaded ${loaded} of ${files.length} files!` });
}

async function unloadAllFiles(baseDir, sock, sentMsg) {
 const files = fs.readdirSync(baseDir).filter(file => file.endsWith('.js'));

 for (const file of files) {
 delete require.cache[require.resolve(path.join(baseDir, file))];
 }

 global.commands.clear();
 await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `Successfully unloaded all files!` });
}

async function installFile(filename, code, type, sock, sentMsg) {
 const filePath = path.join(__dirname, `../../scripts/${type}/${filename.endsWith('.js') ? filename : `${filename}.js`}`);

 try {
 fs.writeFileSync(filePath, code);
 logSuccess(`Installed: ${filename}`);
 await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `Successfully installed ${filename}!` });

 if (type === 'cmds') {
 await loadFile(filename, path.dirname(filePath), sock, sentMsg);
 }
 } catch (err) {
 throw new Error(`Failed to install ${filename}: ${err.message}`);
 }
}

async function deleteFile(filename, baseDir, sock, sentMsg) {
 const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

 if (!fs.existsSync(filePath)) {
 return await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `File ${filename} not found!` });
 }

 try {
 fs.unlinkSync(filePath);
 delete require.cache[require.resolve(filePath)];
 logSuccess(`Deleted: ${filename}`);
 await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `Successfully deleted ${filename}!` });
 } catch (err) {
 throw new Error(`Failed to delete ${filename}: ${err.message}`);
 }
}

async function showFile(filename, baseDir, sock, sentMsg) {
 const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

 if (!fs.existsSync(filePath)) {
 return await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `File ${filename} not found!` });
 }

 try {
 const content = fs.readFileSync(filePath, 'utf8');
 await sock.sendMessage(sentMsg.key.remoteJid, { edit: sentMsg.key, text: `Content of ${filename}:\n\n${content}` });
 } catch (err) {
 throw new Error(`Failed to read ${filename}: ${err.message}`);
 }
}