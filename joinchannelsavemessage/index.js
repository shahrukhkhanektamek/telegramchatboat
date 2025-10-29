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
const EXCEL_PATH = path.join(__dirname, "leads_live.xlsx");
const EXPORT_FOLDER = process.env.EXPORT_FOLDER || "./exports";

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing in .env");
  process.exit(1);
}

console.log("📂 Excel file location:", path.resolve(EXCEL_PATH));

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
    console.log("🆕 Excel file created with Age column.");
  }
}

async function addToExcel(data) {
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    const ws = wb.getWorksheet("Leads");

    // 🔍 Check for duplicate numbers (ignore header)
    const existingNumbers = ws
      .getColumn("C")
      .values.filter((v) => v && v !== "Number")
      .map((v) => String(v).trim());

    if (existingNumbers.includes(data.number)) {
      console.log(`⚠️ Duplicate number skipped: ${data.number}`);
      return false;
    }

    // ✅ Add next visible row
    const nextSno = ws.rowCount; // includes header row
    const newRow = [
      nextSno, // S.No
      data.name,
      data.number,
      data.age || "",
      data.username,
      data.chatId,
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    ];

    ws.addRow(newRow);

    await wb.xlsx.writeFile(EXCEL_PATH);
    console.log(`✅ Lead saved to Excel: ${data.name} - ${data.number}`);
    return true;
  } catch (err) {
    console.error("❌ Excel write error:", err);
    return false;
  }
}

// ---------------- TEXT HANDLER ----------------
bot.start(async (ctx) => {
  await ensureExcel();
  ctx.reply(
    "👋 Hello! Main tumhara lead collector bot hoon.\nAap apni details is format me bheje:\n\nMy Name- Rahul\nMy Mobile- 1122334455\nMy Age- 23",
    { parse_mode: "Markdown" }
  );
});

bot.on("text", async (ctx) => {
  console.log("📩 Received message:", ctx.message.text);

  const msg = ctx.message.text;
  const username = ctx.from.username || "";
  const chatId = ctx.chat.id;

  // ✅ Extract Name, Mobile, Age (supports -, :, =)
  const nameMatch = msg.match(/My\s*Name\s*[-:=]?\s*([A-Za-z ]+)/i);
  const numberMatch = msg.match(/My\s*Mobile\s*[-:=]?\s*([0-9]{10})/i);
  const ageMatch = msg.match(/My\s*Age\s*[-:=]?\s*([0-9]{1,3})/i);

  const name = nameMatch ? nameMatch[1].trim() : null;
  const number = numberMatch ? numberMatch[1].trim() : null;
  const age = ageMatch ? ageMatch[1].trim() : null;

  console.log("📥 Parsed ->", { name, number, age });

  if (number && name) {
    const added = await addToExcel({ name, number, age, username, chatId });
    if (added)
      ctx.reply(
        `✅ Saved successfully!\nName: ${name}\nNumber: ${number}\nAge: ${age || "N/A"}`
      );
    else ctx.reply(`⚠️ Number already exists: ${number}`);
  } else {
    ctx.reply(
      "❌ Format incorrect! Please send like:\n\nMy Name- Rahul\nMy Mobile- 1122334455\nMy Age- 23"
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

// ---------------- AUTO EXPORT (11:59 PM) ----------------
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

// ---------------- JOIN REQUEST ----------------
bot.on("chat_join_request", async (ctx) => {
  try {
    const userId = ctx.chatJoinRequest.from.id;
    const chatId = ctx.chatJoinRequest.chat.id;
    await ctx.telegram.approveChatJoinRequest(chatId, userId);

    await ctx.telegram.sendVideoNote(
      userId,
      { source: VIDEO_PATH },
      {
        reply_markup: {
          inline_keyboard: [[{ text: "💬 Message Now", url: SUPPORT_LINK }]],
        },
      }
    );

    console.log(`✅ Sent video to ${ctx.chatJoinRequest.from.username || userId}`);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
});

// ---------------- START ----------------
(async () => {
  await ensureExcel();
  await bot.launch();
  console.log("🚀 Bot launched successfully (Excel + Join Video Ready)");
})();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
