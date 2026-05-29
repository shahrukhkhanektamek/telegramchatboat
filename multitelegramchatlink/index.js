const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const supportLinks = [
  "https://t.me/m/ykDJl00qMGU9",
  "https://t.me/m/Fsnv5UEVYThl",
  "https://t.me/m/ibLi7bOnZjk9"
];

const INDEX_FILE = "currentIndex.json";

function loadIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      const data = fs.readFileSync(INDEX_FILE, "utf8");
      const json = JSON.parse(data);
      return json.index;
    }
  } catch (err) {}
  return 0;
}

function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify({ index }));
}

let currentIndex = loadIndex();

function getNextSupportLink() {
  const link = supportLinks[currentIndex % supportLinks.length];
  currentIndex++;
  saveIndex(currentIndex);
  console.log(`🔗 Link #${currentIndex} (${(currentIndex-1) % supportLinks.length + 1}/${supportLinks.length})`);
  return link;
}

bot.on("chat_join_request", async (msg) => {
  const userId = msg.from.id;
  const groupId = msg.chat.id;

  try {
    // await bot.approveChatJoinRequest(groupId, userId);
    
    await bot.sendVideoNote(userId, fs.createReadStream(process.env.VIDEO_PATH), {
      reply_markup: {
        inline_keyboard: [
          [{ text: "💬 Message Now", url: getNextSupportLink() }],
        ],
      },
    });

    console.log(`✅ Sent to ${msg.from.username}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
});

console.log(`🚀 Bot running | Next link will be #${currentIndex + 1}`);