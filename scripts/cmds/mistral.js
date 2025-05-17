/**
 * Mistral AI Command
 * Interact with Mistral AI language models through WhatsApp
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration file path
const CONFIG_DIR = path.join(__dirname, '../../config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'mistral.json');

// Default configuration
const DEFAULT_CONFIG = {
    apiKey: 'hpKGdsu0YbkHlWPAHPmY59RkPdT9UvfS', // Replace with your actual API key
    model: 'mistral-large-latest',
    maxTokens: 1000,
    temperature: 0.7,
    enabled: true
};

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Load or create config file
let config;
try {
    if (fs.existsSync(CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } else {
        config = DEFAULT_CONFIG;
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
        console.log('Created default Mistral config file with pre-configured API key');
    }
} catch (error) {
    console.error(`Error loading Mistral config: ${error.message}`);
    config = DEFAULT_CONFIG;
}

module.exports = {
    name: "mistral",
    alias: ["ai", "chat", "ask"],
    desc: "Chat with Mistral AI language model",
    usage: "mistral <message> | mistral clear",
    category: "AI",
    permission: 0, // Available to everyone
    cooldown: 5,

    /**
     * Run the Mistral command
     */
    run: async ({ sock, m, args, sender, botNumber, isGroup }) => {
        // Extract phone number from sender ID
        const userNumber = sender.replace(/[^0-9]/g, '');

        // Initialize conversation storage if not exists
        if (!global.mistralConversations) {
            global.mistralConversations = new Map();
        }

        const HISTORY_LIMIT = 10; // Max number of messages to keep per user

        // Helper function to manage conversation history
        const addMessageToHistory = (userNumber, role, content) => {
            if (!global.mistralConversations.has(userNumber)) {
                global.mistralConversations.set(userNumber, []);
            }

            const history = global.mistralConversations.get(userNumber);
            history.push({ role, content });

            // Trim history if it exceeds the limit
            if (history.length > HISTORY_LIMIT * 2) { // *2 because each exchange has 2 messages
                history.splice(0, 2); // Remove oldest exchange
            }

            return history;
        };

        // Check for subcommand
        const subCommand = args.length > 0 ? args[0].toLowerCase() : null;

        // Handle clear history command
        if (subCommand === 'clear') {
            global.mistralConversations.delete(userNumber);
            return await sock.sendMessage(
                m.key.remoteJid,
                { text: "🧹 Your conversation history has been cleared." },
                { quoted: m }
            );
        }

        // Handle help command
        if (subCommand === 'help') {
            return await sock.sendMessage(
                m.key.remoteJid,
                { 
                    text: `*Mistral AI Help*\n\n- Chat with AI: !mistral your message here\n- Clear history: !mistral clear` 
                },
                { quoted: m }
            );
        }

        // Process chat with Mistral
        try {
            // Show typing indicator
            await sock.sendPresenceUpdate('composing', m.key.remoteJid);

            // Get user message
            const userMessage = args.join(' ');

            // Check if user provided a message
            if (!userMessage || userMessage.trim() === '') {
                await sock.sendPresenceUpdate('available', m.key.remoteJid);
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: "❌ Please provide a message to chat with Mistral AI." },
                    { quoted: m }
                );
            }

            // Update conversation history
            const history = addMessageToHistory(userNumber, 'user', userMessage);

            // Prepare messages array for API
            let messages = [];

            // Add system message first if history is just starting
            if (history.length <= 1) {
                messages.push({
                    role: "system",
                    content: `You are Mistral AI, a helpful assistant on WhatsApp. Keep responses concise and helpful.`
                });
            }

            // Add conversation history
            history.forEach(msg => {
                messages.push(msg);
            });

            // Prepare the API request data - following the exact format from curl example
            const requestData = {
                model: config.model,
                messages: messages
            };

            // Add optional parameters only if we need to customize from defaults
            if (config.maxTokens !== undefined) {
                requestData.max_tokens = config.maxTokens;
            }

            if (config.temperature !== undefined) {
                requestData.temperature = config.temperature;
            }

            // Call Mistral API exactly as in the curl example
            const response = await axios({
                method: 'post',
                url: 'https://api.mistral.ai/v1/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                data: requestData
            });

            // Get the AI response
            const aiResponse = response.data.choices[0].message.content;

            // Add response to history
            addMessageToHistory(userNumber, 'assistant', aiResponse);

            // Send response to user
            await sock.sendMessage(
                m.key.remoteJid,
                { text: aiResponse },
                { quoted: m }
            );

        } catch (error) {
            console.error(`Mistral error:`, error);

            let errorMessage = "❌ Error connecting to Mistral AI";

            // Check for API specific errors
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                console.error(`API Error Response:`, {
                    status,
                    data: errorData
                });

                if (status === 401) {
                    errorMessage = "❌ Invalid API key. Please check the configuration.";
                } else if (status === 429) {
                    errorMessage = "❌ Rate limit exceeded. Please try again in a moment.";
                } else if (errorData && errorData.error) {
                    errorMessage = `❌ API Error: ${errorData.error.message || JSON.stringify(errorData.error)}`;
                }
            } else if (error.request) {
                console.error(`API Request Error:`, error.request);
                errorMessage = "❌ Network error. Could not connect to Mistral AI.";
            }

            await sock.sendMessage(
                m.key.remoteJid,
                { text: errorMessage },
                { quoted: m }
            );
        } finally {
            // Clear typing indicator
            await sock.sendPresenceUpdate('available', m.key.remoteJid);
        }
    }
};

// Hot reload support
fs.watchFile(__filename, () => {
    fs.unwatchFile(__filename);
    console.log(`Updated ${__filename}`);
    delete require.cache[__filename];
});