const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const dotenv = require("dotenv");
const PQueue = require("p-queue").default;

dotenv.config();

process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

const bot = new TelegramBot(process.env.BOT_TOKEN, {
    polling: {
        autoStart: true,
        interval: 300,
        params: {
            timeout: 30
        }
    }
});

// ===========================
// Queue
// ===========================

const queue = new PQueue({
    concurrency: 1,
    interval: 1000,
    intervalCap: 15
});

// ===========================
// Support Links
// ===========================

const supportLinks = [
    "https://t.me/m/Ou-vqBSINzhl",
];

const INDEX_FILE = "currentIndex.json";

function loadIndex() {
    try {
        if (fs.existsSync(INDEX_FILE)) {
            return JSON.parse(fs.readFileSync(INDEX_FILE)).index || 0;
        }
    } catch (e) {}

    return 0;
}

function saveIndex(index) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ index }));
}

let currentIndex = loadIndex();

function getNextSupportLink() {

    const link = supportLinks[currentIndex % supportLinks.length];

    currentIndex++;

    saveIndex(currentIndex);

    console.log(
        `🔗 Link #${currentIndex} (${((currentIndex - 1) % supportLinks.length) + 1}/${supportLinks.length})`
    );

    return link;

}

// ===========================
// Send Video
// ===========================

async function sendVideo(userId, username) {

    while (true) {

        try {

            await bot.sendVideoNote(
                userId,
                fs.createReadStream(process.env.VIDEO_PATH),
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                {
                                    text: "💬 Message Now",
                                    url: getNextSupportLink()
                                }
                            ]
                        ]
                    }
                }
            );

            console.log(`✅ Sent to ${username}`);

            return;

        } catch (err) {

            if (err.response) {

                const status = err.response.statusCode;

                // Rate Limit
                if (status === 429) {

                    const retry =
                        err.response.body.parameters?.retry_after || 60;

                    console.log(`⏳ Rate Limited. Waiting ${retry}s`);

                    await new Promise(r => setTimeout(r, retry * 1000));

                    continue;
                }

                // User blocked bot
                if (status === 403) {

                    console.log(`🚫 Blocked/Not Started: ${userId}`);

                    return;
                }

            }

            console.log(err.message);

            return;

        }

    }

}

// ===========================
// Join Request
// ===========================

bot.on("chat_join_request", async (msg) => {

    const userId = msg.from.id;
    const groupId = msg.chat.id;

    const username =
        msg.from.username ||
        msg.from.first_name ||
        msg.from.last_name ||
        userId;

    queue.add(async () => {

        try {

            // ✅ Auto Approve Join Request
            // await bot.approveChatJoinRequest(groupId, userId);

            console.log(`✅ Approved: ${username}`);

            // थोड़ा wait ताकि Telegram join process complete कर दे
            await new Promise(resolve => setTimeout(resolve, 2000));

            // ✅ Send Video
            await sendVideo(userId, username);

        } catch (err) {
            console.error("❌ Join Request Error:", err.message);
        }

    });

});

// ===========================

console.log("🚀 Telegram Bot Started");
console.log("Current Link Index:", currentIndex);