const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
 name: 'ytdl',
 alias: ['youtube', 'yt'],
 desc: 'Download YouTube videos or audio',
 usage: '+ytdl {video name} -{format}',
 category: 'media',

 async run({ sock, m, args }) {
 const downloadDir = path.join(__dirname, '../../downloads');
 if (!fs.existsSync(downloadDir)) {
 fs.mkdirSync(downloadDir, { recursive: true });
 }

 const input = args.join(' ');
 const formatMatch = input.match(/-(audio|video)$/i);
 if (!formatMatch) {
 return await sock.sendMessage(m.key.remoteJid, { text: '❌ *Error:* Please specify the format using -audio or -video.' }, { quoted: m });
 }

 const format = formatMatch[1].toLowerCase();
 const query = input.replace(/-(audio|video)$/i, '').trim();

 if (!query) {
 return await sock.sendMessage(m.key.remoteJid, { text: '❌ *Error:* Please provide a video name or URL.' }, { quoted: m });
 }

 const searchResults = await ytSearch(query);
 if (!searchResults.videos.length) {
 return await sock.sendMessage(m.key.remoteJid, { text: '⚠️ *No results found!* Try a different query.' }, { quoted: m });
 }

 // Pick the first search result
 const selectedVideo = searchResults.videos[0];
 const fileExtension = format === 'video' ? 'mp4' : 'mp3';
 const filePath = path.join(downloadDir, `${selectedVideo.videoId}.${fileExtension}`);

 // Download video/audio
 const streamOptions = format === 'video' ? {} : { filter: 'audioonly' };
 const stream = ytdl(selectedVideo.url, streamOptions).pipe(fs.createWriteStream(filePath));

 stream.on('finish', async () => {
 const thumbnailUrl = selectedVideo.thumbnail;

 if (format === 'audio') {
 await sock.sendMessage(m.key.remoteJid, {
 audio: { url: filePath },
 mimetype: 'audio/mpeg',
 ptt: false,
 contextInfo: {
 externalAdReply: {
 title: selectedVideo.title,
 body: `⏱️ Duration: ${selectedVideo.timestamp}`,
 thumbnailUrl: thumbnailUrl,
 mediaType: 2,
 mediaUrl: selectedVideo.url,
 sourceUrl: selectedVideo.url
 }
 }
 }, { quoted: m });
 } else {
 await sock.sendMessage(m.key.remoteJid, {
 video: { url: filePath },
 mimetype: 'video/mp4',
 contextInfo: {
 externalAdReply: {
 title: selectedVideo.title,
 body: `⏱️ Duration: ${selectedVideo.timestamp}`,
 thumbnailUrl: thumbnailUrl,
 mediaType: 2,
 mediaUrl: selectedVideo.url,
 sourceUrl: selectedVideo.url
 }
 }
 }, { quoted: m });
 }

 // Clean up after sending
 fs.unlinkSync(filePath);
 });

 stream.on('error', async (error) => {
 console.error('Download error:', error);
 await sock.sendMessage(m.key.remoteJid, { text: '❌ *Download Failed!* Please try again later.' }, { quoted: m });
 });
 }
};