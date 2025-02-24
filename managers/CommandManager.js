const fs = require('fs');
const path = require('path');
const { logSuccess, logCommand } = require('../utils/logger');
const { config } = require('../config/globals');

class CommandManager {
    constructor() {
        this.cooldowns = new Map();
        this.commandsFolder = path.resolve(__dirname, '../scripts/cmds');
        this.cooldownTime = config.antiSpam.cooldownTime || 5;
    }

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

    checkCooldown(command, sender) {
        if (!config.antiSpam.enable) return false;

        const now = Date.now();
        if (!this.cooldowns.has(command)) this.cooldowns.set(command, new Map());
        const timestamps = this.cooldowns.get(command);
        const cmd = global.commands.get(command);
        const cooldownAmount = (cmd.cooldowns || this.cooldownTime) * 1000;

        if (timestamps.has(sender)) {
            const expirationTime = timestamps.get(sender) + cooldownAmount;
            if (now < expirationTime) {
                return ((expirationTime - now) / 1000).toFixed(1);
            }
        }

        timestamps.set(sender, now);
        setTimeout(() => timestamps.delete(sender), cooldownAmount);
        return false;
    }

    canExecuteCommand(sender) {
        if (config.adminOnly.enable && !global.adminList.includes(sender.replace(/[^0-9]/g, ''))) {
            return false;
        }
        if (config.whiteListMode.enable && !global.whiteList.includes(sender.replace(/[^0-9]/g, ''))) {
            return false;
        }
        return true;
    }
}

module.exports = CommandManager;
