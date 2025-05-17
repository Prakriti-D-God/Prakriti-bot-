const fs = require('fs');
const path = require('path');
const { logError, logSuccess } = require('../../utils/logger');
const puppeteer = require('puppeteer-core'); // Using puppeteer-core instead of puppeteer
const { exec } = require('child_process');

module.exports = {
    name: "ss",
    description: "Takes a screenshot of a website and sends it in chat",
    usage: "{prefix}ss <url>",
    cooldown: 10,
    permission: 0, // Available to everyone
    run: async ({ sock, m, args, sender }) => {
        try {
            // Check if URL is provided
            if (!args[0]) {
                return await sock.sendMessage(
                    m.key.remoteJid,
                    { text: "❌ Please provide a URL to take a screenshot of.\nUsage: +ss https://example.com" },
                    { quoted: m }
                );
            }

            // Extract URL from arguments
            let url = args[0];

            // Add https:// if not present
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
            }

            // Send processing message
            await sock.sendMessage(
                m.key.remoteJid,
                { text: "📸 Taking screenshot, please wait..." },
                { quoted: m }
            );

            // Create temp directory if it doesn't exist
            const tempDir = path.join(process.cwd(), 'temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            // Generate unique filename
            const filename = `screenshot_${Date.now()}.png`;
            const filepath = path.join(tempDir, filename);

            // Find Chrome executable path - try common locations
            let executablePath;

            // Try to find Chrome/Chromium in common locations
            const possiblePaths = [
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            ];

            for (const path of possiblePaths) {
                if (fs.existsSync(path)) {
                    executablePath = path;
                    break;
                }
            }

            // If Chrome/Chromium not found in common locations, try alternative screenshot method
            if (!executablePath) {
                // For Replit or environments where installing browser isn't possible
                // Use a command-line tool like wkhtmltopdf if available
                return await takeAlternativeScreenshot(url, filepath, sock, m);
            }

            // Initialize browser with explicit executable path
            const browser = await puppeteer.launch({
                executablePath: executablePath,
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1280,800'
                ]
            });

            // Open new page
            const page = await browser.newPage();

            // Set user agent to avoid detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');

            // Set viewport size
            await page.setViewport({
                width: 1280,
                height: 800,
                deviceScaleFactor: 1
            });

            // Navigate to URL with timeout
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000 // 30 seconds timeout
            });

            // Take screenshot
            await page.screenshot({ 
                path: filepath,
                fullPage: false
            });

            // Close browser
            await browser.close();

            logSuccess(`Screenshot of ${url} saved to ${filepath}`);

            // Send the screenshot
            await sock.sendMessage(
                m.key.remoteJid,
                {
                    image: fs.readFileSync(filepath),
                    caption: `📸 Screenshot of ${url}\nTaken on: ${new Date().toLocaleString()}`
                },
                { quoted: m }
            );

            // Delete the file after sending
            fs.unlink(filepath, (err) => {
                if (err) logError(`Failed to delete screenshot file: ${err.message}`);
            });

        } catch (error) {
            logError(`Error in screenshot command: ${error.message}`);
            await sock.sendMessage(
                m.key.remoteJid,
                { text: `❌ Failed to take screenshot: ${error.message}` },
                { quoted: m }
            );
        }
    }
};

// Alternative screenshot method for environments where Chrome isn't available
async function takeAlternativeScreenshot(url, filepath, sock, m) {
    return new Promise((resolve, reject) => {
        // Using wget or curl with a simple HTML to image service
        const cmd = `curl -s -o "${filepath}" "https://image.thum.io/get/width/1280/crop/800/png/${url}"`;

        exec(cmd, async (error, stdout, stderr) => {
            if (error) {
                logError(`Alternative screenshot error: ${error.message}`);
                await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `❌ Failed to take screenshot: ${error.message}` },
                    { quoted: m }
                );
                return reject(error);
            }

            logSuccess(`Alternative screenshot of ${url} saved to ${filepath}`);

            // Check if file exists and has content
            if (fs.existsSync(filepath) && fs.statSync(filepath).size > 0) {
                // Send the screenshot
                await sock.sendMessage(
                    m.key.remoteJid,
                    {
                        image: fs.readFileSync(filepath),
                        caption: `📸 Screenshot of ${url}\nTaken on: ${new Date().toLocaleString()}`
                    },
                    { quoted: m }
                );

                // Delete the file after sending
                fs.unlink(filepath, (err) => {
                    if (err) logError(`Failed to delete screenshot file: ${err.message}`);
                });

                resolve();
            } else {
                const errorMsg = "Failed to capture screenshot (empty file)";
                logError(errorMsg);
                await sock.sendMessage(
                    m.key.remoteJid,
                    { text: `❌ ${errorMsg}` },
                    { quoted: m }
                );
                reject(new Error(errorMsg));
            }
        });
    });
}