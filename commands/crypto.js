const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA (Titik Ribuan, Tanpa Desimal)
const fmt = (num) => {
    return Math.floor(Number(num)).toLocaleString('id-ID');
};

// KONFIGURASI PASAR (Sifat Dasar Koin)
const COIN_CONFIG = {
    btc:  { start: 2000, min: 3500, vol: 5,  bounce: 1, baseStock: 50 },
    eth:  { start: 1000, min: 2000, vol: 8,  bounce: 1, baseStock: 100 },
    sol:  { start: 500,  min: 1000, vol: 15, bounce: 1, baseStock: 200 },
    doge: { start: 100,  min: 20,   vol: 30, bounce: 1, baseStock: 5000 },
    pepe: { start: 4,    min: 3,    vol: 45, bounce: 5, baseStock: 20000 }
};

// BERITA PASAR & EFEKNYA (MEMPENGARUHI HARGA)
const newsPool = [
    { txt: "🚀 BLACKROCK ajukan ETF Bitcoin Spot! Institusi memborong!", effect: { btc: 1.3, all: 1.1 }, sMod: { btc: -15 } },
    { txt: "🔥 EL SALVADOR umumkan 'Bitcoin City' bebas pajak!", effect: { btc: 1.15 }, sMod: { btc: -5 } },
    { txt: "🐦 X (Twitter) resmi integrasikan wallet DOGE & SOL!", effect: { doge: 2.0, sol: 1.5 }, sMod: { doge: -500, sol: -50 } },
    { txt: "🐸 PEPE MANIA! Volume transaksi tembus $1 Miliar!", effect: { pepe: 2.5 }, sMod: { pepe: -3000 } },
    { txt: "💎 ETHEREUM selesaikan upgrade Dencun, gas fee murah!", effect: { eth: 1.4 }, sMod: { eth: -40 } },
    { txt: "🌍 CHINA mencabut larangan crypto, 1 Miliar user masuk pasar!", effect: { all: 1.5 }, sMod: { all: -0.3 } },
    { txt: "🛍️ AMAZON menerima pembayaran Crypto secara global!", effect: { all: 1.2 }, sMod: { all: -0.2 } },
    { txt: "🛢️ ARAB SAUDI mulai terima pembayaran minyak pakai BTC!", effect: { btc: 1.4, all: 1.1 }, sMod: { btc: -20 } },
    { txt: "📈 MicroStrategy kembali memborong 5000 BTC.", effect: { btc: 1.1 }, sMod: { btc: -5 } },
    { txt: "🎮 Game NFT baru di jaringan Solana viral.", effect: { sol: 1.3 }, sMod: { sol: -20 } },
    { txt: "💰 Inflasi AS turun, The Fed pangkas suku bunga.", effect: { all: 1.15 }, sMod: { all: -0.05 } },
    { txt: "🐳 Whale misterius memindahkan 1 Triliun PEPE ke wallet dingin.", effect: { pepe: 1.4 }, sMod: { pepe: -500 } },
    { txt: "🟢 Google Cloud menjadi validator jaringan Ethereum.", effect: { eth: 1.2 }, sMod: { eth: -10 } },
    { txt: "📉 Profit Taking: Trader jangka pendek mulai menjual aset.", effect: { all: 0.9 }, sMod: { all: 0.1 } },
    { txt: "⚠️ Jaringan Solana macet (congestion) selama 4 jam.", effect: { sol: 0.7 }, sMod: { sol: 30 } },
    { txt: "📉 Pemerintah AS menjual Bitcoin hasil sitaan Silk Road.", effect: { btc: 0.8 }, sMod: { btc: 10 } },
    { txt: "🏦 Binance dituntut oleh regulator di Eropa.", effect: { all: 0.85 }, sMod: { all: 0.1 } },
    { txt: "🐕 Hype koin meme mereda, investor beralih ke saham.", effect: { doge: 0.7, pepe: 0.6 }, sMod: { doge: 200, pepe: 1000 } },
    { txt: "🔌 Mining Difficulty naik, penambang kecil gulung tikar.", effect: { btc: 0.95 }, sMod: { btc: 5 } },
    { txt: "🚨 HACK ALERT: Bridge penghubung Ethereum dieksploitasi!", effect: { eth: 0.6 }, sMod: { eth: 50 } },
    { txt: "📉 MT GOX mulai mengembalikan ribuan BTC (Dump Incoming!)", effect: { btc: 0.65 }, sMod: { btc: 20 } },
    { txt: "☠️ RUG PULL: Developer token meme kabur membawa likuiditas!", effect: { pepe: 0.3, doge: 0.5 }, sMod: { pepe: 5000, doge: 500 } },
    { txt: "🚫 INDIA & RUSIA kompak melarang total aset crypto!", effect: { all: 0.5 }, sMod: { all: 0.3 } },
    { txt: "📉 FTX 2.0: Bursa crypto besar bangkrut, user panik!", effect: { all: 0.4 }, sMod: { all: 0.4 } },
    { txt: "📉 Tether (USDT) kehilangan peg $1, pasar chaos!", effect: { all: 0.3 }, sMod: { all: 0.5 } },
    { txt: "🤖 Bot trading error, harga flash dump lalu pump!", effect: { all: 0.9 }, sMod: { all: -0.1 } },
    { txt: "📊 Volume perdagangan rendah, pasar stagnan.", effect: { all: 1.0 }, sMod: { all: 0 } }
];

module.exports = async (command, args, msg, user, db) => {
    // 1. Inisialisasi User
    if (typeof user.balance === 'undefined') user.balance = 0;
    if (typeof user.crypto === 'undefined') user.crypto = {};
    if (typeof user.debt === 'undefined') user.debt = 0;

    // 2. Inisialisasi Market
    if (!db.market || !db.market.prices) {
        db.market = {
            lastUpdate: 0, 
            prices: { 
                btc: COIN_CONFIG.btc.start, 
                eth: COIN_CONFIG.eth.start, 
                sol: COIN_CONFIG.sol.start, 
                doge: COIN_CONFIG.doge.start, 
                pepe: COIN_CONFIG.pepe.start 
            },
            stocks: { btc: 50, eth: 100, sol: 200, doge: 5000, pepe: 20000 },
            lastStockChange: { btc: 0, eth: 0, sol: 0, doge: 0, pepe: 0 },
            currentNews: "Pasar dibuka. Menunggu sesi perdagangan.",
            nextNews: "Analisis pasar sedang berjalan...",
            marketTrend: "NORMAL"
        };
        saveDB(db);
    }

    const marketData = db.market;
    const now = Date.now();
    const UPDATE_INTERVAL = 15 * 60 * 1000; 
    const TAX_SELL = 0.02; 
    const MARGIN_INTEREST = 0.05; 

    // ============================================================
    // 3. LOGIKA UPDATE HARGA BARU (CORE ENGINE)
    // ============================================================
    if (now - marketData.lastUpdate > UPDATE_INTERVAL) {
        
        // A. Pilih Berita
        const activeNews = newsPool[Math.floor(Math.random() * newsPool.length)];
        // Simpan berita prediksi (untuk sesi depan)
        if (!marketData.nextNews) marketData.nextNews = newsPool[Math.floor(Math.random() * newsPool.length)].txt;

        // B. Tentukan Kondisi Pasar (Random Trend)
        const trendRng = Math.random() * 100;
        let trendBias = 0; 
        let trendName = "NORMAL";

        // 🔥 MODIFIKASI: 8% Chance To The Moon
        if (trendRng < 8) { 
            trendBias = 50; // Bias +50% (Meroket Banget)
            trendName = "🌕 TO THE MOON";
        } else if (trendRng < 23) { // 8% s/d 23% (15% Chance)
            trendBias = 15; // Pump Bias Normal
            trendName = "🚀 BULL RUN";
        } else if (trendRng < 38) { // 23% s/d 38% (15% Chance)
            trendBias = -15; // Dump Bias
            trendName = "🩸 BEAR MARKET";
        } else if (trendRng < 58) { // 20% Chance
            trendName = "💤 SIDEWAYS";
        } 
        // Sisanya (42%) adalah Normal Volatility

        marketData.marketTrend = trendName;
        marketData.currentNews = activeNews.txt; // Tampilkan berita aktif

        // C. Loop Setiap Koin
        for (let k in marketData.prices) {
            const config = COIN_CONFIG[k] || { vol: 10, min: 1, bounce: 1, baseStock: 100 };
            
            // --- 1. UPDATE HARGA ---
            let volatility = config.vol;
            if (trendName === "💤 SIDEWAYS") volatility = volatility / 3;

            let randomPercent = (Math.random() * (volatility * 2)) - volatility;
            let totalPercent = randomPercent + trendBias + 0.5; // +0.5 Inflasi alami

            // Efek Berita pada Harga
            let newsMultiplier = activeNews.effect?.[k] || activeNews.effect?.all || 1.0;

            let currentPrice = marketData.prices[k];
            let newPrice = currentPrice * (1 + (totalPercent / 100)) * newsMultiplier;

            // Logika Floor & Bounce
            if (newPrice <= config.min) {
                newPrice = config.min; 
                newPrice = newPrice * config.bounce; 
                if (config.bounce === 1) newPrice = newPrice * 1.05; 
            }

            marketData.prices[k] = Math.floor(newPrice) || 1;

            // --- 2. UPDATE STOK (REFILL MECHANISM) ---
            const currentStock = marketData.stocks[k];
            const baseStock = config.baseStock;
            
            let refillRate = 0;
            // Jika stok kritis (<50%), supply masuk deras (+20%)
            if (currentStock < baseStock * 0.5) refillRate = 0.2; 
            // Jika stok kurang (<100%), supply normal (+5%)
            else if (currentStock < baseStock) refillRate = 0.05;  
            // Jika stok banjir (>150%), burn supply (-5%)
            else if (currentStock > baseStock * 1.5) refillRate = -0.05; 

            let autoRefill = Math.floor(baseStock * refillRate);
            
            // Efek Berita pada Stok
            let newsStockEffect = activeNews.sMod?.[k] || activeNews.sMod?.all || 0;
            if (Math.abs(newsStockEffect) < 1) {
                newsStockEffect = Math.floor(currentStock * newsStockEffect);
            }

            // Total Perubahan Stok
            let totalStockChange = autoRefill + newsStockEffect + (Math.floor(Math.random() * 10) - 5);

            let finalStock = currentStock + totalStockChange;

            // HARD LIMIT: Jangan biarkan stok di bawah 10
            if (finalStock < 10) finalStock = 10 + Math.floor(Math.random() * 10);

            marketData.lastStockChange[k] = totalStockChange;
            marketData.stocks[k] = finalStock;
        }

        // Bunga Hutang
        Object.keys(db.users).forEach(id => {
            let u = db.users[id];
            if (u.debt > 0) {
                u.debt = Math.floor(u.debt * (1 + MARGIN_INTEREST));
                let assetVal = 0;
                if (u.crypto) for (let [k, v] of Object.entries(u.crypto)) assetVal += v * (marketData.prices[k] || 0);
                if (u.debt > (assetVal + (u.balance || 0))) {
                    u.crypto = {}; u.balance = 0; u.debt = 0; 
                }
            }
        });
        
        marketData.lastUpdate = now;
        // Generate prediksi untuk next round
        marketData.nextNews = newsPool[Math.floor(Math.random() * newsPool.length)].txt;
        saveDB(db);
    }

    // ============================================================
    // COMMAND UI
    // ============================================================

    // 4. COMMAND !MARKET 
    if (command === 'market') {
        const getTxt = (n) => (n && typeof n === 'object' && n.txt) ? n.txt : n;

        // Pastikan data tidak kosong
        if (!marketData.currentNews) marketData.currentNews = newsPool[Math.floor(Math.random() * newsPool.length)].txt;
        if (!marketData.nextNews) marketData.nextNews = newsPool[Math.floor(Math.random() * newsPool.length)].txt;

        // Hitung Waktu Mundur
        let timeLeft = UPDATE_INTERVAL - (now - marketData.lastUpdate);
        if (timeLeft < 0) timeLeft = 0;
        let minutesLeft = Math.floor(timeLeft / 60000);
        let secondsLeft = Math.floor((timeLeft % 60000) / 1000);

        let txt = `📊 *BURSA CRYPTO* [${marketData.marketTrend || 'NORMAL'}]\n━━━━━━━━━━━━━━\n`;
        
        for (let k in marketData.prices) {
            let s = Math.floor(marketData.stocks[k]);
            let chg = marketData.lastStockChange[k];
            let priceStr = fmt(marketData.prices[k]);
            
            let isLow = marketData.prices[k] <= (COIN_CONFIG[k]?.min * 1.5);
            let icon = isLow ? '⚠️' : (chg >= 0 ? '📈' : '📉'); 
            
            // Ikon roket jika trend Moon
            if (marketData.marketTrend === "🌕 TO THE MOON") icon = '🚀';

            txt += `${icon} *${k.toUpperCase()}* : 💰${priceStr}\n`;
            txt += `   └ Stok: ${fmt(s)} (${chg >= 0 ? '+' : ''}${chg})\n`;
        }

        const beritanya = getTxt(marketData.currentNews);
        const prediksinya = getTxt(marketData.nextNews);

        txt += `━━━━━━━━━━━━━━\n`;
        txt += `📢 BERITA: "${beritanya}"\n`;
        txt += `🔮 PREDIKSI: "${prediksinya}"\n\n`;
        txt += `⏳ Update: *${minutesLeft}m ${secondsLeft}s*\n`;
        txt += `💰 Saldo: 💰${fmt(user.balance)}`;
        
        return msg.reply(txt);
    }

    // 5. COMMAND !BUYCRYPTO
    if (command === 'buycrypto') {
        const koin = args[0]?.toLowerCase();
        const jml = parseFloat(args[1]?.replace(',', '.')); 
        
        if (!marketData.prices[koin] || isNaN(jml) || jml <= 0) return msg.reply("❌ Contoh: !buycrypto btc 0.5");
        
        const pricePerCoin = marketData.prices[koin];
        const total = Math.floor(pricePerCoin * jml); 
        
        if (user.balance < total) return msg.reply(`❌ Saldo kurang! Butuh: 💰${fmt(total)}`);
        if (marketData.stocks[koin] < jml) return msg.reply(`❌ Stok pasar habis!`);

        user.balance -= total; 
        marketData.stocks[koin] -= jml;
        user.crypto[koin] = (user.crypto[koin] || 0) + jml;
        saveDB(db);
        return msg.reply(`✅ *BELI SUKSES*\nBeli: ${jml} ${koin.toUpperCase()}\nTotal: 💰${fmt(total)}`);
    }

    // 6. COMMAND !SELLCRYPTO
    if (command === 'sellcrypto') {
        const koin = args[0]?.toLowerCase();
        let jml = args[1];

        if (!user.crypto?.[koin]) return msg.reply(`❌ Aset ${koin?.toUpperCase()} tidak cukup!`);

        if (jml === 'all') jml = user.crypto[koin];
        else jml = parseFloat(jml?.replace(',', '.'));

        if (isNaN(jml) || jml <= 0 || user.crypto[koin] < jml) return msg.reply(`❌ Jumlah tidak valid.`);

        const bruto = marketData.prices[koin] * jml;
        const pajak = bruto * TAX_SELL;
        const neto = Math.floor(bruto - pajak); 

        user.crypto[koin] -= jml;
        user.balance += neto; 
        marketData.stocks[koin] += jml; // Kembalikan stok ke pasar
        saveDB(db);
        return msg.reply(`✅ *JUAL SUKSES*\nTerima: 💰${fmt(neto)} (Pajak 2%)`);
    }

    // 7. COMMAND !MINING
    if (command === 'mining' || command === 'mine') {
        const COOLDOWN = 450000; 
        if (now - (user.lastMining || 0) < COOLDOWN) {
            return msg.reply(`⏳ Mesin panas! Tunggu ${Math.floor((COOLDOWN - (now - user.lastMining)) / 60000)} menit lagi.`);
        }

        const rand = Math.random() * 100;
        let coin = 'pepe', rarity = 'Common';
        if (rand < 2) { coin = 'btc'; rarity = '🔥 LEGENDARY'; }
        else if (rand < 10) { coin = 'eth'; rarity = '🟣 EPIC'; }
        else if (rand < 30) { coin = 'sol'; rarity = '🔵 RARE'; }
        else if (rand < 60) { coin = 'doge'; rarity = '🟢 UNCOMMON'; }
        
        const goldVal = Math.floor(Math.random() * 1850) + 150; 
        const qty = goldVal / marketData.prices[coin]; 

        user.crypto[coin] = (user.crypto[coin] || 0) + qty;
        user.lastMining = now;
        saveDB(db);

        let qDisplay = qty.toLocaleString('id-ID', { maximumFractionDigits: 6 });
        return msg.reply(`⛏️ *MINING BERHASIL!* (${rarity})\n💎 Dapat: ${qDisplay} ${coin.toUpperCase()}\n💰 Nilai Setara: 💰${fmt(goldVal)}`);
    }

    // 8. COMMAND PORTOFOLIO
    if (command === 'pf' || command === 'portofolio') {
        let txt = `💰 *PORTOFOLIO ASET*\n\n`;
        let assetTotal = 0;
        for (let [k, v] of Object.entries(user.crypto)) {
            if (v > 0.0001) {
                let val = Math.floor(v * marketData.prices[k]); 
                assetTotal += val;
                let qtyDisplay = v.toLocaleString('id-ID', { maximumFractionDigits: 4 });
                txt += `🔸 *${k.toUpperCase()}*: ${qtyDisplay} (≈💰${fmt(val)})\n`;
            }
        }
        txt += `\n💵 Tunai: 💰${fmt(user.balance)}\n📊 Total Kekayaan: 💰${fmt(assetTotal + user.balance - user.debt)}`;
        return msg.reply(txt);
    }
    
    // 9. COMMAND TOP
    if (command === 'topcrypto' || command === 'top') {
        let consolidated = {};
        Object.keys(db.users).forEach(id => {
            let u = db.users[id];
            let cleanId = id.replace(/:[0-9]+/, ''); 
            let assets = 0;
            if (u.crypto) for (let [k, v] of Object.entries(u.crypto)) assets += v * (marketData.prices[k] || 0);
            let totalWealth = (u.balance || 0) + assets - (u.debt || 0);

            if (!consolidated[cleanId]) consolidated[cleanId] = { id: cleanId, originalId: id, total: 0 };
            consolidated[cleanId].total += totalWealth;
        });

        const top = Object.values(consolidated).sort((a, b) => b.total - a.total).slice(0, 5);
        let res = `🏆 *TOP 5 SULTAN* 🏆\n\n` + top.map((u, i) => `${i+1}. @${u.id.split('@')[0]} - 💰${fmt(u.total)}`).join('\n');
        
        const { getChat } = msg;
        const chat = await getChat();
        await chat.sendMessage(res, { mentions: top.map(u => u.originalId) });
    }

    // 10. MARGIN & DEBT
    if (command === 'margin') {
        const koin = args[0]?.toLowerCase();
        const jml = parseFloat(args[1]?.replace(',', '.'));
        if (!marketData.prices[koin] || isNaN(jml) || jml <= 0) return msg.reply("❌ Format: !margin btc 0.1");
        
        const biaya = Math.floor(marketData.prices[koin] * jml);
        if ((user.debt + biaya) > (user.balance * 2 + 1000)) return msg.reply("❌ Limit hutang habis.");

        user.debt = (user.debt || 0) + biaya;
        user.crypto[koin] = (user.crypto[koin] || 0) + jml;
        saveDB(db);
        return msg.reply(`⚠️ Hutang 💰${fmt(biaya)} untuk beli aset.`);
    }

    if (command === 'paydebt') {
        const bayar = parseInt(args[0]);
        const nominal = Math.min(isNaN(bayar) ? 0 : bayar, user.debt || 0);
        if (nominal <= 0) return msg.reply("❌ Masukkan nominal valid.");
        if (user.balance < nominal) return msg.reply("❌ Saldo kurang.");
        
        user.balance -= nominal;
        user.debt -= nominal;
        saveDB(db);
        return msg.reply(`✅ Hutang lunas 💰${fmt(nominal)}. Sisa: 💰${fmt(user.debt)}`);
    }

    // 11. MIGRASI
    if (command === 'migrasi' || command === 'gabungakun') {
        const targetJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const senderId = msg.key.remoteJid || msg.author; 

        if (!targetJid || targetJid === senderId) return msg.reply("❌ Tag akun utama! Contoh: `!migrasi @628xxx`");

        if (!db.users[targetJid]) db.users[targetJid] = { balance: 0, debt: 0, xp: 0, level: 1, crypto: {} };
        const targetUser = db.users[targetJid];

        targetUser.balance = (targetUser.balance || 0) + (user.balance || 0);
        targetUser.debt = (targetUser.debt || 0) + (user.debt || 0);
        targetUser.xp = (targetUser.xp || 0) + (user.xp || 0);
        targetUser.level = Math.max(targetUser.level, user.level);
        
        for (let [k, v] of Object.entries(user.crypto || {})) {
            targetUser.crypto[k] = (targetUser.crypto[k] || 0) + v;
        }

        delete db.users[senderId];
        saveDB(db);

        const { getChat } = msg;
        const chat = await getChat();
        await chat.sendMessage(`✅ Migrasi ke @${targetJid.split('@')[0]} berhasil.`, { mentions: [targetJid] });
    }
};
