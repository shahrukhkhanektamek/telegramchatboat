import fs from "fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input"; // For interactive login
import { writeToPath } from "@fast-csv/format";
import { parseISO, formatISO } from 'date-fns';
import path from 'path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';

// ------------------- ES module __dirname setup -------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------ CONFIG ------------------
const API_ID = 29328940; // <-- replace with your api_id (integer)
const API_HASH = 'ecde8d3d1a5f3d23d2d5fa76f7d7bca3'; // <-- replace with your api_hash (string)
const SESSION_FILE = path.join(__dirname, 'session.txt');    // session stored here (StringSession)
const OUT_XLSX = path.join(__dirname, 'telegram_unique_numbers.xlsx');
const MIN_TS_ISO = null; // e.g. "2024-01-01T00:00:00Z" or null to scan all

// Pattern: generic 9-15 digits (includes Indian 10-digit)
const PHONE_RE = /(?:\+?\d{1,3}[-\s.]?)?(?:0?\s*)?(\d{9,15})/g;

// --------------------------------------------

async function loadSession() {
  if (fs.existsSync(SESSION_FILE)) {
    return fs.readFileSync(SESSION_FILE, 'utf8').trim();
  }
  return '';
}

async function saveSession(sessStr) {
  fs.writeFileSync(SESSION_FILE, sessStr, { encoding: 'utf8' });
}

function findPhonesInText(text) {
  if (!text) return [];
  const found = [];
  let m;
  while ((m = PHONE_RE.exec(text)) !== null) {
    const digits = m[1].replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 15) {
      if (!found.includes(digits)) found.push(digits);
    }
  }
  return found;
}

function findNameInText(text) {
  if (!text) return null;
  const patterns = [
    /(?:My name\s*(?:is)?|Name[:\-\s]+)\s*([A-Za-z][A-Za-z\s]{1,60})/i,
    /(?:I am|I'm)\s+([A-Za-z][A-Za-z\s]{1,60})/i,
  ];
  for (const p of patterns) {
    const r = p.exec(text);
    if (r && r[1]) return r[1].trim();
  }
  return null;
}

async function main() {
  const saved = await loadSession();
  const stringSession = new StringSession(saved || '');
  const client = new TelegramClient(stringSession, API_ID, API_HASH, {
    connectionRetries: 5,
  });

  // start & login flow
  await client.start({
    phoneNumber: async () => await input.text('Enter your phone (with country code, e.g. +9198...): '),
    password: async () => await input.text('If you have 2FA enabled, enter password (else press Enter): '),
    phoneCode: async () => await input.text('Enter the code you received in Telegram: '),
    onError: (err) => console.log('Error while logging in:', err.message || err),
  });

  // save session
  const newSession = client.session.save();
  await saveSession(newSession);
  console.log('Logged in successfully. Session saved.');

  let minTS = MIN_TS_ISO ? parseISO(MIN_TS_ISO) : null;

  const unique = new Map();

  console.log('Fetching dialogs...');
  const dialogs = await client.getDialogs({ limit: 1000 });
  console.log(`Found ${dialogs.length} dialogs. Scanning messages (this may take long)...`);

  for (const dlg of dialogs) {
    const entity = dlg.entity;
    const chatTitle = dlg.name || dlg.id;
    let offsetId = 0;
    const pageSize = 200;
    let keepLoop = true;

    while (keepLoop) {
      const msgs = await client.getMessages(entity, { limit: pageSize, offsetId });
      if (!msgs || msgs.length === 0) break;

      const messages = msgs.slice().reverse(); // oldest first
      for (const msg of messages) {
        if (minTS && msg.date && new Date(msg.date) < minTS) continue;

        let senderName = '';
        let senderId = '';
        try {
          if (msg.sender) {
            senderName = msg.sender.username || msg.sender.firstName || msg.sender.first_name || '';
            senderId = msg.sender.id || msg.sender.userId || '';
          } else if (msg.fromId) {
            senderId = msg.fromId.userId || msg.fromId.channelId || msg.fromId || '';
          }
        } catch {}

        // 1) contact card
        try {
          if (msg.media && msg.media.contact) {
            const c = msg.media.contact;
            const digits = (c.phoneNumber || c.phone || '').replace(/\D/g, '');
            if (digits.length >= 9 && digits.length <= 15 && !unique.has(digits)) {
              const contactName = `${c.firstName || c.first_name || ''} ${c.lastName || c.last_name || ''}`.trim();
              unique.set(digits, {
                Name: contactName || senderName || '',
                UserID: senderId || '',
                MobileNumber: digits,
                DateUTC: msg.date ? new Date(msg.date).toISOString() : ''
              });
            }
          }
        } catch {}

        // 2) text phones + possible name
        const text = msg.message || (msg.text && typeof msg.text === 'string' ? msg.text : '');
        if (text && text.length > 0) {
          const phones = findPhonesInText(text);
          const textName = findNameInText(text);
          for (const ph of phones) {
            if (!unique.has(ph)) {
              unique.set(ph, {
                Name: (senderName || textName || '').trim(),
                UserID: senderId || '',
                MobileNumber: ph,
                DateUTC: msg.date ? new Date(msg.date).toISOString() : ''
              });
            }
          }
        }
      }

      const lastMsg = msgs[msgs.length - 1];
      if (!lastMsg) break;
      if (msgs.length < pageSize) break;
      offsetId = lastMsg.id - 1;
    }
  }

  // Write to Excel
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('numbers');
  sheet.columns = [
    { header: 'Name', key: 'Name', width: 30 },
    { header: 'User ID', key: 'UserID', width: 15 },
    { header: 'Mobile Number', key: 'MobileNumber', width: 20 },
    { header: 'Date (UTC)', key: 'DateUTC', width: 30 },
  ];

  for (const [num, info] of unique.entries()) {
    sheet.addRow({
      Name: info.Name || '',
      UserID: info.UserID || '',
      MobileNumber: info.MobileNumber || '',
      DateUTC: info.DateUTC || ''
    });
  }

  await workbook.xlsx.writeFile(OUT_XLSX);
  console.log(`\n✅ Done — saved ${unique.size} unique numbers to: ${OUT_XLSX}`);

  await client.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
