require("dotenv").config();
const { Telegraf } = require("telegraf");
const ExcelJS = require("exceljs");
const cron = require("node-cron");
const fs = require("fs-extra");
const path = require("path");

const BOT_TOKEN = process.env.BOT_TOKEN;
const EXCEL_PATH = process.env.EXCEL_PATH || "./leads_live.xlsx";
const EXPORT_FOLDER = process.env.EXPORT_FOLDER || "./exports";

const bot = new Telegraf(BOT_TOKEN);

// -----------------------------
// Excel Setup Functions
// -----------------------------
async function ensureExcel() {
  const exists = await fs.pathExists(EXCEL_PATH);
  if (!exists) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Leads");
    ws.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Name", key: "name", width: 25 },
      { header: "Number", key: "number", width: 15 },
      { header: "Telegram Username", key: "username", width: 25 },
      { header: "Chat ID", key: "chatId", width: 20 },
      { header: "Received Time", key: "time", width: 25 },
    ];
    await wb.xlsx.writeFile(EXCEL_PATH);
    console.log("🆕 Excel file created.");
  }
}

async function addToExcel(data) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const ws = wb.getWorksheet("Leads");

  // check for duplicate number
  const duplicate = ws.getColumn("C").values.find((v) => v === data.number);
  if (duplicate) {
    console.log(`⚠️ Duplicate number skipped: ${data.number}`);
    return false;
  }

  const newRow = {
    sno: ws.rowCount,
    name: data.name,
    number: data.number,
    username: data.username,
    chatId: data.chatId,
    time: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  };
  ws.addRow(newRow);
  await wb.xlsx.writeFile(EXCEL_PATH);
  console.log(`✅ Lead saved: ${data.name} - ${data.number}`);
  return true;
}

// -----------------------------
// Utility Functions
// -----------------------------
function extractNumber(text) {
  const match = text.match(/\b\d{10}\b/);
  return match ? match[0] : null;
}

function extractName(text, number) {
  if (!text) return "";
  return text.replace(number || "", "").trim();
}

// -----------------------------
// Bot Commands
// -----------------------------
bot.start(async (ctx) => {
  await ensureExcel();
  ctx.reply(
    "👋 Hello! Main tumhara lead collector bot hoon.\nBas apna *Name* aur *10-digit number* bhejo.\nExample: `Rahul 9876543210`",
    { parse_mode: "Markdown" }
  );
});

bot.on("text", async (ctx) => {
  const msg = ctx.message.text;
  const number = extractNumber(msg);
  const name = extractName(msg, number);
  const username = ctx.from.username || "";
  const chatId = ctx.chat.id;

  if (number && name) {
    const added = await addToExcel({ name, number, username, chatId });
    if (added) {
      ctx.reply(`✅ Saved successfully!\nName: ${name}\nNumber: ${number}`);
    } else {
      ctx.reply(`⚠️ Number already exists: ${number}`);
    }
  } else if (number && !name) {
    ctx.reply("📛 Number mil gaya! Ab apna naam bhejo.");
  } else if (!number && name.length > 1) {
    ctx.reply("📞 Ab apna 10-digit mobile number bhejo.");
  } else {
    ctx.reply("Please send like this: `Rahul 9876543210`", {
      parse_mode: "Markdown",
    });
  }
});

// manual export command
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

// -----------------------------
// Auto Export (every night 11:59 PM)
// -----------------------------
cron.schedule("59 23 * * *", async () => {
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
}, { timezone: "Asia/Kolkata" });

// -----------------------------
// Start Bot
// -----------------------------
(async () => {
  await ensureExcel();
  bot.launch();
  console.log("🚀 Bot started and Excel ready:", EXCEL_PATH);
})();

// graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
