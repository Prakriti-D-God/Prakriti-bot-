const fs = require('fs');
const path = require('path');
const { logSuccess, logError, logInfo } = require('../../utils/logger');

module.exports = {
    name: 'event',
    alias: ['events'],
    desc: 'Manage event files and operations',
    usage: 'event [action] [filename] [code]',
    category: 'admin',
    permission: 2, // Admin only

    async run({ sock, m, args, sender }) {
        if (!args[0]) {
            return await sock.sendMessage(m.key.remoteJid, {
                text: `Available event actions:\n\n` +
                      `• event install <filename> <code>\n` +
                      `• event del <filename>\n` +
                      `• event show <filename>\n` +
                      `• event list\n` +
                      `• event reload`
            }, { quoted: m });
        }

        const action = args[0].toLowerCase();
        const filename = args[1];
        const baseDir = path.join(__dirname, '../../scripts/events');

        // Ensure events directory exists
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        try {
            switch (action) {
                case 'install':
                    if (!filename || args.length < 3) {
                        return await sock.sendMessage(m.key.remoteJid, { 
                            text: 'Please provide both filename and code!\nFormat: event install <filename> <code>' 
                        }, { quoted: m });
                    }
                    const code = args.slice(2).join(' ');
                    await installEvent(filename, code, baseDir, sock, m);
                    break;

                case 'del':
                case 'delete':
                    if (!filename) {
                        return await sock.sendMessage(m.key.remoteJid, { 
                            text: 'Please provide a filename to delete!' 
                        }, { quoted: m });
                    }
                    await deleteEvent(filename, baseDir, sock, m);
                    break;

                case 'show':
                    if (!filename) {
                        return await sock.sendMessage(m.key.remoteJid, { 
                            text: 'Please provide a filename to show!' 
                        }, { quoted: m });
                    }
                    await showEvent(filename, baseDir, sock, m);
                    break;

                case 'list':
                    await listEvents(baseDir, sock, m);
                    break;

                case 'reload':
                    await reloadEvents(baseDir, sock, m);
                    break;

                default:
                    await sock.sendMessage(m.key.remoteJid, { 
                        text: 'Invalid action! Use "event" to see available actions.' 
                    }, { quoted: m });
            }
        } catch (err) {
            logError(`Error in event manager: ${err.message}`);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `Error: ${err.message}` 
            }, { quoted: m });
        }
    }
};

async function installEvent(filename, code, baseDir, sock, m) {
    const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

    try {
        // Basic validation of event code structure
        if (!code.includes('module.exports') || !code.includes('event:')) {
            throw new Error('Invalid event code structure! Must export an event function.');
        }

        fs.writeFileSync(filePath, code);

        // Try to load the event immediately
        delete require.cache[require.resolve(filePath)];
        const event = require(filePath);

        if (event.name && typeof event.event === 'function') {
            global.events.set(event.name, event);
            logSuccess(`Installed and loaded event: ${event.name}`);
            await sock.sendMessage(m.key.remoteJid, { 
                text: `Successfully installed and loaded event: ${filename}` 
            }, { quoted: m });
        } else {
            throw new Error('Invalid event structure in the provided code');
        }
    } catch (err) {
        throw new Error(`Failed to install event ${filename}: ${err.message}`);
    }
}

async function deleteEvent(filename, baseDir, sock, m) {
    const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

    if (!fs.existsSync(filePath)) {
        return await sock.sendMessage(m.key.remoteJid, { 
            text: `Event file ${filename} not found!` 
        }, { quoted: m });
    }

    try {
        // Remove from global events first
        const event = require(filePath);
        if (event.name) {
            global.events.delete(event.name);
        }

        // Delete the file and clear cache
        fs.unlinkSync(filePath);
        delete require.cache[require.resolve(filePath)];

        logSuccess(`Deleted event: ${filename}`);
        await sock.sendMessage(m.key.remoteJid, { 
            text: `Successfully deleted event: ${filename}` 
        }, { quoted: m });
    } catch (err) {
        throw new Error(`Failed to delete event ${filename}: ${err.message}`);
    }
}

async function showEvent(filename, baseDir, sock, m) {
    const filePath = path.join(baseDir, filename.endsWith('.js') ? filename : `${filename}.js`);

    if (!fs.existsSync(filePath)) {
        return await sock.sendMessage(m.key.remoteJid, { 
            text: `Event file ${filename} not found!` 
        }, { quoted: m });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        await sock.sendMessage(m.key.remoteJid, { 
            text: `Content of ${filename}:\n\n${content}` 
        }, { quoted: m });
    } catch (err) {
        throw new Error(`Failed to read event ${filename}: ${err.message}`);
    }
}

async function listEvents(baseDir, sock, m) {
    try {
        const files = fs.readdirSync(baseDir).filter(file => file.endsWith('.js'));

        if (files.length === 0) {
            return await sock.sendMessage(m.key.remoteJid, { 
                text: 'No event files found!' 
            }, { quoted: m });
        }

        const eventList = files.map(file => {
            try {
                const event = require(path.join(baseDir, file));
                return `• ${file}: ${event.name || 'Unknown'} - ${event.desc || 'No description'}`;
            } catch (err) {
                return `• ${file}: Error loading event`;
            }
        }).join('\n');

        await sock.sendMessage(m.key.remoteJid, { 
            text: `Installed Events:\n\n${eventList}` 
        }, { quoted: m });
    } catch (err) {
        throw new Error(`Failed to list events: ${err.message}`);
    }
}

async function reloadEvents(baseDir, sock, m) {
    try {
        // Clear existing events
        global.events.clear();

        // Reload all events
        const files = fs.readdirSync(baseDir).filter(file => file.endsWith('.js'));
        let loaded = 0;

        for (const file of files) {
            try {
                const filePath = path.join(baseDir, file);
                delete require.cache[require.resolve(filePath)];
                const event = require(filePath);

                if (event.name && typeof event.event === 'function') {
                    global.events.set(event.name, event);
                    loaded++;
                }
            } catch (err) {
                logError(`Failed to reload ${file}: ${err.message}`);
            }
        }

        logSuccess(`Reloaded ${loaded} events`);
        await sock.sendMessage(m.key.remoteJid, { 
            text: `Successfully reloaded ${loaded} of ${files.length} events!` 
        }, { quoted: m });
    } catch (err) {
        throw new Error(`Failed to reload events: ${err.message}`);
    }
}