// ================================
// 💬 HARSH VIKAL LEAD BOT (Fixed)
// ================================

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const XLSX = require('xlsx');
const cron = require('node-cron');
console.log("🤖 Telegram Lead Bot is running and polling for messages...");
// 🔑 Bot Token
const token = '8105518486:AAFBMQBb78235RbuGsDXAnO9MRbVHqDBryk';

// 👑 Your Telegram ID
const ADMIN_ID = 8179330632;

// 📱 Initialize bot
const bot = new TelegramBot(token, { polling: true });

// 📘 Excel filename
const FILE_NAME = 'personal_chat_leads.xlsx';

// 🧾 Function to save lead to Excel
function saveLeadToExcel(lead) {
  let data = [];

  if (fs.existsSync(FILE_NAME)) {
    const workbook = XLSX.readFile(FILE_NAME);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    data = XLSX.utils.sheet_to_json(worksheet);
  }

  // Append new lead
  data.push(lead);

  // Create new workbook and sheet
  const newWorkbook = XLSX.utils.book_new();
  const newWorksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, 'Leads');

  // Write to file
  XLSX.writeFile(newWorkbook, FILE_NAME);
}

// 📥 Listen for private messages
bot.on('message', (msg) => {
  const text = msg.text;

  // Only handle private chat messages
  if (msg.chat.type === 'private' && typeof text === 'string') {
    const nameMatch = text.match(/My Name[-:]?\s*(.+)/i);
    const mobileMatch = text.match(/My Mobile[-:]?\s*(\+?\d[\d\s-]{7,14})/i);
    const ageMatch = text.match(/My Age[-:]?\s*(\d{1,2})/i);

    if (mobileMatch) {
      const lead = {
        Name: nameMatch ? nameMatch[1].trim() : 'Not Given',
        Mobile: mobileMatch ? mobileMatch[1].trim() : 'Not Given',
        Age: ageMatch ? ageMatch[1].trim() : 'Not Given',
        Username: msg.from.username || 'No Username',
        Chat_ID: msg.chat.id,
        Time: new Date().toLocaleString('en-IN'),
      };

      // Save to Excel
      saveLeadToExcel(lead);
      console.log('✅ Lead Saved:', lead);

      // Notify user
      bot.sendMessage(msg.chat.id, '✅ Your details have been saved successfully!');
    }
  }
});

// 📤 Manual export (for admin)
bot.onText(/\/export/, (msg) => {
  if (msg.chat.id === ADMIN_ID) {
    if (fs.existsSync(FILE_NAME)) {
      const workbook = XLSX.readFile(FILE_NAME);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length > 0) {
        bot.sendDocument(ADMIN_ID, FILE_NAME, {}, { filename: FILE_NAME });
      } else {
        bot.sendMessage(ADMIN_ID, '⚠️ No leads found in the file.');
      }
    } else {
      bot.sendMessage(ADMIN_ID, '❌ No leads file exists yet.');
    }
  } else {
    bot.sendMessage(msg.chat.id, '🚫 You are not authorized to export leads.');
  }
});

// ⏰ Auto send file daily at 11:59 PM (IST)
cron.schedule('59 23 * * *', () => {
  if (fs.existsSync(FILE_NAME)) {
    const workbook = XLSX.readFile(FILE_NAME);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length > 0) {
      bot.sendDocument(ADMIN_ID, FILE_NAME, {}, { filename: FILE_NAME });
      console.log('📤 Auto file sent at 11:59 PM');
    } else {
      console.log('⚠️ No data to send at 11:59 PM');
    }
  } else {
    console.log('❌ No Excel file found for auto send.');
  }
});
