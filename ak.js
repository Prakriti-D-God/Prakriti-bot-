const fs = require('fs');

// Load configuration from config.json file
const configPath = './config.json';

let adminNumbers = [];

try {
    // Read and parse config.json file
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    adminNumbers = config.adminOnly.adminNumbers || [];
} catch (error) {
    console.error("❌ Error reading config.json file:", error.message);
}

// Function to create a box based on terminal width
function printBox(content) {
    const terminalWidth = process.stdout.columns; // Get terminal width
    const padding = 4; // Padding for the box
    const maxContentWidth = terminalWidth - (padding * 2); // Calculate maximum content width
    const adjustedContent = content.map(line => line.slice(0, maxContentWidth)); // Adjust content to fit the width
    const boxWidth = Math.min(maxContentWidth, Math.max(...adjustedContent.map(line => line.length)));

    const horizontalBorder = "┌" + "─".repeat(boxWidth + padding) + "┐";
    const bottomBorder = "└" + "─".repeat(boxWidth + padding) + "┘";

    console.log(horizontalBorder);
    adjustedContent.forEach(line => {
        const paddedLine = line.padEnd(boxWidth, ' ');
        console.log(`│  ${paddedLine}  │`);
    });
    console.log(bottomBorder);
}

// Prepare the content for the box
const boxContent = adminNumbers.length > 0
    ? adminNumbers.map((number, index) => `Admin ${index + 1}: ${number}`)
    : ["No admin numbers found in the configuration."];

// Call the function to print the box
printBox(boxContent);