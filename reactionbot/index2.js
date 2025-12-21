require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl/api');

const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;

const channelId = "-1003435402288";
const emoji = '🔥'; // same emoji = multiple users

// load all sessions
const sessions = [];
for (let i = 1; i <= 10; i++) {
  const s = process.env[`STRING_SESSION_${i}`];
  if (s) sessions.push(new StringSession(s));
}

const clients = [];

(async () => {
  console.log(`🚀 Starting ${sessions.length} user accounts`);

  // connect all accounts
  for (let i = 0; i < sessions.length; i++) {
    const client = new TelegramClient(sessions[i], apiId, apiHash, {
      connectionRetries: 5
    });
    await client.connect();
    clients.push(client);
    console.log(`✅ User ${i + 1} connected`);
  }

  // use FIRST account to listen messages
  const mainClient = clients[0];
  const channel = await mainClient.getEntity(channelId);

  mainClient.addEventHandler(async (update) => {
    if (!update.message) return;

    const msg = update.message;
    if (!msg.peerId?.channelId) return;

    console.log(`📨 New message: ${msg.id}`);

    // each account reacts
    for (let i = 0; i < clients.length; i++) {
      try {
        await clients[i].invoke(new Api.messages.SendReaction({
          peer: channel,
          msgId: msg.id,
          reaction: [new Api.ReactionEmoji({ emoticon: emoji })]
        }));

        console.log(`🔥 Reaction sent by User ${i + 1}`);
        await new Promise(r => setTimeout(r, 2000)); // SAFE delay

      } catch (e) {
        console.log(`❌ User ${i + 1} failed: ${e.message}`);
      }
    }
  });

  console.log('🤖 MULTI-USER REACTION SYSTEM ACTIVE');

})();
