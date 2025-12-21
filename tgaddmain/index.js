require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const VIP_GROUP_LINK = process.env.VIP_GROUP_LINK;

if (!token || token === 'YOUR_BOT_TOKEN_HERE') {
    console.error('❌ Please add your bot token!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

const BANNER = 'https://knowledgewaveindia.com/botbanners/tgaddmain.jpeg';

// Single message with JOIN button
const MESSAGE = `
🔥📈 Want 10 FREE NON MTG BUG Quotex Signals ?

👉 Click on JOIN CHANNEL now! And you will get FREE 10 QUOTEX SIGNALS

🔗 LINK :👇👇👇👇 
https://t.me/+I82LN2bNpfc0MTFl
https://t.me/+I82LN2bNpfc0MTFl
https://t.me/+I82LN2bNpfc0MTFl

📈 20+ SIGNALS VIP SESSION 🚀 STARTING IN 5 MINUTES ⏰
`;

// Handle everything - always show JOIN button
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    
    const keyboard = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "✅ JOIN GROUP", url: VIP_GROUP_LINK }]
            ]
        }
    };

    // Send photo with JOIN button
    bot.sendPhoto(chatId, BANNER, {
        caption: MESSAGE,
        parse_mode: "HTML",
        ...keyboard
    }).catch(err => {
        // Fallback to text
        bot.sendMessage(chatId, MESSAGE, {
            parse_mode: "HTML",
            ...keyboard
        });
    });
});

console.log('✅ Bot running - Always shows JOIN button');