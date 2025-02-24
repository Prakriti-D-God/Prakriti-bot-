const moment = require('moment-timezone');
const gradient = require('gradient-string');

const gradients = {
    lime: gradient('#32CD32', '#ADFF2F'),
    cyan: gradient('#00FFFF', '#00BFFF'),
    instagram: gradient(['#F58529', '#DD2A7B', '#8134AF', '#515BD4']),
    purple: gradient('#9B59B6', '#8E44AD'),
    blue: gradient('#2980B9', '#3498DB'),
    red: gradient('#FF6347', '#FF4500'),
    yellow: gradient('#FFDD00', '#FF6347'),
    rainbow: gradient.rainbow
};

const getNepalTime = () => {
    return moment().tz('Asia/Kathmandu').format('YYYY-MM-DD HH:mm:ss');
};

const logInfo = (message) => {
    console.log(gradients.lime(`[INFO] ${message}`));
};

const logSuccess = (message) => {
    console.log(gradients.cyan(`[SUCCESS] ${message}`));
};

const logError = (message) => {
    console.log(gradients.instagram(`[ERROR] ${message}`));
};


const logMessageDetails = ({ ownerId, sender, groupName, message, reactions = null, timezone }) => {
    const time = getNepalTime();

    console.log(gradient.rainbow("-".repeat(37) + "\n"));

    console.log(gradients.rainbow("[INFO]")); 

    console.log(`    ${gradients.yellow('Owner ID:')} ${gradients.purple(ownerId.join(', '))}`);
    console.log(`    ${gradients.blue('Sender:')} ${gradients.purple(sender)}`);
    console.log(`    ${gradients.yellow('Group Name:')} ${gradients.purple(groupName || 'Unknown Group')}`);
    console.log(`    ${gradients.blue('Message:')} ${gradients.purple(message || '[No Message]')}`);

    if (reactions) {
        console.log(`    ${gradients.blue('Reactions:')}`);
        console.log(`        ${gradients.green('User:')} ${gradients.purple(reactions.user)}`);
        console.log(`        ${gradients.yellow('Emoji:')} ${gradients.red(reactions.emoji)}`);
    } else {
        console.log(`    ${gradients.blue('Reactions:')} ${gradients.red('None')}`);
    }

    console.log(`    ${gradients.yellow('Timezone:')} ${gradients.red(timezone)}`);
    console.log(`    ${gradients.yellow('Logged At:')} ${gradients.red(time)}`);

        console.log(gradient.rainbow("-".repeat(37) + "\n"));
    console.log(gradient.rainbow("\n======= Thanks to Mr perfect ========\n"));

};


module.exports = {
    logInfo,
    logSuccess,
    logError,
    logMessageDetails
};
