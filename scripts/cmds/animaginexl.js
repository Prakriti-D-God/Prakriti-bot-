const axios = require('axios');

module.exports = {
    name: 'animaginexl',
    description: 'Generates an image based on the provided prompt using the API.',
    permission: 0,
    async run({ sock, m, args, sender, botNumber }) {
        try {
            if (args.length === 0) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: '⚠️ Please provide a prompt to imagine!' },
                    { quoted: m }
                );
            }

            const prompt = args.join(' ');
            const apiUrl = `https://zaikyoov3-up.up.railway.app/api/animaginexl?prompt=${encodeURIComponent(prompt)}`;
            const response = await axios.get(apiUrl, { responseType: 'arraybuffer' });

            const imageBuffer = Buffer.from(response.data, 'binary');

            await sock.sendMessage(
                m.key.remoteJid,
                { image: imageBuffer, caption: `Here is the image based on your prompt: "${prompt}"` },
                { quoted: m }
            );
        } catch (error) {
            console.error('Error in imagine command:', error.message);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: '❌ There was an error while generating the image. Please try again later.' },
                { quoted: m }
            );
        }
    }
};