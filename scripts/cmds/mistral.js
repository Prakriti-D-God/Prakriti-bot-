const axios = require('axios');
const fs = require('fs');
const path = require('path');

const chatHistoryDir = 'mistralChatHistory';
const apiKey = '7zj8q9GPT7okFduiQfPKFDSpCcQTeW'; // Use environment variable in production
const systemPrompt = "You are a helpful AI. Respond concisely.";

// Ensure the chat history directory exists
if (!fs.existsSync(chatHistoryDir)) {
 fs.mkdirSync(chatHistoryDir);
}

module.exports = {
 name: 'mistral',
 description: 'Interact with Mistral API.',
 permission: 0, // Everyone can use it
 cooldowns: 5, // 5 seconds cooldown
 dm:User true,
 run: async ({ sock, m, args }) => {
 const prompt = args.join(' ');
 const senderID = m.key.remoteJid;

 if (!prompt) {
 await sock.sendMessage(senderID, { text: '⚠️ Please provide a prompt.' });
 return;
 }

 if (prompt.toLowerCase() === "clear") {
 clearChatHistory(senderID);
 await sock.sendMessage(senderID, { text: '🗑️ Chat history cleared!' });
 return;
 }

 const chatMessages = [
 { role: "system", content: systemPrompt },
 ...loadChatHistory(senderID),
 { role: "user", content: prompt }
 ];

 try {
 const startTime = Date.now();
 const response = await sendMistralRequest(chatMessages);
 const assistantResponse = response.choices[0].message.content;
 const completionTime = ((Date.now() - startTime) / 1000).toFixed(2);

 const reply = `🤖 *Mistral AI:*\n${assistantResponse}\n\n⏳ Response time: ${completionTime}s`;

 await sock.sendMessage(senderID, { text: reply });

 appendToChatHistory(senderID, [
 { role: "user", content: prompt },
 { role: "assistant", content: assistantResponse }
 ]);
 } catch (error) {
 console.error("Mistral API Error:", error?.response?.data || error.message);
 await sock.sendMessage(senderID, { text: '❌ Error communicating with Mistral API.' });
 }
 }
};

async function sendMistralRequest(messages) {
 const response = await axios.post(
 'https://api.mistral.ai/v1/chat/completions',
 { model: 'mistral-large-latest', messages },
 {
 headers: {
 'Authorization': `Bearer ${apiKey}`,
 'Content-Type': 'application/json'
 }
 }
 );
 return response.data;
}

function loadChatHistory(uid) {
 const filePath = getChatHistoryFilePath(uid);
 if (fs.existsSync(filePath)) {
 return JSON.parse(fs.readFileSync(filePath, 'utf8'));
 }
 return [];
}

function appendToChatHistory(uid, messages) {
 const filePath = getChatHistoryFilePath(uid);
 const history = loadChatHistory(uid);
 fs.writeFileSync(filePath, JSON.stringify([...history, ...messages], null, 2));
}

function clearChatHistory(uid) {
 const filePath = getChatHistoryFilePath(uid);
 if (fs.existsSync(filePath)) {
 fs.unlinkSync(filePath);
 }
}

function getChatHistoryFilePath(uid) {
 return path.join(chatHistoryDir, `${uid}-mistral.json`);
}