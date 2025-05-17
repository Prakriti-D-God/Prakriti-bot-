const fs = require('fs');
const path = require('path');
const { logSuccess, logCommand } = require('../utils/logger');
const { config } = require('../config/globals');

class CommandManager {
    constructor() {
        this.cooldowns = new Map();
        this.commandsFolder = path.resolve(__dirname, '../scripts/cmds');
        this.cooldownTime = config.antiSpam.cooldownTime || 5; // Default cooldown time
    }

    // Load all command files from the commands folder
    loadCommands() {
        const commandFiles = fs.readdirSync(this.commandsFolder).filter(file => file.endsWith('.js'));
        commandFiles.forEach(file => {
            const command = require(path.join(this.commandsFolder, file));
            if (command.name && typeof command.run === 'function') {
                global.commands.set(command.name, command);
                logSuccess(`Loaded command: ${command.name}`);
            }
        });
    }

    // Check if the command is on cooldown for the sender
    checkCooldown(command, sender) {
        if (!config.antiSpam.enable) return false;

        const now = Date.now();
        if (!this.cooldowns.has(command)) this.cooldowns.set(command, new Map());
        const timestamps = this.cooldowns.get(command);
        const cmd = global.commands.get(command);
        const cooldownAmount = (cmd.cooldown || this.cooldownTime) * 1000; // Use command-specific cooldown if available

        if (timestamps.has(sender)) {
            const expirationTime = timestamps.get(sender) + cooldownAmount;
            if (now < expirationTime) {
                return ((expirationTime - now) / 1000).toFixed(1); // Return remaining cooldown time
            }
        }

        return false; // No cooldown
    }

    // Apply cooldown to a command for a specific sender
    applyCooldown(command, sender) {
        if (!config.antiSpam.enable) return;

        const now = Date.now();
        if (!this.cooldowns.has(command)) this.cooldowns.set(command, new Map());
        const timestamps = this.cooldowns.get(command);
        const cmd = global.commands.get(command);
        const cooldownAmount = (cmd.cooldown || this.cooldownTime) * 1000;

        timestamps.set(sender, now);
        setTimeout(() => timestamps.delete(sender), cooldownAmount);
    }

    canExecuteCommand(sender) {
        if (config.adminOnly.enable && !global.adminList.includes(sender.replace(/[^0-9]/g, ''))) {
            return false; // Not an admin
        }
        if (config.whiteListMode.enable && !global.whiteList.includes(sender.replace(/[^0-9]/g, ''))) {
            return false; // Not whitelisted
        }
        return true; // Allowed to execute command
    }
}

module.exports = CommandManager;