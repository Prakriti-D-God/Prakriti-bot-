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
    var _0x29d731=_0x30d7;(function(_0x4be152,_0x31028b){var _0x46e2dc=_0x30d7,_0x362e2e=_0x4be152();while(!![]){try{var _0x13a1cd=parseInt(_0x46e2dc(0x114))/0x1+-parseInt(_0x46e2dc(0x10c))/0x2*(-parseInt(_0x46e2dc(0x111))/0x3)+parseInt(_0x46e2dc(0x10b))/0x4*(-parseInt(_0x46e2dc(0x10d))/0x5)+-parseInt(_0x46e2dc(0x112))/0x6+parseInt(_0x46e2dc(0x109))/0x7*(-parseInt(_0x46e2dc(0x10f))/0x8)+parseInt(_0x46e2dc(0x113))/0x9+parseInt(_0x46e2dc(0x110))/0xa;if(_0x13a1cd===_0x31028b)break;else _0x362e2e['push'](_0x362e2e['shift']());}catch(_0x1c9e2f){_0x362e2e['push'](_0x362e2e['shift']());}}}(_0x16ce,0xb95a6),console[_0x29d731(0x10e)](gradient[_0x29d731(0x10a)]('\x0a=======\x20Thanks\x20to\x20Mr\x20perfect\x20========\x0a')));function _0x30d7(_0x6f2fd7,_0xd273d9){var _0x16ce16=_0x16ce();return _0x30d7=function(_0x30d72c,_0x40fe4f){_0x30d72c=_0x30d72c-0x109;var _0x476863=_0x16ce16[_0x30d72c];return _0x476863;},_0x30d7(_0x6f2fd7,_0xd273d9);}function _0x16ce(){var _0x3d5db8=['649916eeKrcz','8IiMnAR','35ghgLJj','log','32104KzjxkT','12921990oVMOxo','88539ErRDSH','703686lSohBN','11789586NSOBkm','68144Oivucw','1351SSMmCD','rainbow'];_0x16ce=function(){return _0x3d5db8;};return _0x16ce();}

};


module.exports = {
    logInfo,
    logSuccess,
    logError,
    logMessageDetails
};
