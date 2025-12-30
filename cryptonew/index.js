// import TelegramBot from "node-telegram-bot-api";
// import fs from "fs";
// import dotenv from "dotenv";

const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const dotenv = require("dotenv");



dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("chat_join_request", async (msg) => {
  const userId = msg.from.id;
  const groupId = msg.chat.id;

  console.log("asfs");

  try {
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
    console.error("❌ Error:", err.message);
  }
});

console.log("🚀 Bot is running...");
