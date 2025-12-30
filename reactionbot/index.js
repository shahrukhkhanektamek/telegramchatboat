// Save as: all_emojis_bot.js
require('dotenv').config();
const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Api } = require('telegram/tl/api');

// ===== CONFIG ======
const apiId = parseInt(process.env.API_ID);
const apiHash = process.env.API_HASH;
const stringSession = new StringSession(process.env.STRING_SESSION);
const channelId = "-1003435402288";

// ALL EMOJIS that should appear on EVERY message
const allEmojis = ['🔥', '😍', '👏', '👍'];
// Jitne emojis list me hain, utne hi reactions har message pe

const delayBetweenReactions = 10000; // 10 seconds between each emoji
// ====================

(async () => {
    console.log('🚀 ALL EMOJIS BOT\n');
    console.log('📝 EVERY new message will get ALL these emojis:\n');
    console.log(`   ${allEmojis.join('  ')}\n`);
    
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    try {
        await client.connect();
        console.log('✅ Connected to Telegram');
        
        const channel = await client.getEntity(channelId);
        console.log(`📢 Channel: ${channel.title}\n`);
        
        console.log('🎯 BOT SETTINGS:');
        console.log('================');
        console.log(`• Emojis per message: ${allEmojis.length}`);
        console.log(`• Delay between emojis: ${delayBetweenReactions/1000} seconds`);
        console.log(`• Total time per message: ${Math.round((allEmojis.length * delayBetweenReactions)/1000/60)} minutes`);
        console.log(`• Emoji order: Fixed (same for every message)`);
        
        console.log('\n📊 EXAMPLE: New message → 👍 → ❤️ → 🔥 → 👏 → ... ALL emojis\n');
        
        // Track performance
        let totalMessagesProcessed = 0;
        let totalEmojisSent = 0;
        let floodWaits = 0;
        
        client.addEventHandler(async (update) => {
            try {
                if (!update.message) return;
                
                const message = update.message;
                
                // Verify channel
                if (!message.peerId || !message.peerId.channelId) return;
                
                const msgChannelId = String(message.peerId.channelId.value || message.peerId.channelId);
                if (msgChannelId !== channelId.replace('-100', '')) return;
                
                totalMessagesProcessed++;
                
                console.log(`\n═══════════════════════════════════════════`);
                console.log(`📨 MESSAGE ${totalMessagesProcessed}: ID ${message.id}`);
                console.log(`⏰ Started: ${new Date().toLocaleTimeString()}`);
                
                if (message.message) {
                    const preview = message.message.length > 60 
                        ? message.message.substring(0, 60) + '...' 
                        : message.message;
                    console.log(`📝 ${preview}`);
                }
                
                console.log(`\n🎯 Adding ALL ${allEmojis.length} emojis:`);
                console.log(`   ${allEmojis.join(' → ')}`);
                console.log(`\n⏱️  Est. completion: ${new Date(Date.now() + (allEmojis.length * delayBetweenReactions)).toLocaleTimeString()}\n`);
                
                const startTime = Date.now();
                let emojisSent = 0;
                let emojisFailed = 0;
                
                // Send ALL emojis in order
                for (let i = 0; i < allEmojis.length; i++) {
                    const emoji = allEmojis[i];
                    
                    console.log(`[${i+1}/${allEmojis.length}] Adding: ${emoji}`);
                    
                    try {
                        await client.invoke(new Api.messages.SendReaction({
                            peer: channelId,
                            msgId: message.id,
                            reaction: [new Api.ReactionEmoji({ emoticon: emoji })]
                        }));
                        
                        emojisSent++;
                        totalEmojisSent++;
                        console.log(`   ✅ ${emoji} added successfully`);
                        
                    } catch (error) {
                        emojisFailed++;
                        console.log(`   ❌ Failed to add ${emoji}: ${error.message}`);
                        
                        // Handle specific errors
                        if (error.code === 420 && error.errorMessage === 'FLOOD') {
                            const waitSeconds = error.seconds || 120;
                            floodWaits++;
                            
                            console.log(`\n⚠️  FLOOD WAIT: ${waitSeconds} seconds`);
                            console.log(`⏰ Waiting...`);
                            
                            // Countdown
                            for (let w = waitSeconds + 10; w > 0; w--) {
                                if (w % 30 === 0 || w <= 10) {
                                    console.log(`   ${w}s remaining`);
                                }
                                await new Promise(r => setTimeout(r, 1000));
                            }
                            
                            console.log(`✅ Flood wait complete\n`);
                            
                            // Retry this emoji
                            i--;
                            continue;
                            
                        } else if (error.code === 400 && error.errorMessage === 'REACTION_INVALID') {
                            console.log(`   ⚠️  ${emoji} is invalid, skipping`);
                            continue;
                        }
                    }
                    
                    // Wait before next emoji (except for last one)
                    if (i < allEmojis.length - 1) {
                        console.log(`⏳ Next emoji in ${delayBetweenReactions/1000} seconds...\n`);
                        await new Promise(r => setTimeout(r, delayBetweenReactions));
                    }
                }
                
                const totalTime = Math.round((Date.now() - startTime) / 1000);
                const minutes = Math.floor(totalTime / 60);
                const seconds = totalTime % 60;
                
                console.log(`\n📊 MESSAGE ${totalMessagesProcessed} COMPLETE:`);
                console.log(`   ✅ Emojis sent: ${emojisSent}/${allEmojis.length}`);
                console.log(`   ❌ Emojis failed: ${emojisFailed}`);
                console.log(`   ⏱️  Time taken: ${minutes}m ${seconds}s`);
                
                // Show what emojis were actually added
                console.log(`\n🎭 EMOJIS ON THIS MESSAGE:`);
                console.log(`   ${allEmojis.map(e => emojisFailed > 0 ? `${e}❓` : `${e}✅`).join('  ')}`);
                
                console.log(`\n📈 OVERALL STATS:`);
                console.log(`   Total messages: ${totalMessagesProcessed}`);
                console.log(`   Total emojis sent: ${totalEmojisSent}`);
                console.log(`   Flood waits: ${floodWaits}`);
                
                console.log(`⏰ Finished: ${new Date().toLocaleTimeString()}`);
                console.log(`═══════════════════════════════════════════\n`);
                
            } catch (error) {
                console.log(`💥 Handler error: ${error.message}`);
            }
        });
        
        console.log('🤖 Bot is ACTIVE!');
        console.log('👉 Post in VIKAL GOAT to see ALL emojis on your message');
        console.log('🛑 Press Ctrl+C to stop\n');
        
        // Show reminder every 2 minutes
        setInterval(() => {
            console.log(`\n📢 REMINDER: Every new message gets:`);
            console.log(`   ${allEmojis.join('  ')}`);
            console.log(`   ${totalMessagesProcessed} messages processed so far\n`);
        }, 120000);
        
        process.on('SIGINT', async () => {
            console.log(`\n📊 FINAL STATISTICS:`);
            console.log(`   Total messages processed: ${totalMessagesProcessed}`);
            console.log(`   Total emojis sent: ${totalEmojisSent}`);
            console.log(`   Total flood waits: ${floodWaits}`);
            console.log(`   Uptime: ${Math.round(process.uptime() / 60)} minutes`);
            console.log('\n👋 Shutting down gracefully...');
            await client.disconnect();
            process.exit(0);
        });
        
        await new Promise(() => {});
        
    } catch (error) {
        console.log('❌ Startup error:', error.message);
    }
})();