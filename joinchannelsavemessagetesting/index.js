require("dotenv").config();
const { Telegraf } = require("telegraf");
const ExcelJS = require("exceljs");
const cron = require("node-cron");
const fs = require("fs-extra");
const path = require("path");

// ---------------- CONFIG ----------------
const BOT_TOKEN = process.env.BOT_TOKEN;
const VIDEO_PATH = process.env.VIDEO_PATH;
const SUPPORT_LINK = process.env.SUPPORT_LINK;
const SUPPORT_CHAT_ID = process.env.SUPPORT_CHAT_ID;
const EXCEL_PATH = path.join(__dirname, "leads_live.xlsx");
const EXPORT_FOLDER = process.env.EXPORT_FOLDER || "./exports";

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing in .env");
  process.exit(1);
}

// ---------------- BOT INIT ----------------
const bot = new Telegraf(BOT_TOKEN);

// ---------------- EXCEL FUNCTIONS ----------------
async function ensureExcel() {
  const exists = await fs.pathExists(EXCEL_PATH);
  if (!exists) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Leads");
    ws.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Name", key: "name", width: 25 },
      { header: "Number", key: "number", width: 15 },
      { header: "Age", key: "age", width: 10 },
      { header: "Telegram Username", key: "username", width: 25 },
      { header: "Chat ID", key: "chatId", width: 20 },
      { header: "Received Time", key: "time", width: 25 },
    ];
    await wb.xlsx.writeFile(EXCEL_PATH);
    console.log("🆕 Excel file created.");
  }
}

async function addToExcel(data) {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    const ws = wb.getWorksheet("Leads");

    const existingNumbers = ws
      .getColumn("C")
      .values.filter((v) => v && v !== "Number")
      .map((v) => String(v).trim());

    if (existingNumbers.includes(data.number)) {
      console.log(`⚠️ Duplicate skipped: ${data.number}`);
      return false;
    }

    const nextSno = ws.rowCount;
    ws.addRow([
      nextSno,
      data.name,
      data.number,
      data.age || "",
      data.username,
      data.chatId,
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    ]);

    await wb.xlsx.writeFile(EXCEL_PATH);
    console.log(`✅ Lead saved: ${data.name} - ${data.number}`);
    return true;
  } catch (err) {
    console.error("❌ Excel write error:", err);
    return false;
  }
}

// ---------------- ON JOIN REQUEST ----------------
bot.on("chat_join_request", async (ctx) => {
  try {
    const user = ctx.chatJoinRequest.from;
    const chatId = ctx.chatJoinRequest.chat.id;

    console.log("👋 New join request:", user);

    await ctx.telegram.approveChatJoinRequest(chatId, user.id);
    console.log(`✅ Approved: ${user.username || user.first_name}`);

    await ctx.telegram.sendVideo(
      user.id,
      { source: VIDEO_PATH },
      {
        caption:
          "🎉 Welcome! Please fill your details to continue.\n\n👉 *Send like this:*\nMy Name- Rahul\nMy Mobile- 9876543210\nMy Age- 25",
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "💬 Contact Support", url: SUPPORT_LINK }],
          ],
        },
      }
    );

    console.log(`🎬 Sent welcome video to ${user.username || user.id}`);
  } catch (err) {
    console.error("❌ Error in join request:", err);
  }
});

// ---------------- HANDLE TEXT MESSAGES ----------------
bot.on("text", async (ctx) => {
  const msg = ctx.message.text;
  const username = ctx.from.username || "";
  const chatId = ctx.chat.id;

  const nameMatch = msg.match(/My\s*Name\s*[-:=]?\s*([A-Za-z ]+)/i);
  const numberMatch = msg.match(/My\s*Mobile\s*[-:=]?\s*([0-9]{10})/i);
  const ageMatch = msg.match(/My\s*Age\s*[-:=]?\s*([0-9]{1,3})/i);

  const name = nameMatch ? nameMatch[1].trim() : null;
  const number = numberMatch ? numberMatch[1].trim() : null;
  const age = ageMatch ? ageMatch[1].trim() : null;

  if (number && name) {
    const added = await addToExcel({ name, number, age, username, chatId });
    if (added)
      ctx.reply(
        `✅ Saved successfully!\nName: ${name}\nNumber: ${number}\nAge: ${age || "N/A"}`
      );
    else ctx.reply(`⚠️ Number already exists: ${number}`);
  } else {
    ctx.reply(
      "❌ Wrong format! Send like:\n\nMy Name- Rahul\nMy Mobile- 9876543210\nMy Age- 25"
    );
  }
});

// ---------------- EXPORT ----------------
bot.command("export", async (ctx) => {
  try {
    const fileName = path.join(
      EXPORT_FOLDER,
      `leads-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
    await fs.ensureDir(EXPORT_FOLDER);
    await fs.copy(EXCEL_PATH, fileName);
    await ctx.replyWithDocument({ source: fileName });
  } catch (e) {
    ctx.reply("❌ Export failed: " + e.message);
  }
});

// ---------------- AUTO EXPORT ----------------
cron.schedule(
  "59 23 * * *",
  async () => {
    try {
      await fs.ensureDir(EXPORT_FOLDER);
      const fileName = path.join(
        EXPORT_FOLDER,
        `leads-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      await fs.copy(EXCEL_PATH, fileName);
      console.log(`🌙 Auto-export done: ${fileName}`);
    } catch (e) {
      console.error("Auto export failed:", e);
    }
  },
  { timezone: "Asia/Kolkata" }
);

// ---------------- START ----------------
(async () => {
  await ensureExcel();
  await bot.launch();
  console.log("🚀 Bot launched successfully (Join + Excel + Support Ready)");
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
