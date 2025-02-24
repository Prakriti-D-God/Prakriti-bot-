const {
    default: makeWASocket,
    makeInMemoryStore
} = require("@whiskeysockets/baileys");
const pino = require('pino');
const fs = require('fs');
const { logInfo, logError } = require('./utils/logger');
const config = require('./config.json');
const { authenticateSession, getAuthState } = require('./auth/login');
const { initializeMessageListener } = require('./core/messageListener');
const { handleConnection } = require('./core/connectionHandler');
const { initializeMediaHandlers } = require('./utils/mediaHandler');
const { startUptimeServer } = require('./services/uptimeServer');


const store = makeInMemoryStore({ 
    logger: pino().child({ level: 'silent', stream: 'store' }) 
});

async function startBotz() {
    try {
      
        const { state, saveCreds } = await getAuthState();

        
        const ptz = makeWASocket({
            logger: pino({ level: "silent" }),
            printQRInTerminal: !config.whatsappAccount.phoneNumber,
            auth: state,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            connectTimeoutMs: config.whatsappAccount.qrTimeout * 1000 || 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: true,
            markOnlineOnConnect: true,
        });

        
        await authenticateSession(ptz);

        
        store.bind(ptz.ev);

        
        initializeMessageListener(ptz, store);


        handleConnection(ptz, startBotz);

        
        initializeMediaHandlers(ptz);

        
        ptz.ev.on('creds.update', saveCreds);

        
        startUptimeServer();

        
        if (config.autoRestart.enable && config.autoRestart.time) {
            setInterval(() => {
                logInfo("Auto-restarting bot...");
                process.exit();
            }, config.autoRestart.time * 1000 * 60);
        }

        return ptz;
    } catch (err) {
        logError("Error in startBotz:", err);
    }
}


startBotz();


let file = require.resolve(__filename);
fs.watchFile(file, () => {
    fs.unwatchFile(file);
    logInfo(`Update ${__filename}`);
    delete require.cache[file];
    require(file);
});
