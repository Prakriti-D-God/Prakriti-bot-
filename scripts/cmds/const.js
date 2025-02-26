axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp'); // Ensure 'sharp' is installed

module.exports = {
 name: 'meme',
 alias: [],
 desc: 'Get a random meme',
 usage: 'meme',
 category: 'fun',

 async run({ sock, m }) {
 try {
 const response = await axios.get('https://meme-api.com/gimme');
 const memeUrl = response.data.url;

 // Create the meme folder if it doesn't exist
 const downloadDir = path.join(__dirname, '../../downloads/memes');
 if (!fs.existsSync(downloadDir)) {
 fs.mkdirSync(downloadDir, { recursive: true });
 }

 // Generate a unique filename
 const fileName = `meme_${Date.now()}.png`;
 const filePath = path.join(downloadDir, fileName);

 // Download the meme image
 const imageResponse = await axios.get(memeUrl, { responseType: 'arraybuffer' });

 // Convert to PNG and resize
 await sharp(imageResponse.data)
 .resize({ width: 800 }) // Resize for WhatsApp compatibility
 .toFormat('png')
 .toFile(filePath);

 // Send the meme
 await sock.sendMessage(m.key.remoteJid, { 
 image: { url: filePath }, 
 mimetype: 'image/png',
 caption: 'Here is your meme! 😆' 
 }, { quoted: m });

 console.log(`✅ Meme saved and sent: ${filePath}`);

 } catch (error) {
 console.error('❌ Meme Fetch Error:', error);
 await sock.sendMessage(m.key.remoteJid, { text: '❌ Failed to fetch meme. Try again later.' }, { quoted: m });
 }
 }
};