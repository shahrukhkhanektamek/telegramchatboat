import TelegramBot from "node-telegram-bot-api";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const caption = `
🎉 *Welcome to BitFunded!* 🚀

Watch this short video to get started with funded accounts.
👇 Tap below to begin:
`;

bot.on("chat_join_request", async (msg) => {
  const userId = msg.from.id;
  const groupId = msg.chat.id;

  try {
    // 1️⃣ Approve the join request automatically
    await bot.approveChatJoinRequest(groupId, userId);

    // 2️⃣ Send welcome video + message
    await bot.sendVideo(userId, fs.createReadStream(process.env.VIDEO_PATH), {
      caption,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🚀 Register Now", url: process.env.REGISTER_LINK }],
          [{ text: "💬 Contact Support", url: process.env.SUPPORT_LINK }],
        ],
      },
    });

    console.log(`✅ Sent video to ${msg.from.username}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
});

console.log("🚀 Bot is running...");
