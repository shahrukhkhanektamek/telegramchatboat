import fs from "fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input"; // For interactive login
import path from 'path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { NewMessage } from "telegram/events/index.js"; // ✅ Correct import for real-time

// ------------------- ES module __dirname setup -------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------ CONFIG ------------------
const API_ID = 29328940;
const API_HASH = 'ecde8d3d1a5f3d23d2d5fa76f7d7bca3';
const SESSION_FILE = path.join(__dirname, 'session.txt');    
const OUT_XLSX = path.join(__dirname, 'telegram_unique_numbers.xlsx');

// ---------------- Real-time Excel updater ----------------
const unique = new Map();
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet('numbers');
sheet.columns = [
  { header: 'Name', key: 'Name', width: 30 },
  { header: 'Mobile', key: 'Mobile', width: 20 },
  { header: 'Age', key: 'Age', width: 10 },
  { header: 'User ID', key: 'UserID', width: 15 },
  { header: 'Date (IST)', key: 'DateIST', width: 25 },
];

async function saveExcel() {
  await workbook.xlsx.writeFile(OUT_XLSX);
}

// ---------------- Parse text in given format ----------------
function parseUserInfo(text) {
  if (!text) return null;

  const nameMatch = text.match(/My Name[-:\s]*([^\n]+)/i);
  const mobileMatch = text.match(/My Mobile[-:\s]*([^\n]+)/i);
  const ageMatch = text.match(/My Age[-:\s]*([^\n]+)/i);

  if (nameMatch || mobileMatch || ageMatch) {
    return {
      Name: nameMatch ? nameMatch[1].trim() : '',
      Mobile: mobileMatch ? mobileMatch[1].trim() : '',
      Age: ageMatch ? ageMatch[1].trim() : '',
    };
  }
  return null;
}

// ---------------- Format date to IST ----------------
function formatDateToIST(date) {
  if (!date) return '';
  
  // Telegram msg.date can be Date object or UNIX timestamp in seconds
  const dt = typeof date === 'number' ? new Date(date * 1000) : new Date(date);

  return dt.toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(',', '');
}

// ---------------- Main ----------------
async function main() {
  const saved = fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, 'utf8').trim() : '';
  const stringSession = new StringSession(saved || '');
  const client = new TelegramClient(stringSession, API_ID, API_HASH, { connectionRetries: 5 });

  await client.start({
    phoneNumber: async () => await input.text('Enter your phone (with country code, e.g. +9198...): '),
    password: async () => await input.text('If you have 2FA enabled, enter password (else press Enter): '),
    phoneCode: async () => await input.text('Enter the code you received in Telegram: '),
    onError: (err) => console.log('Error while logging in:', err.message || err),
  });

  fs.writeFileSync(SESSION_FILE, client.session.save());
  console.log('✅ Logged in. Session saved.');

  // ---------------- Real-time message handler ----------------
  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg) return;

    let senderId = '';
    try {
      senderId = msg.sender?.id || msg.fromId?.userId || msg.fromId?.channelId || '';
    } catch {}

    const text = msg.message || (msg.text && typeof msg.text === 'string' ? msg.text : '');
    const userInfo = parseUserInfo(text);

    if (userInfo && userInfo.Mobile && !unique.has(userInfo.Mobile)) {
      unique.set(userInfo.Mobile, {
        ...userInfo,
        UserID: senderId,
        DateIST: msg.date ? formatDateToIST(msg.date) : ''
      });
      sheet.addRow(unique.get(userInfo.Mobile));
      await saveExcel();
      console.log(`➕ Saved: ${userInfo.Name} | ${userInfo.Mobile} | ${userInfo.Age} | ${formatDateToIST(msg.date)}`);
    }

  }, new NewMessage({}));

  console.log('📡 Listening for new messages in real-time...');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
