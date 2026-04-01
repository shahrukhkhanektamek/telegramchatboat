const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

console.log("🚀 Bot starting...");
console.log("BOT_TOKEN loaded:", !!process.env.BOT_TOKEN);
console.log("VIDEO_PATH:", process.env.VIDEO_PATH);
console.log("SUPPORT_LINK:", process.env.SUPPORT_LINK);

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("chat_join_request", async (msg) => {
  console.log("\n📩 Join request received");
  console.log("Full msg:", JSON.stringify(msg, null, 2));

  const userId = msg.from.id;
  const groupId = msg.chat.id;

  console.log("User ID:", userId);
  console.log("Group ID:", groupId);

  // console.log("asfs");

  try {
    console.log("➡️ Trying to send video note...");

    // ✅ 1. Auto-approve join request
    // await bot.approveChatJoinRequest(groupId, userId);

    // ✅ 2. Send circle video (video note) with inline buttons — no text
    await bot.sendVideoNote(userId, fs.createReadStream(process.env.VIDEO_PATH), {
      reply_markup: {
        inline_keyboard: [
          // [{ text: "🚀 Start Now", url: process.env.REGISTER_LINK }],
          [{ text: "💬 Message Now", url: process.env.SUPPORT_LINK }],
        ],
      },
    });

    console.log(`✅ Sent circle video with buttons to ${msg.from.username}`);
  } catch (err) {
    console.error("❌ Error:");
    console.error("Message:", err.message);
    console.error("Full Error:", err);
  }
});

console.log("🚀 Bot is running...");