import fs from "fs";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import input from "input"; // For interactive login
import { writeToPath } from "@fast-csv/format";

// ----------- CONFIG ------------
const apiId = 29328940; // your api_id
const apiHash = "ecde8d3d1a5f3d23d2d5fa76f7d7bca3"; // your api_hash
const sessionFile = "my_tg_session.txt"; // file to store session string
const outputCsv = "tg_numbers_full.csv";
const LIMIT_MESSAGES_PER_CHAT = null; // null => all messages
// -------------------------------

// Load or create session string
let sessionString = "";
if (fs.existsSync(sessionFile)) {
    sessionString = fs.readFileSync(sessionFile, "utf-8");
}
const stringSession = new StringSession(sessionString);

// Regex patterns
const indiaRe = /\b(?:\+91[\-\s]?|0)?[6-9]\d{9}\b/g;
const generalRe = /\b(?:\+\d{1,3}[\s-]?)?(?:\d[\d\-\s]{5,}\d)\b/g;

const cleanDigits = s => s.replace(/\D/g, "");

function extractNumbersFromText(text) {
    if (!text) return [];
    const found = new Set((text.match(indiaRe) || []));
    if (found.size === 0) {
        const candidates = text.match(generalRe) || [];
        for (const c of candidates) {
            const digits = cleanDigits(c);
            if (digits.length >= 7 && digits.length <= 15) {
                found.add(c.trim());
            }
        }
    }
    return Array.from(found).sort();
}

// --------- START SCRIPT ---------
const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});

await client.start({
    phoneNumber: async () => await input.text("Enter your phone number: "),
    password: async () => await input.text("Enter 2FA password: "),
    phoneCode: async () => await input.text("Enter code sent to Telegram: "),
    onError: console.log
});

console.log("Logged in!");

// Save session for next time
fs.writeFileSync(sessionFile, client.session.save());
console.log("Session saved.");

// Fetch dialogs
const rows = [];
const dialogs = await client.getDialogs();

for (const dialog of dialogs) {
    const chatTitle = dialog.name || String(dialog.id);
    const chatId = dialog.id;
    console.log("Checking:", chatTitle);

    try {
        const messages = await client.getMessages(dialog.id, {
            limit: LIMIT_MESSAGES_PER_CHAT || undefined
        });

        let count = 0;
        for (const msg of messages) {
            count++;
            const text = msg.message || (msg.media && msg.caption ? msg.caption : "");
            if (!text) continue;

            const numbers = extractNumbersFromText(text);
            if (numbers.length > 0) {
                const sender = msg.senderId ? String(msg.senderId) : null;

                for (const num of numbers) {
                    const digits = cleanDigits(num);
                    rows.push({
                        chat_title: chatTitle,
                        chat_id: chatId,
                        message_id: msg.id,
                        date_utc: msg.date.toISOString(),
                        sender,
                        number_found: num,
                        digits_only: digits,
                        full_message: text.replace(/\n/g, " \\n ")
                    });
                }
            }
        }
        console.log(`  scanned ${count} messages.`);
    } catch (e) {
        console.log("  ERROR reading dialog:", e);
    }
}

// Save CSV
const csvStream = writeToPath(outputCsv, rows, { headers: true });
csvStream.on("finish", () => console.log("Done. Saved", rows.length, "rows to", outputCsv));

await client.disconnect();
