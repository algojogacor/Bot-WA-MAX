const { saveDB } = require('../helpers/database');

// HELPER FORMAT ANGKA
const fmt = (num) => {
    return Math.floor(Number(num)).toLocaleString('id-ID');
};

// --- KONFIGURASI PASAR (REAL WORLD TIER) ---
// volatility: Seberapa liar pergerakannya (Realism: BTC rendah, Meme tinggi)
// correlation: Seberapa kuat ikut pergerakan BTC (0.0 - 1.0)
const COIN_CONFIG = {
    btc:  { start: 5_000_000_000, min: 2_000_000_000, vol: 0.05, correlation: 1.0, baseStock: 20 },
    eth:  { start: 500_000_000,   min: 100_000_000,   vol: 0.08, correlation: 0.9, baseStock: 50 },
    sol:  { start: 50_000_000,    min: 5_000_000,     vol: 0.12, correlation: 0.7, baseStock: 150 },
    doge: { start: 5_000_000,     min: 100_000,       vol: 0.20, correlation: 0.5, baseStock: 1000 },
    pepe: { start: 500_000,       min: 1_000,         vol: 0.35, correlation: 0.3, baseStock: 5000 }
};

// --- BERITA PASAR (REALISTIS & MAKRO) ---
const newsPool = [
    // GLOBAL MACRO (Mempengaruhi BTC & ETH kuat)
    { txt: "🇺🇸 The Fed menaikkan suku bunga! Pasar panik.", type: "macro", sentiment: -0.15 },
    { txt: "🇺🇸 Inflasi AS turun, investor kembali optimis.", type: "macro", sentiment: 0.10 },
    { txt: "🇨🇳 China melarang penambangan Bitcoin kembali.", type: "macro", sentiment: -0.20 },
    { txt: "🇪🇺 Eropa meresmikan regulasi crypto yang ramah.", type: "macro", sentiment: 0.08 },
    
    // COIN SPECIFIC (Hype / FUD)
    { txt: "🐳 Whale misterius memindahkan 10.000 BTC ke exchange.", type: "dump", target: "btc", strength: 0.12 },
    { txt: "⚡ Jaringan Solana mengalami kemacetan (outage).", type: "dump", target: "sol", strength: 0.25 },
    { txt: "🐕 Elon Musk memposting foto anjing di Twitter.", type: "pump", target: "doge", strength: 0.40 },
    { txt: "🐸 Komunitas PEPE membakar 1 Triliun token.", type: "pump", target: "pepe", strength: 0.50 },
    
    // MARKET SENTIMENT
    { txt: "📊 Volume perdagangan rendah, pasar stagnan.", type: "neutral", sentiment: 0 },
    { txt: "📈 Altseason dimulai! Dominasi BTC turun.", type: "altseason", sentiment: 0.05 },
    { txt: "📉 Bitcoin Dominance naik, Altcoin berdarah.", type: "btcdom", sentiment: -0.05 }
];

module.exports = async (command, args, msg, user, db) => {
    // 1. Inisialisasi User
    if (typeof user.balance === 'undefined') user.balance = 0;
    if (typeof user.crypto === 'undefined') user.crypto = {};
    if (typeof user.debt === 'undefined') user.debt = 0;

    // 2. Inisialisasi Market State (Menambah Momentum & History)
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
            lastMoves: { btc: 0, eth: 0, sol: 0, doge: 0, pepe: 0 }, // Momentum tracker
            currentNews: "Pasar dibuka.",
            marketTrend: "NEUTRAL",
            btcTrend: 0 // Tren utama BTC (-1 s/d 1)
        };
        saveDB(db);
    }

    const marketData = db.market;
    const now = Date.now();
    const UPDATE_INTERVAL = 15 * 60 * 1000; // 15 Menit
    
    // ============================================================
    // 3. REALISTIC ENGINE (MOMENTUM & CORRELATION)
    // ============================================================
    if (now - marketData.lastUpdate > UPDATE_INTERVAL) {
        
        // A. Pilih Berita
        const news = newsPool[Math.floor(Math.random() * newsPool.length)];
        marketData.currentNews = news.txt;

        // B. Update Tren Global BTC (Induk Pasar)
        // BTC bergerak berdasarkan sentimen Macro + Random Noise + Momentum lama
        let noise = (Math.random() - 0.5) * 0.1; // Random -5% s/d +5%
        let macroEffect = (news.type === 'macro') ? news.sentiment : 0;
        let momentum = marketData.lastMoves['btc'] * 0.5; // Inertia 50% dari move sebelumnya

        // Hitung pergerakan BTC hari ini
        let btcMove = noise + macroEffect + momentum;
        
        // Capping pergerakan BTC biar gak terlalu gila (Realistis max +/- 20% per update)
        if (btcMove > 0.2) btcMove = 0.2;
        if (btcMove < -0.2) btcMove = -0.2;

        marketData.btcTrend = btcMove; // Simpan tren BTC

        // Tentukan Label Tren
        if (btcMove > 0.15) marketData.marketTrend = "🚀 BULL RUN";
        else if (btcMove > 0.05) marketData.marketTrend = "📈 UPTREND";
        else if (btcMove < -0.15) marketData.marketTrend = "🩸 CRASH";
        else if (btcMove < -0.05) marketData.marketTrend = "📉 DOWNTREND";
        else marketData.marketTrend = "➡️ SIDEWAYS";

        // C. Update Harga Semua Koin
        for (let k in marketData.prices) {
            const config = COIN_CONFIG[k];
            const oldPrice = marketData.prices[k];
            let percentChange = 0;

            if (k === 'btc') {
                percentChange = btcMove;
            } else {
                // Koin lain mengikuti BTC berdasarkan 'correlation'
                let correlationMove = btcMove * config.correlation;
                
                // Tambah volatilitas unik koin tersebut
                let uniqueMove = (Math.random() - 0.5) * config.vol; 
                
                // Efek Berita Spesifik
                let newsEffect = 0;
                if (news.target === k) {
                    newsEffect = (news.type === 'pump') ? news.strength : -news.strength;
                }

                percentChange = correlationMove + uniqueMove + newsEffect;
            }

            // --- LOGIKA KOREKSI (PROFIT TAKING / BUYBACK) ---
            // Jika harga naik terlalu tinggi (>30% dalam 1 sesi), ada aksi jual otomatis (koreksi)
            if (percentChange > 0.30) percentChange -= 0.10; 
            // Jika harga jatuh terlalu dalam (<-30%), ada aksi beli (buyback)
            if (percentChange < -0.30) percentChange += 0.10;

            // Terapkan Harga Baru
            let newPrice = oldPrice * (1 + percentChange);
            
            // Hard Floor (Support Level)
            if (newPrice < config.min) newPrice = config.min * (1 + (Math.random() * 0.1));

            marketData.prices[k] = Math.floor(newPrice);
            marketData.lastMoves[k] = percentChange; // Simpan untuk momentum next round
            
            // Refill Stok Pasar (Stok naik kalau harga turun - panic selling)
            // Stok turun kalau harga naik - orang HODL
            let stockChange = 0;
            if (percentChange > 0) stockChange = -Math.floor(config.baseStock * 0.05); // Harga naik, stok langka
            else stockChange = Math.floor(config.baseStock * 0.1); // Harga turun, stok banjir
            
            marketData.stocks[k] = Math.max(10, marketData.stocks[k] + stockChange);
        }

        // --- LIKUIDASI MARGIN ---
        Object.keys(db.users).forEach(id => {
            let u = db.users[id];
            if (u.debt > 0) {
                let totalAsset = 0;
                if (u.crypto) for (let [k, v] of Object.entries(u.crypto)) totalAsset += v * (marketData.prices[k] || 0);
                const collateral = totalAsset + (u.balance || 0);
                
                if (u.debt > (collateral * 0.85)) { // 85% LTV Liquidation
                    u.crypto = {}; u.balance = 0; u.debt = 0;    
                } else {
                    u.debt = Math.floor(u.debt * 1.05); // Bunga 5% (Lebih wajar)
                }
            }
        });
        
        marketData.lastUpdate = now;
        saveDB(db);
    }

    // ============================================================
    // COMMANDS
    // ============================================================

    // 1. RESET (Penting!)
    if (command === 'resetmarket') {
        delete db.market; 
        saveDB(db);
        return msg.reply("♻️ *MARKET RESET!* Algoritma Realistis (BTC Driven) aktif.");
    }

    // 2. MARKET UI
    if (command === 'market') {
        const getTxt = (n) => (n && typeof n === 'object' && n.txt) ? n.txt : n;
        if (!marketData.currentNews) marketData.currentNews = newsPool[0].txt;

        let timeLeft = UPDATE_INTERVAL - (now - marketData.lastUpdate);
        if (timeLeft < 0) timeLeft = 0;
        let mLeft = Math.floor(timeLeft / 60000);
        let sLeft = Math.floor((timeLeft % 60000) / 1000);

        let txt = `📊 *CRYPTO GLOBAL* [${marketData.marketTrend}]\n━━━━━━━━━━━━━━\n`;
        
        for (let k in marketData.prices) {
            let price = marketData.prices[k];
            let stock = Math.floor(marketData.stocks[k]);
            let move = (marketData.lastMoves[k] * 100).toFixed(2);
            
            let icon = move >= 0 ? '🟢' : '🔴';
            if (move > 20) icon = '🚀';
            if (move < -20) icon = '🩸';

            txt += `${icon} *${k.toUpperCase()}*: Rp ${fmt(price)} (${move}%)\n`;
            txt += `   └ Vol: ${fmt(stock)}\n`;
        }

        txt += `━━━━━━━━━━━━━━\n`;
        txt += `🗞️ *NEWS:* "${getTxt(marketData.currentNews)}"\n`;
        txt += `⏳ Next Candle: ${mLeft}m ${sLeft}s\n`;
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

    // 4. SELL (PAJAK SULTAN PROGRESIF - DIPERTAHANKAN)
    if (command === 'sellcrypto') {
        const koin = args[0]?.toLowerCase();
        let jml = args[1];

        if (!user.crypto?.[koin]) return msg.reply(`❌ Gak punya aset ${koin}!`);
        if (jml === 'all') jml = user.crypto[koin];
        else jml = parseFloat(jml?.replace(',', '.'));
        if (isNaN(jml) || jml <= 0 || user.crypto[koin] < jml) return msg.reply(`❌ Jumlah salah.`);

        const bruto = marketData.prices[koin] * jml;

        // --- PAJAK PROGRESIF ---
        let taxRate = 0.05; 
        if (user.balance > 100_000_000_000_000) taxRate = 0.50; // >100T = 50% Pajak
        else if (user.balance > 10_000_000_000_000) taxRate = 0.20; // >10T = 20% Pajak

        const pajak = Math.floor(bruto * taxRate);
        const neto = Math.floor(bruto - pajak); 

        user.crypto[koin] -= jml;
        user.balance += neto; 
        marketData.stocks[koin] += jml;
        saveDB(db);
        
        return msg.reply(`✅ *JUAL SUKSES*\n+ Rp ${fmt(neto)}\n_(Tax ${(taxRate*100)}%: Rp ${fmt(pajak)})_`);
    }

    // 5. MINING
    if (command === 'mining' || command === 'mine') {
        const COOLDOWN = 60 * 60 * 1000; 
        if (now - (user.lastMining || 0) < COOLDOWN) {
            const timeLeft = Math.ceil((COOLDOWN - (now - user.lastMining)) / 60000);
            return msg.reply(`⏳ Mining Rig panas! Tunggu ${timeLeft} menit.`);
        }

        const roll = Math.random();
        let coin = 'doge';
        let amount = 0;
        let rarity = "Common";

        if (roll < 0.05) { coin = 'btc'; rarity = "🔥 LEGENDARY"; amount = 0.000005; } 
        else if (roll < 0.20) { coin = 'sol'; rarity = "🔷 RARE"; amount = 0.0005; } 
        else { coin = Math.random() > 0.5 ? 'pepe' : 'doge'; rarity = "⚪ Common"; amount = Math.random() * 5; }

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
