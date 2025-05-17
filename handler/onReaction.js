const { hasPermission } = require('../utils/permission');
const { logInfo, logSuccess, logError, logWarning } = require('../utils/logger');

/**
 * Handles message reactions that correspond to registered handlers
 * @param {Object} params - Parameters object
 * @param {Object} params.sock - The WhatsApp socket connection
 * @param {Object} params.m - The message object
 * @param {String} params.sender - The sender's ID
 * @param {String} params.botNumber - The bot's ID
 * @param {Object} params.messageInfo - Additional message info including target message ID
 * @returns {Promise<boolean>} - Returns true if reaction was handled, false otherwise
 */
const handleReaction = async ({ sock, m, sender, botNumber, messageInfo }) => {
    try {
        // Extract necessary information
        const reaction = messageInfo.reaction;
        const targetMessageID = messageInfo.targetMessageID;

        if (!targetMessageID || !reaction) {
            return false;
        }

        // Extract chat ID (where the message was sent)
        const chatId = m.key.remoteJid;

        // Extract clean user number from sender
        const userNumber = sender.replace(/[^0-9]/g, '');

        // Initialize global.yumi if not exists
        if (!global.yumi) {
            global.yumi = {};
            logInfo('Initialized global.yumi object');
        }

        // Initialize reaction handlers map if not exists
        if (!global.yumi.onReaction) {
            global.yumi.onReaction = new Map();
            logInfo('Initialized reaction handlers map');
        }

        // Check if this message has a registered reaction handler
        if (!global.yumi.onReaction.has(targetMessageID)) {
            return false;
        }

        logInfo(`Reaction detected: ${reaction} to message ${targetMessageID.substring(0, 8)}... from ${userNumber}`);

        // Get the reaction handler data
        const handlerData = global.yumi.onReaction.get(targetMessageID);

        // Add delete method to handler data if not exists
        if (!handlerData.delete) {
            handlerData.delete = function() {
                global.yumi.onReaction.delete(targetMessageID);
                logInfo(`Reaction handler for message ${targetMessageID.substring(0, 8)}... deleted`);
            };
        }

        // Set timeout for auto-expiration if not already set
        if (!handlerData.expirationSet && handlerData.expireAfter) {
            handlerData.expirationSet = true;
            setTimeout(() => {
                if (global.yumi.onReaction.has(targetMessageID)) {
                    global.yumi.onReaction.delete(targetMessageID);
                    logInfo(`Reaction handler for message ${targetMessageID.substring(0, 8)}... expired after ${handlerData.expireAfter}ms`);
                }
            }, handlerData.expireAfter);
        }

        // Check if user has permission to use this reaction handler
        const requiredPermission = handlerData.permission || 0;
        const groupMetadata = handlerData.groupMetadata || null;

        if (!hasPermission(userNumber, groupMetadata, requiredPermission)) {
            if (handlerData.notifyPermissionErrors) {
                try {
                    await sock.sendMessage(
                        chatId,
                        { text: "⚠️ You don't have permission to use this reaction." },
                        { quoted: m }
                    );
                } catch (sendErr) {
                    logError(`Failed to send permission error: ${sendErr.message}`);
                }
            }

            logInfo(`User ${userNumber} doesn't have permission for reaction handler from ${handlerData.commandName || 'unknown command'}`);
            return true; // We handled it by denying it
        }

        // Check for required reaction if specified
        if (handlerData.requiredReaction && reaction !== handlerData.requiredReaction) {
            if (handlerData.notifyWrongReaction) {
                try {
                    await sock.sendMessage(
                        chatId,
                        { text: `⚠️ Please use ${handlerData.requiredReaction} reaction.` },
                        { quoted: m }
                    );
                } catch (sendErr) {
                    logError(`Failed to send wrong reaction message: ${sendErr.message}`);
                }
            }

            logInfo(`User ${userNumber} used wrong reaction: ${reaction}, required: ${handlerData.requiredReaction}`);
            return true; // We handled it by denying it
        }

        try {
            // Pass control to the command module that registered this reaction
            // This allows each command to define its own reaction handling logic
            if (handlerData.commandName && global.commands && global.commands.has(handlerData.commandName)) {
                const command = global.commands.get(handlerData.commandName);

                // Check if command has a handleReaction method
                if (typeof command.handleReaction === 'function') {
                    logInfo(`Delegating reaction handling to ${handlerData.commandName} command`);

                    // Call the command's handleReaction method
                    await command.handleReaction({
                        sock,
                        m,
                        sender,
                        reaction,
                        targetMessageID,
                        handlerData,
                        chatId,
                        userNumber
                    });

                    logSuccess(`Successfully processed reaction for ${handlerData.commandName}`);
                    return true;
                }
            }

            // If we're here, there's no command-specific handler, check for a generic callback
            if (typeof handlerData.onReaction === 'function') {
                logInfo(`Executing generic reaction callback`);

                // Execute the callback with all relevant data
                await handlerData.onReaction({
                    sock,
                    m,
                    sender,
                    reaction,
                    targetMessageID,
                    handlerData,
                    chatId,
                    userNumber,
                    delete: handlerData.delete
                });

                logSuccess(`Successfully executed generic reaction handler`);
                return true;
            }

            // No handler found
            logInfo(`No reaction handler implementation found for ${targetMessageID}`);
            return false;
        } catch (execErr) {
            logError(`Error processing reaction: ${execErr.message}`);

            // Optionally notify user of error
            if (handlerData.notifyErrors) {
                try {
                    await sock.sendMessage(
                        chatId,
                        { text: `❌ Error processing your reaction: ${execErr.message}` },
                        { quoted: m }
                    );
                } catch (sendErr) {
                    logError(`Failed to send error message: ${sendErr.message}`);
                }
            }

            return true;
        } finally {
            // Auto-delete the handler if specified
            if (handlerData.autoDelete) {
                handlerData.delete();
            }
        }
    } catch (err) {
        logError(`Critical error in reaction handler: ${err.message}`);
        console.error(err); // Log full error for debugging
        return false;
    }
};

/**
 * Register a new reaction handler
 * @param {Object} params - The handler configuration object
 * @param {String} params.messageId - The message ID to watch for reactions
 * @param {Function} params.callback - The callback function to execute when a reaction is detected
 * @param {Number} params.permission - The permission level required to use this handler (0-2)
 * @param {Boolean} params.autoDelete - Whether to delete the handler after execution
 * @param {Boolean} params.notifyErrors - Whether to notify users of errors
 * @param {String} params.commandName - The command name that registered this handler
 * @param {Number} params.expireAfter - Time in milliseconds after which the handler expires
 * @returns {Function} - A function to manually delete the handler
 */
const registerReactionHandler = (params) => {
    // Initialize global.yumi if not exists
    if (!global.yumi) {
        global.yumi = {};
    }

    // Initialize reaction handlers map if not exists
    if (!global.yumi.onReaction) {
        global.yumi.onReaction = new Map();
    }

    // Set default values
    const handlerData = {
        permission: params.permission || 0,
        autoDelete: params.autoDelete ?? true,
        notifyErrors: params.notifyErrors ?? true,
        notifyPermissionErrors: params.notifyPermissionErrors ?? true,
        notifyWrongReaction: params.notifyWrongReaction ?? true,
        commandName: params.commandName || null,
        expireAfter: params.expireAfter || 5 * 60 * 1000, // Default 5 minutes
        requiredReaction: params.requiredReaction || null,
        groupMetadata: params.groupMetadata || null,
        onReaction: params.callback,
        createdAt: Date.now()
    };

    // Save handler in global map
    global.yumi.onReaction.set(params.messageId, handlerData);

    logInfo(`Registered reaction handler for message ${params.messageId.substring(0, 8)}...`);

    // Set timeout for auto-expiration
    if (handlerData.expireAfter) {
        handlerData.expirationSet = true;
        setTimeout(() => {
            if (global.yumi.onReaction.has(params.messageId)) {
                global.yumi.onReaction.delete(params.messageId);
                logInfo(`Reaction handler for message ${params.messageId.substring(0, 8)}... expired after ${handlerData.expireAfter}ms`);
            }
        }, handlerData.expireAfter);
    }

    // Return delete function
    return function() {
        global.yumi.onReaction.delete(params.messageId);
        logInfo(`Reaction handler for message ${params.messageId.substring(0, 8)}... manually deleted`);
    };
};

/**
 * Get all active reaction handlers
 * @returns {Map} - Map of all active reaction handlers
 */
const getActiveReactionHandlers = () => {
    if (!global.yumi || !global.yumi.onReaction) {
        return new Map();
    }
    return global.yumi.onReaction;
};

/**
 * Clear all reaction handlers
 */
const clearAllReactionHandlers = () => {
    if (global.yumi && global.yumi.onReaction) {
        const count = global.yumi.onReaction.size;
        global.yumi.onReaction.clear();
        logWarning(`Cleared all ${count} reaction handlers`);
    }
};

module.exports = { 
    handleReaction,
    registerReactionHandler,
    getActiveReactionHandlers,
    clearAllReactionHandlers
};