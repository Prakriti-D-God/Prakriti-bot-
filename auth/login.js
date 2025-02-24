const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const readline = require('readline');
const fs = require('fs');
const { logInfo, logSuccess, logError } = require('../utils/logger');
const config = require('../config.json');

// Ensure auth directory exists
const ensureAuthDirectory = () => {
    const authDir = './auth';
    const sessionDir = './auth/session';

    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir);
    }
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir);
    }
};

// Create readline interface for user input
const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

/**
 * Get authentication state with error handling
 * @returns {Promise<{state: *, saveCreds: Function}>}
 */
const getAuthState = async () => {
    try {
        ensureAuthDirectory();
        const { state, saveCreds } = await useMultiFileAuthState('./auth/session');
        return { state, saveCreds };
    } catch (err) {
        logError(`Error getting auth state: ${err.message}`);
        throw new Error(`Authentication state error: ${err.message}`);
    }
};

/**
 * Authenticate session using phone number and pairing code
 * @param {object} ptz - WhatsApp socket connection
 * @returns {Promise<void>}
 */
const authenticateSession = async (ptz) => {
    try {
        // Wait for connection to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!ptz.authState?.creds?.registered) {
            // Get phone number from config or prompt user
            let phoneNumber = config.whatsappAccount.phoneNumber;

            if (!phoneNumber) {
                phoneNumber = await question('Enter Phone Number (with country code):\n');
            }

            // Clean the phone number
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

            try {
                // Request pairing code
                let code = await ptz.requestPairingCode(phoneNumber);

                // Format code with dashes for readability
                code = code?.match(/.{1,4}/g)?.join("-") || code;

                logSuccess(`Pairing Code: ${code}`);
                logInfo("Please enter this code in your WhatsApp mobile app");

                // Wait for authentication
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (err) {
                logError(`Failed to get pairing code: ${err.message}`);
                throw err;
            }
        }
    } catch (err) {
        logError(`Authentication error: ${err.message}`);
        throw err;
    }
};

module.exports = {
    getAuthState,
    authenticateSession
};
