const { saveDB, addQuestProgress } = require('../helpers/database');

// DAFTAR ITEM DI TOKO
const shopItems = {
    "xp-boost": { 
        name: "⚡ XP Booster (1 Jam)", 
        price: 500, 
        type: "buff", 
        effect: "xp", 
        duration: 3600000 
    },
    "gacha-charm": { 
        name: "🍀 Gacha Charm (1 Jam)", 
        price: 1000, 
        type: "buff", 
        effect: "gacha", 
        duration: 3600000 
    }
};

module.exports = async (command, args, msg, user, db) => {
    // Inisialisasi variabel user
    if (typeof user.balance === 'undefined') user.balance = 0;
    if (!user.buffs) user.buffs = {};
    if (!user.inv) user.inv = [];
    
    const now = Date.now();

    // Fungsi Helper untuk parsing jumlah taruhan
    const parseBet = (input) => {
        if (!input) return null;
        if (input.toLowerCase() === 'all') return user.balance;
        const val = parseInt(input);
        return (isNaN(val) || val <= 0) ? null : val;
    };

    // Fungsi Helper Quest
    const handleQuest = (u, type) => {
        try {
            if (typeof addQuestProgress === 'function') {
                return addQuestProgress(u, type);
            }
        } catch (e) {
            console.log("Quest Error:", e);
        }
        return null;
    };

    // 1. CEK SALDO
    if (command === "coin" || command === "balance" || command === "dompet") {
        return msg.reply(`💰 Saldo Utama: *💰${Math.floor(user.balance).toLocaleString('id-ID')}* Koin\n(Bisa dipakai untuk Trading Crypto & Casino)`);
    }

    // 2. KLAIM HARIAN
    if (command === "daily") {
        const COOLDOWN = 86400000; // 24 Jam
        if (user.lastDaily && now - user.lastDaily < COOLDOWN) {
            const sisaMs = COOLDOWN - (now - user.lastDaily);
            const sisaJam = Math.floor(sisaMs / 3600000);
            const sisaMenit = Math.floor((sisaMs % 3600000) / 60000);
            return msg.reply(`⏳ Sabar... Tunggu *${sisaJam} jam ${sisaMenit} menit* lagi.`);
        }
        user.balance += 500; 
        user.lastDaily = now;
        saveDB(db);
        return msg.reply("🎁 *DAILY CLAIM*\nKamu mendapatkan 💰500 koin! Gunakan untuk modal trading.");
    }

    // 3. GAME CASINO (50:50 Chance)
    if (command === "casino" || command === "judi") {
        const bet = parseBet(args[0]);
        if (!bet) return msg.reply("❌ Format: `!casino 100` atau `!casino all`");
        if (user.balance < bet) return msg.reply("❌ Uang tidak cukup! Main Crypto dulu sana.");

        // Logika Menang/Kalah
        let winThreshold = 0.55; // 45% Menang (House Edge)
        let bonusText = "";

        // Cek Buff Charm
        if (user.buffs.gacha?.active && now < user.buffs.gacha.until) {
            winThreshold = 0.45; // Jadi 55% Menang
            bonusText = "\n🍀 *Luck Charm Active!*";
        }

        const roll = Math.random();
        const menang = roll > winThreshold;

        if (menang) {
            const profit = bet; 
            user.balance += profit;
            msg.reply(`🎉 *WIN!* Kartu bagus!\nProfit: +💰${profit.toLocaleString('id-ID')}${bonusText}\n💰 Saldo: 💰${Math.floor(user.balance).toLocaleString('id-ID')}`);
        } else {
            user.balance -= bet;
            msg.reply(`💸 *LOSE...* Bandar menang.\nHilang: -💰${bet.toLocaleString('id-ID')}\n💰 Saldo: 💰${Math.floor(user.balance).toLocaleString('id-ID')}`);
        }
        
        const qMsg = handleQuest(user, "game");
        if (qMsg) msg.reply(qMsg);
        saveDB(db);
    }

    // 4. GAME SLOT
    if (command === "slot") {
        const bet = parseBet(args[0]);
        if (!bet) return msg.reply("❌ Format: `!slot 100` atau `!slot all`");
        if (user.balance < bet) return msg.reply("❌ Uang kurang.");

        const emojis = ["🍒", "🍋", "🍇", "💎", "7️⃣"];
        const r = () => emojis[Math.floor(Math.random() * emojis.length)];
        let a = r(), b = r(), c = r();

        // Manipulasi Buff
        if (user.buffs.gacha?.active && now < user.buffs.gacha.until && Math.random() > 0.5) {
            b = a; 
        }

        let resMsg = `🎰 | ${a} | ${b} | ${c} |\n\n`;
        let winAmount = 0;

        // Jackpot (3 Sama)
        if (a === b && b === c) {
            winAmount = bet * 5; 
            if (a === "7️⃣") winAmount = bet * 10; 
            if (a === "💎") winAmount = bet * 7; 
            
            user.balance += winAmount;
            resMsg += `🚨 *JACKPOT!!!* 🚨\nAnda menang 💰${winAmount.toLocaleString('id-ID')}!`;
        } 
        // Pair (2 Sama)
        else if (a === b || b === c || a === c) {
            winAmount = Math.floor(bet * 0.5); 
            user.balance += winAmount;
            resMsg += `✨ *Lumayan!* Pair (2 sama).\nMenang: 💰${(bet + winAmount).toLocaleString('id-ID')}`;
        } 
        // Kalah
        else {
            user.balance -= bet;
            resMsg += `💀 *Rungkad.* Coba lagi! -💰${bet.toLocaleString('id-ID')}`;
        }

        const qMsg = handleQuest(user, "game");
        if (qMsg) resMsg += `\n\n${qMsg}`;
        
        saveDB(db);
        return msg.reply(resMsg);
    }

    // 5. GACHA
    if (command === "gacha") {
        const COST = 200; // Biaya Gacha
        if (user.balance < COST) return msg.reply(`❌ Butuh 💰${COST} untuk Gacha.`);

        user.balance -= COST;

        // Rate Gacha
        const roll = Math.floor(Math.random() * 100) + 1; 
        let reward = 0;
        let rarity = "Ampas";

        if (roll === 100) { // 1%
            reward = 10000; 
            rarity = "🔥 MYTHICAL (0.1%)";
        } else if (roll > 95) { // 5%
            reward = 2000;
            rarity = "💎 LEGENDARY";
        } else if (roll > 80) { // 20%
            reward = 500;
            rarity = "✨ EPIC";
        } else if (roll > 50) { // 30%
            reward = 100;
            rarity = "📦 COMMON";
        } else {
            reward = 0;
            rarity = "💩 ZONK";
        }

        user.balance += reward;
        const qMsg = handleQuest(user, "game"); // Hitung quest game
        
        saveDB(db);

        let txt = `🎰 *GACHA MACHINE* 🎰\n\n`;
        txt += `Hasil: *${rarity}*\n`;
        txt += `Hadiah: 💰${reward.toLocaleString('id-ID')}\n`;
        txt += `Sisa Saldo: 💰${Math.floor(user.balance).toLocaleString('id-ID')}`;
        if (qMsg) txt += `\n\n${qMsg}`;
        
        return msg.reply(txt);
    }

    // 6. TRANSFER (GIVE)
    if (command === "give" || command === "transfer" || command === "tf") {
        // Ambil target dari Mention (Baileys Style)
        const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let targetId = mentions[0];

        // Fallback: Kalau user ngetik manual (misal !tf 62812345 100)
        if (!targetId && args[0]) {
            targetId = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        }

        // Ambil nominal (bisa di args[0] atau args[1] tergantung format)
        // Format 1: !tf @tag 1000  -> nominal di args[1]
        // Format 2: !tf 628xxx 1000 -> nominal di args[1]
        let amount = parseInt(args[1]);

        // Kalau user nulis !tf 1000 @tag (Nominal duluan)
        if (isNaN(amount)) {
            amount = parseInt(args[0]);
        }

        if (!targetId || isNaN(amount) || amount <= 0) {
            return msg.reply("❌ Format Salah!\nContoh: `!tf @user 1000`");
        }

        // Cek database user tujuan
        if (!db.users[targetId]) {
            // Auto Register Target kalau belum ada
            db.users[targetId] = { 
                balance: 0, xp: 0, level: 1, crypto: {}, debt: 0, inv: [], buffs: {} 
            };
        }

        const senderId = msg.key.remoteJid || msg.author;
        if (targetId === senderId) return msg.reply("❌ Gak bisa transfer ke diri sendiri.");
        if (user.balance < amount) return msg.reply("❌ Uang gak cukup.");

        // Eksekusi Transfer
        user.balance -= amount;
        db.users[targetId].balance = (db.users[targetId].balance || 0) + amount;

        saveDB(db);

        const { getChat } = msg; 
        // Kirim konfirmasi dengan mention
        const chat = await msg.getChat();
        await chat.sendMessage(`✅ *TRANSFER SUKSES*\nDikirim: 💰${amount.toLocaleString('id-ID')}\nKe: @${targetId.split('@')[0]}`, { mentions: [targetId] });
    }

    // 7. SHOP & INVENTORY
    if (command === "shop") {
        let text = `🛒 *MARKETPLACE ITEM*\n\n`;
        for (const key in shopItems) {
            const item = shopItems[key];
            text += `📦 *${item.name}*\n└ ID: \`${key}\` | Harga: 💰${item.price.toLocaleString('id-ID')}\n\n`;
        }
        text += `💡 Beli: \`!buy <id>\` | Pakai: \`!use <id>\``;
        return msg.reply(text);
    }

    if (command === "inv" || command === "tas") {
        if (!user.inv || user.inv.length === 0) return msg.reply("🎒 Tas kamu kosong melompong.");
        
        const counts = {};
        user.inv.forEach(x => { counts[x] = (counts[x] || 0) + 1; });

        let text = `🎒 *ISI TAS KAMU*\n\n`;
        for (const kode in counts) {
            const item = shopItems[kode];
            text += `• ${item ? item.name : kode} (x${counts[kode]})\n`;
        }
        text += `\nGunakan item dengan \`!use <nama_id>\``;
        return msg.reply(text);
    }

    if (command === "buy") {
        const kode = args[0];
        if (!shopItems[kode]) return msg.reply("❌ Barang tidak ada di toko.");
        
        const item = shopItems[kode];
        if (user.balance < item.price) return msg.reply(`❌ Uang kurang! Butuh 💰${item.price.toLocaleString('id-ID')}`);

        user.balance -= item.price;
        user.inv.push(kode);
        saveDB(db);
        return msg.reply(`✅ Sukses membeli *${item.name}*!`);
    }

    if (command === "use") {
        const kode = args[0];
        const index = user.inv.indexOf(kode);
        if (index === -1) return msg.reply("❌ Kamu gak punya item ini.");
        
        const item = shopItems[kode];
        
        if (item.type === "buff") {
            if (user.buffs[item.effect]?.active && now < user.buffs[item.effect].until) {
                return msg.reply("❌ Buff ini masih aktif! Tunggu habis dulu.");
            }

            user.buffs[item.effect] = { active: true, until: now + item.duration };
            user.inv.splice(index, 1); 
            saveDB(db);
            return msg.reply(`🍹 *${item.name}* Diminum!\nEfek aktif selama 1 jam.`);
        }
    }
};
