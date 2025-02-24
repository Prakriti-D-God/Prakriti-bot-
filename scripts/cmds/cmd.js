const fs = require('fs');
const path = require('path');
const { logSuccess, logError, logInfo } = require('../../utils/logger');

module.exports = {
    name: 'cmd',
    alias: ['command'],
    desc: 'Manage command and event files',
    usage: 'cmd [action] [filename] [code]',
    category: 'admin',
    permission: 2, 

    async run({ sock, m, args, sender }) {
        if (!args[0]) {
            return await sock.sendMessage(m.key.remoteJid, {
                text: `Available actions:\n\n` +
                      `• cmd load <filename>\n` +
                      `• cmd loadall\n` +
                      `• cmd unloadall\n` +
                      `• cmd install <filename> <code>\n` +
                      `• cmd del <filename>\n` +
                      `• cmd show <filename>\n\n` +
                      `For events:\n` +
                      `• event install <filename> <code>\n` +
                      `• event del <filename>\n` +
                      `• event show <filename>`
            }, { quoted: m });
        }

        const action = args[0].toLowerCase();
        const filename = args[1];
        const type = action.startsWith('event') ? 'events' : 'cmds';
        const baseDir = path.join(__dirname, type === 'events' ? '../../scripts/events' : '../../scripts/cmds');

        try {
            switch (action) {
                case 'load':
                    if (!filename) return await sock.sendMessage(m.key.remoteJid, { text: 'Please provide a filename!' }, { quoted: m });
                    await loadFile(filename, baseDir, sock, m);
                    break;

                case 'loadall':
                    await loadAllFiles(baseDir, sock, m);
                    break;

                case 'unloadall':
                    await unloadAllFiles(baseDir, sock, m);
                    break;

                case 'install':
                case 'event':
                    if (!filename || args.length < 3) {
                        return await sock.sendMessage(m.key.remoteJid, { 
                            text: `Please provide both filename and code!\nFormat: ${action} <filename> <code>` 
                        }, { quoted: m });
                    }
                    const code = args.slice(2).join(' ');
                    await installFile(filename, code, type === 'events' ? 'events' : 'cmds', sock, m);
                    break;

                case 'del':
                    if (!filename) return await sock.sendMessage(m.key.remoteJid, { text: 'Please provide a filename!' }, { quoted: m });
                    await deleteFile(filename, baseDir, sock, m);
                    break;

                case 'show':
                    if (!filename) return await sock.sendMessage(m.key.remoteJid, { text: 'Please provide a filename!' }, { quoted: m });
                    await showFile(filename, baseDir, sock, m);
                    break;

                default:
                    await sock.sendMessage(m.key.remoteJid, { text: 'Invalid action!' }, { quoted: m });
            }
        } catch (err) {
            logError(`Error in file manager: ${err.message}`);
            await sock.sendMessage(m.key.remoteJid, { text: `Error: ${err.message}` }, { quoted: m });
        }
    }
};

async function loadFile(filename, baseDir, sock, m) {
    const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

    if (!fs.existsSync(filePath)) {
        return await sock.sendMessage(m.key.remoteJid, { text: `File ${filename} not found!` }, { quoted: m });
    }

    try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if (command.name && typeof command.run === 'function') {
            global.commands.set(command.name, command);
            logSuccess(`Loaded: ${command.name}`);
            await sock.sendMessage(m.key.remoteJid, { text: `Successfully loaded ${filename}!` }, { quoted: m });
        }
    } catch (err) {
        throw new Error(`Failed to load ${filename}: ${err.message}`);
    }
}

async function loadAllFiles(baseDir, sock, m) {
    const files = fs.readdirSync(baseDir).filter(file => file.endsWith('.js'));
    let loaded = 0;

    for (const file of files) {
        try {
            await loadFile(file, baseDir, sock, m);
            loaded++;
        } catch (err) {
            logError(`Failed to load ${file}: ${err.message}`);
        }
    }

    await sock.sendMessage(m.key.remoteJid, { 
        text: `Successfully loaded ${loaded} of ${files.length} files!` 
    }, { quoted: m });
}

async function unloadAllFiles(baseDir, sock, m) {
    const files = fs.readdirSync(baseDir).filter(file => file.endsWith('.js'));

    for (const file of files) {
        const filePath = path.join(baseDir, file);
        delete require.cache[require.resolve(filePath)];
    }

    global.commands.clear();
    await sock.sendMessage(m.key.remoteJid, { 
        text: `Successfully unloaded all files!` 
    }, { quoted: m });
}

async function installFile(filename, code, type, sock, m) {
    const baseDir = path.join(__dirname, `../../scripts/${type}`);
    const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

    try {
        fs.writeFileSync(filePath, code);
        logSuccess(`Installed: ${filename}`);
        await sock.sendMessage(m.key.remoteJid, { 
            text: `Successfully installed ${filename}!` 
        }, { quoted: m });

        
        if (type === 'cmds') {
            await loadFile(filename, baseDir, sock, m);
        }
    } catch (err) {
        throw new Error(`Failed to install ${filename}: ${err.message}`);
    }
}

async function deleteFile(filename, baseDir, sock, m) {
    const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

    if (!fs.existsSync(filePath)) {
        return await sock.sendMessage(m.key.remoteJid, { 
            text: `File ${filename} not found!` 
        }, { quoted: m });
    }

    try {
        fs.unlinkSync(filePath);
        delete require.cache[require.resolve(filePath)];
        logSuccess(`Deleted: ${filename}`);
        await sock.sendMessage(m.key.remoteJid, { 
            text: `Successfully deleted ${filename}!` 
        }, { quoted: m });
    } catch (err) {
        throw new Error(`Failed to delete ${filename}: ${err.message}`);
    }
}

async function showFile(filename, baseDir, sock, m) {
    const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

    if (!fs.existsSync(filePath)) {
        return await sock.sendMessage(m.key.remoteJid, { 
            text: `File ${filename} not found!` 
        }, { quoted: m });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        await sock.sendMessage(m.key.remoteJid, { 
            text: `Content of ${filename}:\n\n${content}` 
        }, { quoted: m });
    } catch (err) {
        throw new Error(`Failed to read ${filename}: ${err.message}`);
    }
}