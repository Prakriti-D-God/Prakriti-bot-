const { config } = require('../../config/globals');

let activeSpams = new Map();
let spamDelay = new Map();

module.exports = {
    name: 'spam',
    alias: ['repeat'],
    desc: 'Spam a message multiple times with optional delay',
    usage: 'spam <text> <count>',
    category: 'utility',
    permission: 0,

    async run({ sock, m, args, sender }) {
        if (args.length < 2) {
            return;
        }

        const text = args.slice(0, -1).join(' ');
        const count = parseInt(args[args.length - 1]);

        if (isNaN(count) || count <= 0) {
            return;
        }

        const chatId = m.key.remoteJid;

        activeSpams.set(chatId, true);
        const delay = spamDelay.get(chatId) || 0;

        for (let i = 0; i < count; i++) {
            if (!activeSpams.get(chatId)) break;
            await sock.sendMessage(chatId, { text });
            if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

module.exports.adminControl = async ({ sock, m, args }) => {
    const command = args[0]?.toLowerCase();
    const chatId = m.key.remoteJid;

    if (command === 'stop') {
        activeSpams.set(chatId, false);
        await sock.sendMessage(chatId, { text: 'Spam stopped by admin.' });
    } else if (command === 'continue') {
        activeSpams.set(chatId, true);
        await sock.sendMessage(chatId, { text: 'Spam resumed by admin.' });
    } else if (/^\d+(sec|min|hour)s?$/.test(command)) {
        const value = parseInt(command.match(/\d+/)[0]);
        const unit = command.match(/sec|min|hour/)[0];

        let delay = 0;
        if (unit === 'sec') delay = value * 1000;
        else if (unit === 'min') delay = value * 60000;
        else if (unit === 'hour') delay = value * 3600000;

        spamDelay.set(chatId, delay);
        await sock.sendMessage(chatId, { text: `Spam delay set to ${value} ${unit}(s).` });
    }
};