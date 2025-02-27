const { getPermissionLevel } = require("../../utils/permission");
const { logError } = require("../../utils/logger");
const { commands, aliases } = global; // Ensure global.commands and global.aliases are initialized

module.exports = {
 name: "help",
 description: "View command usage and list all available commands",
 category: "info",
 permission: 0,

 run: async ({ sock, m, args, sender, botNumber }) => {
 try {
 const prefix = global.prefix;
 const userRole = getPermissionLevel(sender);
 
 if (args.length === 0) {
 let categories = {};
 let msg = "╔══════════════╗\n *PERFECT CMD💐*\n╚══════════════╝\n";

 for (const [name, command] of commands.entries()) {
 if (command.permission > userRole) continue; // Skip commands user cannot access

 const category = command.category || "Uncategorized";
 if (!categories[category]) categories[category] = [];
 categories[category].push(name);
 }

 Object.keys(categories).forEach((category) => {
 if (category !== "info") {
 msg += `\n╭────────────⭓\n│『 *${category.toUpperCase()}* 』`;

 categories[category].sort().forEach((cmd) => {
 msg += `\n│✧ ${cmd}`;
 });

 msg += `\n╰────────⭓`;
 }
 });

 const totalCommands = commands.size;
 msg += `\n\nCurrently, I have *${totalCommands}* commands available. More commands will be added soon!\n`;
 msg += `\n_Type *${prefix}help commandName* to view details of a specific command._\n`;
 msg += `\n💫 *MR PERFECT AI* 💫`;

 // Random help images/gifs
 const helpListImages = [
 "https://i.imgur.com/WHRGiPz.gif",
 "https://i.imgur.com/zM4Hvmn.gif",
 "https://i.imgur.com/8d6WbRJ.gif",
 "https://i.imgur.com/aYS6HRa.mp4",
 "https://i.imgur.com/AIz8ASV.jpeg",
 "https://i.imgur.com/6vAPXOY.gif",
 ];
 const helpListImage = helpListImages[Math.floor(Math.random() * helpListImages.length)];

 await sock.sendMessage(m.key.remoteJid, {
 text: msg,
 image: { url: helpListImage },
 footer: "PERFECT AI Bot",
 });

 } else {
 const commandName = args[0].toLowerCase();
 const command = commands.get(commandName) || commands.get(aliases.get(commandName));

 if (!command) {
 return await sock.sendMessage(
 m.key.remoteJid,
 { text: `⚠️ Command "*${commandName}*" not found.` },
 { quoted: m }
 );
 }

 const roleText = roleToString(command.permission);
 const description = command.description || "No description available.";
 const usage = command.usage ? command.usage.replace(/{prefix}/g, prefix) : `*${prefix}${command.name}*`;

 const response = `╭── *COMMAND INFO* ────⭓
│ *Name:* ${command.name}
│ *Description:* ${description}
│ *Category:* ${command.category || "Uncategorized"}
│ *Aliases:* ${command.aliases ? command.aliases.join(", ") : "None"}
│ *Role Required:* ${roleText}
│ *Usage:* ${usage}
╰━━━━━━━━━❖`;

 await sock.sendMessage(m.key.remoteJid, { text: response }, { quoted: m });
 }
 } catch (err) {
 logError(`Error in help command: ${err.message}`);
 await sock.sendMessage(
 m.key.remoteJid,
 { text: "❌ An error occurred while fetching the help menu." },
 { quoted: m }
 );
 }
 },
};

// Function to convert role numbers to text
function roleToString(role) {
 switch (role) {
 case 0:
 return "All users";
 case 1:
 return "Group Admins";
 case 2:
 return "Bot Admins";
 default:
 return "Unknown Role";
 }
}