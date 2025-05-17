const fs = require('fs');
const { logSuccess, logError, logInfo } = require('../../utils/logger');

module.exports = {
    name: "spam",
    description: "Sends a message multiple times with no limits",
    usage: "{prefix}spam <count> <message>",
    aliases: ["repeat"],
    cooldown: 0, // No cooldown
    permission: 0, // Available to everyone
    category: "fun",
    async run({ sock, m, args, sender, botNumber }) {
        try {
            // Check if enough arguments are provided
            if (args.length < 2) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `❌ Usage: {prefix}spam <count> <message>` },
                    { quoted: m }
                );
            }

            // Get count from first argument
            const count = parseInt(args[0]);

            // Validate count is a number
            if (isNaN(count) || count <= 0) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `❌ Count must be a positive number.` },
                    { quoted: m }
                );
            }

            // Get the message to spam (everything after the count)
            const message = args.slice(1).join(' ');

            if (!message) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `❌ Please provide a message to send.` },
                    { quoted: m }
                );
            }

            // Send initial confirmation
            await sock.sendMessage(
                m.key.remoteJid,
                { text: `🔄 Sending "${message}" ${count} times...` },
                { quoted: m }
            );

            // Spam the message with minimal delay
            for (let i = 0; i < count; i++) {
                try {
                    await sock.sendMessage(
                        m.key.remoteJid,
                        { text: message }
                    );

                    // Add a very minimal delay to prevent connection issues
                    // Just enough to maintain connection stability
                    if (i < count - 1) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                } catch (sendErr) {
                    logError(`Failed to send spam message #${i+1}: ${sendErr.message}`);
                    // Continue sending even if a message fails
                }
            }

            logSuccess(`Spam command executed by ${sender}: ${count} messages sent`);

        } catch (error) {
            logError(`Error in spam command: ${error.message}`);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: `❌ Error sending spam messages: ${error.message}` },
                { quoted: m }
            );
        }
    }
};

// Add file watcher for hot reloading
fs.watchFile(__filename, () => {
    fs.unwatchFile(__filename);
    logInfo(`Updated ${__filename}`);
    delete require.cache[__filename];
    require(__filename);
});