const fs = require('fs');
const path = require('path');
const { proto, WA_GROUP_METADATA } = require('@whiskeysockets/baileys'); 
const config = require('../config.json');

const botAdmins = config.adminOnly.adminNumbers || [];

/**
 * Check if a user is a bot admin
 * @param {string} userNumber
 * @returns {boolean}
 */
const isBotAdmin = (userNumber) => {
    return botAdmins.includes(userNumber);
};

/**
 * Check if a user is a group admin
 * @param {string} userNumber
 * @param {object} groupMetadata
 * @returns {boolean}
 */
const isGroupAdmin = (userNumber, groupMetadata) => {
    if (!groupMetadata || !groupMetadata.participants) return false;
    const adminList = groupMetadata.participants.filter(participant => participant.admin);
    return adminList.some(admin => admin.id.replace(/[^0-9]/g, '') === userNumber);
};

/**
 * Get user permission level
 * @param {string} userNumber
 * @param {object} groupMetadata
 * @returns {number} Permission level (0: All, 1: Group Admins & Bot Admins, 2: Bot Admins Only)
 */
const getPermissionLevel = (userNumber, groupMetadata = null) => {

    if (isBotAdmin(userNumber)) return 2;
    if (groupMetadata && isGroupAdmin(userNumber, groupMetadata)) return 1;


    return 0;
};

/**
 * Check if user can use the bot based on permission level
 * @param {string} userNumber
 * @param {object} groupMetadata
 * @param {string} chatType ('group' or 'personal')
 * @returns {boolean} true if the user can use the bot
 */
const canUseBot = (userNumber, groupMetadata = null, chatType = 'group') => {
    const permissionLevel = getPermissionLevel(userNumber, groupMetadata);

    if (permissionLevel === 2) {
        return true;
    }


    if (permissionLevel === 1) {
        if (chatType === 'group') {
            return true; 
        }
        return permissionLevel === 2;
    }

    if (permissionLevel === 0) {
        return true; 

    }

    return false;
};

module.exports = {
    isBotAdmin,
    isGroupAdmin,
    getPermissionLevel,
    canUseBot
};