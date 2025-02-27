const { logError, logSuccess } = require('../../utils/logger');
const { config } = require('../../config/globals');

module.exports = {
    name: 'adminonly',
    description: 'Enable or disable admin-only mode.',
    permission: 1, // Assuming permission level 1 is for admins
    async run({ sock, m, args, sender }) {
        const command = args[0]; // First argument should be the command (on/off)

        if (!command) {
            return await sock.sendMessage(m.key.remoteJid, {
                text: 'Please specify "on" or "off" to toggle admin-only mode.'
            }, { quoted: m });
        }

        if (command === 'on') {
            config.adminOnly.enable = true;
            logSuccess('Admin-only mode enabled.');
            await sock.sendMessage(m.key.remoteJid, {
                text: '✅ Admin-only mode has been enabled.'
            }, { quoted: m });
        } else if (command === 'off') {
            config.adminOnly.enable = false;
            logSuccess('Admin-only mode disabled.');
            await sock.sendMessage(m.key.remoteJid, {
                text: '✅ Admin-only mode has been disabled.'
            }, { quoted: m });
        } else {
            return await sock.sendMessage(m.key.remoteJid, {
                text: 'Invalid command. Please specify "on" or "off".'
            }, { quoted: m });
        }
    }
};