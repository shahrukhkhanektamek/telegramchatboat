const TelegramBot = require('node-telegram-bot-api');

// ===== CONFIG ======
const botTokens = [
  '8263001683:AAH6ZRHDOJEwS-BMq2qDr2TNjIaGbbOLi0A',   
  '8282719585:AAEvZIa1rsl8PajYjF0OLJ4SuQi_hKA02mU',
  '8387703983:AAHVisPJDcalm8PNAj5tYZZlP-aTD5YyZd0',
  '8227198817:AAEF7qjBakj7B8fLorMGEE8egvbaYXYIOII',
]; // 6–12 bots

const channelId = -1002827035775; // private channel ID

// Emoji array for random reactions
const reactionEmojis = ['👍','❤️','🔥','💯','👏','🤩','🚀','✅','🥳','💎'];

const minReactions = 60;
const maxReactions = 70;

// Delay range in milliseconds (1-2 min)
const minDelay = 60 * 1000;   // 60 sec
const maxDelay = 120 * 1000;  // 120 sec
// ====================

// Initialize bots
const bots = botTokens.map(token => new TelegramBot(token, { polling: true }));
console.log('Bots started for private channel...');

// Function to get random integer
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Function to pick random emoji
function getRandomEmoji() {
    return reactionEmojis[Math.floor(Math.random() * reactionEmojis.length)];
}

// Function to send reactions
async function sendReactions(messageId) {
    const reactionsCount = getRandomInt(minReactions, maxReactions);
    let sentReactions = 0;

    async function sendNext() {
        if (sentReactions >= reactionsCount) return;

        const bot = bots[Math.floor(Math.random() * bots.length)];
        const emoji = getRandomEmoji();

        try {
            await bot.sendMessage(channelId, emoji, { reply_to_message_id: messageId });
            sentReactions++;
            console.log(`Reaction ${sentReactions}/${reactionsCount} sent: ${emoji}`);
        } catch (err) {
            console.log('Error sending reaction:', err);
        }

        // Random delay 1-2 min before next reaction
        const delay = getRandomInt(minDelay, maxDelay);
        setTimeout(sendNext, delay);
    }

    sendNext();
}

// Listen for new posts
bots[0].on('message', (msg) => {
    if (msg.chat.id === channelId) {
        console.log('New post detected in private channel, sending reactions...');
        sendReactions(msg.message_id);
    }
});