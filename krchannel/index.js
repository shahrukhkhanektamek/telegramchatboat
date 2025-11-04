import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import input from "input";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage } from "telegram/events/index.js";
import { google } from "googleapis";

// ------------------- ES module __dirname -------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------- Telegram Config -------------------
const API_ID = 29328940;
const API_HASH = "ecde8d3d1a5f3d23d2d5fa76f7d7bca3";
const SESSION_FILE = path.join(__dirname, "session.txt");

// ------------------- Google Sheet Config -------------------
const SPREADSHEET_ID = "1kTXlpD9eyDgQplmvWm3HnaHmKlkhkREMqVB4EmEqAGc";
const SHEET_NAME = "Sheet1";
const GOOGLE_CREDENTIALS = path.join(__dirname, "service-account.json");

// ------------------- Google Sheets Setup -------------------
const auth = new google.auth.GoogleAuth({
  keyFile: GOOGLE_CREDENTIALS,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// ------------------- Utility Functions -------------------
function parseUserInfo(text) {
  if (!text) return null;

  const nameMatch = text.match(/My Name[-:\s]*([^\n]+)/i);
  const mobileMatch = text.match(/My Mobile[-:\s]*([^\n]+)/i);
  const ageMatch = text.match(/My Age[-:\s]*([^\n]+)/i);

  if (nameMatch || mobileMatch || ageMatch) {
    return {
      Name: nameMatch ? nameMatch[1].trim() : "",
      Mobile: mobileMatch ? mobileMatch[1].trim() : "",
      Age: ageMatch ? ageMatch[1].trim() : "",
    };
  }
  return null;
}

// ------------------- Format Date to IST -------------------
function formatDateToIST(date) {
  if (!date) return "";

  // Telegram date may come as Unix timestamp (seconds)
  const timestamp =
    typeof date === "number"
      ? date * 1000
      : date instanceof Date
      ? date.getTime()
      : 0;

  if (!timestamp) return "";

  const istOffset = 5.5 * 60 * 60 * 1000; // +05:30
  const istDate = new Date(timestamp + istOffset);

  const dd = String(istDate.getUTCDate()).padStart(2, "0");
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = istDate.getUTCFullYear();
  const hh = String(istDate.getUTCHours()).padStart(2, "0");
  const min = String(istDate.getUTCMinutes()).padStart(2, "0");
  const ss = String(istDate.getUTCSeconds()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

// ------------------- Ensure Sheet Headers -------------------
async function ensureHeaders() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:E1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:E1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [["Name", "Mobile", "Age", "UserID", "Date"]],
        },
      });
      console.log("✅ Headers set in Google Sheet");
    }
  } catch (err) {
    console.error("Error checking/setting headers:", err);
  }
}

// ------------------- Add Row to Sheet -------------------
async function addRowToSheet(row) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:E`, // Proper range with columns
      valueInputOption: "RAW",
      requestBody: {
        values: [[row.Name, row.Mobile, row.Age, row.UserID, row.DateIST]],
      },
    });
    console.log(`➕ Saved to Google Sheet: ${row.Name} | ${row.Mobile} | ${row.Age}`);
  } catch (err) {
    console.error("Error saving to Google Sheet:", err);
  }
}

// ------------------- Main -------------------
async function main() {
  await ensureHeaders();

  const saved = fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, "utf8").trim() : "";
  const stringSession = new StringSession(saved || "");
  const client = new TelegramClient(stringSession, API_ID, API_HASH, { connectionRetries: 5 });

  await client.start({
    phoneNumber: async () => await input.text("Enter your phone (with country code, e.g. +91...)"),
    password: async () => await input.text("2FA password (or press Enter)"),
    phoneCode: async () => await input.text("Enter Telegram code: "),
    onError: (err) => console.log("Login error:", err.message || err),
  });

  fs.writeFileSync(SESSION_FILE, client.session.save());
  console.log("✅ Telegram logged in. Session saved.");

  const unique = new Set();

  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg) return;

    const senderId = msg.sender?.id || msg.fromId?.userId || msg.fromId?.channelId || "";

    const text = msg.message || (typeof msg.text === "string" ? msg.text : "");
    const userInfo = parseUserInfo(text);

    if (userInfo && userInfo.Mobile && !unique.has(userInfo.Mobile)) {
      unique.add(userInfo.Mobile);

      const row = {
        ...userInfo,
        UserID: senderId,
        DateIST: formatDateToIST(msg.date),
      };

      await addRowToSheet(row);
    }
  }, new NewMessage({}));

  console.log("📡 Listening for new messages and saving to Google Sheet...");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
