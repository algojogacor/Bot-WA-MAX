const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => {
    return Math.floor(Number(num)).toLocaleString('id-ID');
};

// --- KONFIGURASI PASAR (SULTAN HARDCORE EDITION) ---
const COIN_CONFIG = {
    // BTC: Aset Naga (Volatilitas 15%)
    btc:  { start: 5_000_000_000, min: 500_000_000, vol: 15, bounce: 1, baseStock: 20 },
    
    // ETH: High Tier (Volatilitas 25%)
    eth:  { start: 500_000_000,   min: 50_000_000,  vol: 25, bounce: 1, baseStock: 50 },
    
    // SOL: Mid Tier (Volatilitas 40%)
    sol:  { start: 50_000_000,    min: 5_000_000,   vol: 40, bounce: 1, baseStock: 150 },
    
    // DOGE: Judi Tier (Volatilitas 80%)
    doge: { start: 5_000_000,     min: 100_000,     vol: 80, bounce: 1, baseStock: 1000 },
    
    // PEPE: SCAM OR LAMBO (Volatilitas 150%)
    pepe: { start: 500_000,       min: 1_000,       vol: 150, bounce: 5, baseStock: 5000 }
};

// --- BERITA PASAR EKSTREM ---
const newsPool = [
    // BAD NEWS (CRASH / RUG PULL)
    { txt: "☠️ BINANCE DIRETAS! Hacker mencuri 100.000 BTC!", effect: { all: 0.4 }, sMod: { all: 20 } }, 
    { txt: "📉 AMERIKA SERIKAT MELARANG TOTAL CRYPTO!", effect: { all: 0.1 }, sMod: { all: 50 } }, 
    { txt: "🐸 DEVELOPER PEPE KABUR (RUG PULL)!", effect: { pepe: 0.05 }, sMod: { pepe: 10000 } }, 
    { txt: "🐕 Elon Musk bilang Doge itu 'Sampah'.", effect: { doge: 0.2 }, sMod: { doge: 5000 } }, 
    
    // GOOD NEWS (MOON / JACKPOT)
    { txt: "🚀 ELON MUSK: 'Tesla resmi menerima Doge!'", effect: { doge: 5.0 }, sMod: { doge: -800 } }, 
    { txt: "🌕 BITCOIN menembus resisten $1 Juta!", effect: { btc: 2.5, all: 1.5 }, sMod: { btc: -15 } }, 
    { txt: "💎 BLACKROCK memborong semua stok Ethereum!", effect: { eth: 3.0 }, sMod: { eth: -40 } }, 
    { txt: "🐸 PEPE LISTING DI BINANCE! Hype gila-gilaan!", effect: { pepe: 10.0 }, sMod: { pepe: -4000 } }, 
    
    // NORMAL NEWS
    { txt: "📊 Market sideways, trader menunggu sinyal.", effect: { all: 1.0 }, sMod: { all: 0 } },
    { txt: "📉 Koreksi wajar setelah kenaikan harga.", effect: { all: 0.8 }, sMod: { all: 5 } },
    { txt: "📈 Sentimen positif dari investor Asia.", effect: { all: 1.2 }, sMod: { all: -5 } }
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
            stocks: { btc: 20, eth: 50, sol: 150, doge: 1000, pepe: 5000 },
            lastStockChange: { btc: 0, eth: 0, sol: 0, doge: 0, pepe: 0 },
            currentNews: "Pasar dibuka. Menunggu volatilitas tinggi.",
            nextNews: "Analisis pasar sedang berjalan...",
            marketTrend: "NORMAL"
        };
        saveDB(db);
    }

    const marketData = db.market;
    const now = Date.now();
    const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 Menit
    const TAX_SELL = 0.05; // Pajak Jual 5%
    
    // ============================================================
    // 3. ENGINE PERUBAHAN HARGA (CORE)
    // ============================================================
    if (now - marketData.lastUpdate > UPDATE_INTERVAL) {
        
        const activeNews = newsPool[Math.floor(Math.random() * newsPool.length)];
        if (!marketData.nextNews) marketData.nextNews = newsPool[Math.floor(Math.random() * newsPool.length)].txt;

        const trendRng = Math.random() * 100;
        let trendBias = 0; 
        let trendName = "NORMAL";

        if (trendRng < 10) { 
            trendBias = 100; // +100%
            trendName = "🚀 SUPER BULL RUN";
        } else if (trendRng < 20) { 
            trendBias = -80; // -80%
            trendName = "🩸 MARKET CRASH";
        } else if (trendRng < 60) {
            trendName = "⚡ HIGH VOLATILITY"; 
        } 

        marketData.marketTrend = trendName;
        marketData.currentNews = activeNews.txt;

        for (let k in marketData.prices) {
            const config = COIN_CONFIG[k];
            let volatility = config.vol;
            if (trendName === "⚡ HIGH VOLATILITY") volatility *= 2; 

            let randomPercent = (Math.random() * (volatility * 2)) - volatility;
            let totalPercent = randomPercent + trendBias;

            let newsMultiplier = activeNews.effect?.[k] || activeNews.effect?.all || 1.0;
            let currentPrice = marketData.prices[k];
            let newPrice = currentPrice * (1 + (totalPercent / 100)) * newsMultiplier;

            if (newPrice < config.min) newPrice = config.min * (1 + Math.random()); 

            marketData.prices[k] = Math.floor(newPrice) || 1000;

            const currentStock = marketData.stocks[k];
            const baseStock = config.baseStock;
            let refillRate = 0;
            if (currentStock < baseStock * 0.2) refillRate = 0.5; 
            else if (currentStock < baseStock) refillRate = 0.1; 
            
            let stockChange = Math.floor(baseStock * refillRate) + (Math.floor(Math.random() * 10) - 5);
            marketData.stocks[k] = Math.max(0, currentStock + stockChange);
            marketData.lastStockChange[k] = stockChange;
        }

        // LIKUIDASI MARGIN
        Object.keys(db.users).forEach(id => {
            let u = db.users[id];
            if (u.debt > 0) {
                let totalAsset = 0;
                if (u.crypto) for (let [k, v] of Object.entries(u.crypto)) totalAsset += v * (marketData.prices[k] || 0);
                const collateral = totalAsset + (u.balance || 0);
                
                if (u.debt > (collateral * 0.8)) { // Margin Call 80%
                    u.crypto = {}; 
                    u.balance = 0; 
                    u.debt = 0;    
                } else {
                    u.debt = Math.floor(u.debt * 1.1); // Bunga 10%
                }
            }
        });
        
        marketData.lastUpdate = now;
        marketData.nextNews = newsPool[Math.floor(Math.random() * newsPool.length)].txt;
        saveDB(db);
    }

    // ============================================================
    // COMMANDS
    // ============================================================

    // 1. COMMAND RESET (RESTORED!)
    if (command === 'resetmarket') {
        db.market = { prices: {} }; 
        saveDB(db);
        return msg.reply("♻️ *MARKET RESET!* Harga Sultan akan berlaku dalam 15 menit.");
    }

    // 2. MARKET
    if (command === 'market') {
        const getTxt = (n) => (n && typeof n === 'object' && n.txt) ? n.txt : n;
        if (!marketData.currentNews) marketData.currentNews = newsPool[0].txt;
        if (!marketData.nextNews) marketData.nextNews = newsPool[0].txt;

        let timeLeft = UPDATE_INTERVAL - (now - marketData.lastUpdate);
        if (timeLeft < 0) timeLeft = 0;
        let mLeft = Math.floor(timeLeft / 60000);
        let sLeft = Math.floor((timeLeft % 60000) / 1000);

        let txt = `📊 *CRYPTO SULTAN* [${marketData.marketTrend}]\n━━━━━━━━━━━━━━\n`;
        
        for (let k in marketData.prices) {
            let price = marketData.prices[k];
            let stock = Math.floor(marketData.stocks[k]);
            let icon = '🪙';
            if (marketData.marketTrend.includes("CRASH")) icon = '🩸';
            if (marketData.marketTrend.includes("BULL") || marketData.marketTrend.includes("MOON")) icon = '🚀';

            txt += `${icon} *${k.toUpperCase()}*: 💰${fmt(price)}\n`;
            txt += `   └ Stok: ${fmt(stock)}\n`;
        }

        txt += `━━━━━━━━━━━━━━\n`;
        txt += `📢 *NEWS:* "${getTxt(marketData.currentNews)}"\n`;
        txt += `🔮 *RUMOR:* "${getTxt(marketData.nextNews)}"\n\n`;
        txt += `⏳ Update: ${mLeft}m ${sLeft}s\n`;
        txt += `💰 Saldo: Rp ${fmt(user.balance)}`;
        return msg.reply(txt);
    }

    // 3. BUY
    if (command === 'buycrypto') {
        const koin = args[0]?.toLowerCase();
        const jml = parseFloat(args[1]?.replace(',', '.')); 
        
        if (!marketData.prices[koin] || isNaN(jml) || jml <= 0) return msg.reply("❌ Format: !buycrypto btc 0.1");
        
        const price = marketData.prices[koin];
        const total = Math.floor(price * jml); 
        
        if (user.balance < total) return msg.reply(`❌ Uang kurang! Butuh: Rp ${fmt(total)}`);
        if (marketData.stocks[koin] < jml) return msg.reply(`❌ Stok pasar habis!`);

        user.balance -= total; 
        marketData.stocks[koin] -= jml;
        user.crypto[koin] = (user.crypto[koin] || 0) + jml;
        saveDB(db);
        return msg.reply(`✅ *BELI SUKSES*\n+ ${jml} ${koin.toUpperCase()}\n- Rp ${fmt(total)}`);
    }

    // 4. SELL
    if (command === 'sellcrypto') {
        const koin = args[0]?.toLowerCase();
        let jml = args[1];

        if (!user.crypto?.[koin]) return msg.reply(`❌ Gak punya aset ${koin}!`);
        if (jml === 'all') jml = user.crypto[koin];
        else jml = parseFloat(jml?.replace(',', '.'));

        if (isNaN(jml) || jml <= 0 || user.crypto[koin] < jml) return msg.reply(`❌ Jumlah salah.`);

        const bruto = marketData.prices[koin] * jml;
        const pajak = bruto * TAX_SELL;
        const neto = Math.floor(bruto - pajak); 

        user.crypto[koin] -= jml;
        user.balance += neto; 
        marketData.stocks[koin] += jml;
        saveDB(db);
        return msg.reply(`✅ *JUAL SUKSES*\n+ Rp ${fmt(neto)} (Potong Pajak 5%)`);
    }

    // 5. MINING (RESTORED & UPGRADED!)
    if (command === 'mining' || command === 'mine') {
        const COOLDOWN = 60 * 60 * 1000; // 1 Jam sekali (Biar gak spam)
        if (now - (user.lastMining || 0) < COOLDOWN) {
            const timeLeft = Math.ceil((COOLDOWN - (now - user.lastMining)) / 60000);
            return msg.reply(`⏳ Mining Rig lagi pendingin! Tunggu ${timeLeft} menit.`);
        }

        // Gacha System: Common (80%), Rare (15%), Legendary (5%)
        const roll = Math.random();
        let coin = 'doge';
        let amount = 0;
        let rarity = "Common";

        if (roll < 0.05) { // 5% Chance BTC
            coin = 'btc';
            rarity = "🔥 LEGENDARY";
            amount = 0.000005; // Kecil karena harga BTC 5 Miliar (Dapat sekitar 25rb)
        } else if (roll < 0.20) { // 15% Chance SOL
            coin = 'sol';
            rarity = "🔷 RARE";
            amount = 0.0005; 
        } else { // 80% Chance PEPE/DOGE
            coin = Math.random() > 0.5 ? 'pepe' : 'doge';
            rarity = "⚪ Common";
            amount = Math.random() * 5; 
        }

        // Estimasi nilai
        const value = amount * marketData.prices[coin];
        
        user.crypto[coin] = (user.crypto[coin] || 0) + amount;
        user.lastMining = now;
        saveDB(db);

        return msg.reply(`⛏️ *MINING RESULT* [${rarity}]\n💎 Dapat: ${amount.toFixed(6)} ${coin.toUpperCase()}\n💰 Estimasi: Rp ${fmt(value)}`);
    }

    // 6. PORTFOLIO
    if (command === 'pf' || command === 'portofolio') {
        let txt = `💰 *ASET CRYPTO SULTAN*\n\n`;
        let assetTotal = 0;
        for (let [k, v] of Object.entries(user.crypto)) {
            if (v > 0.000001) {
                let val = Math.floor(v * marketData.prices[k]); 
                assetTotal += val;
                txt += `🔸 *${k.toUpperCase()}*: ${v.toLocaleString('id-ID')} (Rp ${fmt(val)})\n`;
            }
        }
        let netWorth = assetTotal + user.balance - user.debt;
        txt += `\n💵 Tunai: Rp ${fmt(user.balance)}\n`;
        if (user.debt > 0) txt += `⚠️ Hutang Margin: Rp ${fmt(user.debt)}\n`;
        txt += `📊 *Net Worth: Rp ${fmt(netWorth)}*`;
        return msg.reply(txt);
    }
    
    // 7. TOP
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
        let res = `🏆 *TOP 5 SULTAN* 🏆\n\n` + top.map((u, i) => `${i+1}. @${u.id.split('@')[0]} - Rp ${fmt(u.total)}`).join('\n');
        const { getChat } = msg;
        const chat = await getChat();
        await chat.sendMessage(res, { mentions: top.map(u => u.originalId) });
    }

    // 8. MARGIN
    if (command === 'margin') {
        const koin = args[0]?.toLowerCase();
        const jml = parseFloat(args[1]?.replace(',', '.'));
        if (!marketData.prices[koin] || isNaN(jml) || jml <= 0) return msg.reply("❌ Format: !margin btc 0.1");
        
        const biaya = Math.floor(marketData.prices[koin] * jml);
        if ((user.debt + biaya) > (user.balance * 3)) return msg.reply("❌ Limit Margin habis (Max 3x Saldo).");

        user.debt = (user.debt || 0) + biaya;
        user.crypto[koin] = (user.crypto[koin] || 0) + jml;
        saveDB(db);
        return msg.reply(`⚠️ *MARGIN ORDER*\nBerhutang Rp ${fmt(biaya)} untuk beli aset.\n_Awas! Jika harga turun, asetmu disita otomatis._`);
    }

    // 9. PAYDEBT
    if (command === 'paydebt') {
        const bayar = parseInt(args[0]);
        const nominal = Math.min(isNaN(bayar) ? 0 : bayar, user.debt || 0);
        if (nominal <= 0) return msg.reply("❌ Masukkan nominal valid.");
        if (user.balance < nominal) return msg.reply("❌ Saldo kurang.");
        
        user.balance -= nominal;
        user.debt -= nominal;
        saveDB(db);
        return msg.reply(`✅ Hutang lunas Rp ${fmt(nominal)}. Sisa: Rp ${fmt(user.debt)}`);
    }

    // 10. MIGRASI
    if (command === 'migrasi') {
        const targetJid = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        const senderId = msg.key.remoteJid || msg.author; 
        if (!targetJid || targetJid === senderId) return msg.reply("❌ Tag akun utama!");
        if (!db.users[targetJid]) db.users[targetJid] = { balance: 0, debt: 0, xp: 0, level: 1, crypto: {} };
        const targetUser = db.users[targetJid];
        targetUser.balance = (targetUser.balance || 0) + (user.balance || 0);
        targetUser.debt = (targetUser.debt || 0) + (user.debt || 0);
        for (let [k, v] of Object.entries(user.crypto || {})) {
            targetUser.crypto[k] = (targetUser.crypto[k] || 0) + v;
        }
        delete db.users[senderId];
        saveDB(db);
        msg.reply(`✅ Migrasi sukses.`);
    }
};
