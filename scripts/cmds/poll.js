/**
 * Poll Command Example 
 * Creates a poll and handles responses when users reply
 */
module.exports = {
    name: "poll",
    alias: ["vote", "survey"],
    desc: "Create a simple poll",
    usage: "poll <question>",
    category: "Group",
    permission: 1, // Requires admin privileges
    cooldown: 10,
    isGroup: true,

    /**
     * Run the poll command
     */
    run: async ({ sock, m, args, sender, botNumber }) => {
        // Check if there's a question
        const question = args.join(" ");
        if (!question) {
            return await sock.sendMessage(
                m.key.remoteJid,
                { text: "❌ Please provide a question for the poll." },
                { quoted: m }
            );
        }

        // Initialize the poll options
        const pollOptions = {
            "👍 Yes": [],
            "👎 No": [],
            "🤔 Maybe": []
        };

        // Create a formatted display of the poll
        const createPollDisplay = () => {
            let display = `📊 *POLL*: ${question}\n\n`;

            Object.entries(pollOptions).forEach(([option, voters]) => {
                display += `${option}: ${voters.length} vote(s)\n`;
                if (voters.length > 0) {
                    display += voters.map(v => `  - ${v}`).join('\n') + '\n';
                }
                display += '\n';
            });

            display += "Reply to this message with 'yes', 'no', or 'maybe' to vote!";
            return display;
        };

        // Send the initial poll message
        const pollMessage = await sock.sendMessage(
            m.key.remoteJid,
            { text: createPollDisplay() },
            { quoted: m }
        );

        // Register the reply handler
        if (!global.yumi) global.yumi = {};
        if (!global.yumi.onReply) global.yumi.onReply = new Map();

        // Store the poll data with the message ID
        global.yumi.onReply.set(pollMessage.key.id, {
            messageID: pollMessage.key.id,
            messageKey: pollMessage.key, // Store the entire key object
            commandName: "poll",
            permission: 0, // Everyone can vote
            pollData: pollOptions,
            question: question,
            chatJid: m.key.remoteJid, // Store the chat JID
            callback: async ({ sock, m, replyData, sender, botNumber }) => {
                // Get user's vote
                const vote = m.body.trim().toLowerCase();
                const voterName = m.pushName || sender.split('@')[0];

                // Process the vote
                let voted = false;
                if (vote === 'yes' || vote === 'y') {
                    // Remove user from other options if they already voted
                    Object.keys(replyData.pollData).forEach(option => {
                        replyData.pollData[option] = replyData.pollData[option].filter(v => v !== voterName);
                    });
                    // Add user to the yes option
                    replyData.pollData["👍 Yes"].push(voterName);
                    voted = true;
                } else if (vote === 'no' || vote === 'n') {
                    // Remove user from other options if they already voted
                    Object.keys(replyData.pollData).forEach(option => {
                        replyData.pollData[option] = replyData.pollData[option].filter(v => v !== voterName);
                    });
                    // Add user to the no option
                    replyData.pollData["👎 No"].push(voterName);
                    voted = true;
                } else if (vote === 'maybe' || vote === 'm') {
                    // Remove user from other options if they already voted
                    Object.keys(replyData.pollData).forEach(option => {
                        replyData.pollData[option] = replyData.pollData[option].filter(v => v !== voterName);
                    });
                    // Add user to the maybe option
                    replyData.pollData["🤔 Maybe"].push(voterName);
                    voted = true;
                }

                if (voted) {
                    try {
                        // Fixed: Properly structure the edit message request
                        await sock.sendMessage(
                            replyData.chatJid,
                            { 
                                text: createPollDisplay(),
                                edit: {
                                    key: {
                                        remoteJid: replyData.chatJid,
                                        id: replyData.messageID,
                                        fromMe: true
                                    }
                                }
                            }
                        );

                        // Thank the user for voting
                        await sock.sendMessage(
                            m.key.remoteJid,
                            { text: `Thanks for voting, ${voterName}!` },
                            { quoted: m }
                        );
                    } catch (error) {
                        console.error("Error updating poll:", error);

                        // Fallback: Send a new message if editing fails
                        await sock.sendMessage(
                            m.key.remoteJid,
                            { 
                                text: `${createPollDisplay()}\n\n[Updated poll - couldn't edit original message]` 
                            },
                            { quoted: { key: replyData.messageKey } }
                        );
                    }
                } else {
                    // Invalid vote
                    await sock.sendMessage(
                        m.key.remoteJid,
                        { text: `Please reply with 'yes', 'no', or 'maybe' to vote.` },
                        { quoted: m }
                    );
                }
            }
        });

        // Auto-delete the poll after 24 hours
        setTimeout(() => {
            if (global.yumi?.onReply?.has(pollMessage.key.id)) {
                global.yumi.onReply.delete(pollMessage.key.id);
            }
        }, 24 * 60 * 60 * 1000);
    }
};