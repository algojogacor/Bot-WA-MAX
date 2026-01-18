const { saveDB } = require('../helpers/database');

// FEE BROKER (3%)
const FEE_BUY = 0.03; 

// KONFIGURASI SAHAM (EDISI SULTAN - NAMING SINGKAT)
const STOCKS = {
    // TIER 1: RECEH
    GOTO: { name: "GoTo", base: 10_000_000, volatility: 0.15 }, 
    FREN: { name: "Smartfren", base: 5_000_000, volatility: 0.15 },

    // TIER 2: BLUE CHIP
    TLKM: { name: "Telkom", base: 400_000_000, volatility: 0.05 },
    BBCA: { name: "BCA", base: 950_000_000, volatility: 0.03 }, 
    BMRI: { name: "Mandiri", base: 600_000_000, volatility: 0.04 },

    // TIER 3: HIGH CLASS
    GGRM: { name: "G.Garam", base: 2_500_000_000, volatility: 0.08 },
    UNTR: { name: "U.Tractors", base: 2_800_000_000, volatility: 0.07 },
    
    // TIER 4: SULTAN ONLY
    IHSG: { name: "IHSG", base: 75_000_000_000, volatility: 0.02 }, 
    BTC: { name: "BTC", base: 500_000_000_000, volatility: 0.20 } 
};

// --- LOGIKA PASAR (REALISTIS) ---
const getStockData = (ticker) => {
    const stock = STOCKS[ticker];
    const now = Date.now();
    
    // Periode Tren (15 Menit) & Fluktuasi (1 Menit)
    const trendPeriod = Math.floor(now / (15 * 60 * 1000)); 
    const tickPeriod = Math.floor(now / 60000);

    // 1. Tren Pasar
    const marketCycle = Math.sin(trendPeriod / 4); 
    const trendBias = marketCycle * 0.3; 

    // 2. Noise
    const uniqueSeed = tickPeriod + stock.name.length;
    const noise = Math.sin(uniqueSeed * 1337) * 0.5; 

    // 3. Movement
    const movement = trendBias + (stock.volatility * noise);

    // 4. Harga Final
    let changeAmount = stock.base * movement;
    let currentPrice = Math.floor(stock.base + changeAmount);

    // KRISIS (Setiap 2 Jam chance 50%)
    const isCrash = (trendPeriod % 8 === 0) && (Math.random() > 0.5); 
    if (isCrash) currentPrice = Math.floor(currentPrice * 0.7); 

    return {
        price: Math.max(1000, currentPrice),
        isCrash: isCrash
    };
};

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto', 'dividen', 'claim'];
    if (!validCommands.includes(command)) return;

    if (!user.portfolio) user.portfolio = {};

    // 1. MARKET
    if (command === 'saham' || command === 'stock' || command === 'market') {
        const now = Date.now();
        const nextUpdate = Math.ceil((60000 - (now % 60000)) / 1000); 
        const { isCrash } = getStockData('IHSG');

        // Header tetap memberi hint jika Crash parah, tapi list harga polos
        let txt = isCrash 
            ? `🚨 *MARKET CRASH* 🚨\n`
            : `📈 *BURSA EFEK (BEI)* 📉\n`;
        
        txt += `⏱️ Refresh: ${nextUpdate}s\n`;
        txt += `------------------\n`;

        for (let [ticker, data] of Object.entries(STOCKS)) {
            const { price } = getStockData(ticker);
            
            // TAMPILAN POLOS (Hard Mode)
            // Hanya Nama dan Harga.
            txt += `🔹 *${ticker}*: Rp ${price.toLocaleString('id-ID')}\n`;
        }
        
        txt += `\n💡 \`!belisaham <code> <qty>\``;
        return msg.reply(txt);
    }

    // 2. BUY
    if (command === 'belisaham' || command === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        let qtyRaw = args[1];

        if (!STOCKS[ticker]) return msg.reply("❌ Kode salah.");
        
        let qty = parseInt(qtyRaw);
        const { price } = getStockData(ticker);

        if (qtyRaw === 'max' || qtyRaw === 'all') {
            qty = Math.floor(user.balance / (price * (1 + FEE_BUY)));
            if (qty < 1) return msg.reply(`❌ Uang kurang.`);
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah salah.");

        const rawCost = price * qty;
        const fee = Math.floor(rawCost * FEE_BUY);
        const total = rawCost + fee;

        if (user.balance < total) return msg.reply(`❌ Kurang: Rp ${total.toLocaleString('id-ID')}`);

        user.balance -= total;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        const p = user.portfolio[ticker];
        
        // Avg Down Logic
        p.avg = Math.floor(((p.qty * p.avg) + rawCost) / (p.qty + qty));
        p.qty += qty;

        saveDB(db);
        return msg.reply(`✅ *BUY SUKSES*\nCode: ${ticker}\nVol: ${qty}\nPrice: ${price.toLocaleString()}\nFee (3%): ${fee.toLocaleString()}\n📉 Total: ${total.toLocaleString()}`);
    }

    // 3. SELL (PAJAK SULTAN PROGRESIF)
    if (command === 'jualsaham' || command === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        let qty = args[1];

        if (!user.portfolio[ticker] || user.portfolio[ticker].qty <= 0) return msg.reply("❌ Gak punya saham ini.");

        const p = user.portfolio[ticker];
        if (qty === 'all') qty = p.qty;
        qty = parseInt(qty);

        if (isNaN(qty) || qty < 1 || qty > p.qty) return msg.reply("❌ Jumlah salah.");

        const { price } = getStockData(ticker);
        const gross = price * qty;

        // --- PAJAK PROGRESIF ---
        let rate = 0.05; 
        if (user.balance > 100_000_000_000_000) rate = 0.50; 
        else if (user.balance > 10_000_000_000_000) rate = 0.20; 

        const tax = Math.floor(gross * rate);
        const net = gross - tax;

        const profit = net - (p.avg * qty);
        const pct = ((profit / (p.avg * qty)) * 100).toFixed(2);
        const status = profit >= 0 ? '🟢' : '🔴';

        user.balance += net;
        p.qty -= qty;
        if (p.qty === 0) delete user.portfolio[ticker];

        saveDB(db);
        return msg.reply(`✅ *SELL SUKSES*\nCode: ${ticker}\nVol: ${qty}\nPrice: ${price.toLocaleString()}\n\n💰 Gross: ${gross.toLocaleString()}\n💸 Tax (${rate*100}%): ${tax.toLocaleString()}\n💵 *Net: ${net.toLocaleString()}*\n\n📊 P/L: ${status} ${profit.toLocaleString()} (${pct}%)`);
    }

    // 4. PORTO (Di sini P/L tetap ditampilkan agar user tau performa mereka sendiri)
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO*\n`;
        let totalVal = 0;
        let totalGain = 0;
        let hasStock = false;

        // Est. Tax Rate Display
        let rate = 0.05;
        if (user.balance > 100_000_000_000_000) rate = 0.50;
        else if (user.balance > 10_000_000_000_000) rate = 0.20;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                const { price } = getStockData(ticker); 
                
                const gross = price * data.qty;
                const net = gross - (gross * rate);
                const gain = net - (data.avg * data.qty);
                const pct = ((gain / (data.avg * data.qty)) * 100).toFixed(1);
                
                txt += `📜 *${ticker}* (${data.qty})\n`;
                txt += `   Avg: ${data.avg.toLocaleString()} | Now: ${price.toLocaleString()}\n`;
                txt += `   ${gain >= 0 ? '🟢' : '🔴'} P/L: ${gain.toLocaleString()} (${pct}%)\n\n`;

                totalVal += net;
                totalGain += gain;
                hasStock = true;
            }
        }

        if (!hasStock) return msg.reply("💼 Kosong.");

        txt += `━━━━━━━━━━\n`;
        txt += `💰 Net Asset: ${Math.floor(totalVal).toLocaleString()}\n`;
        txt += `${totalGain >= 0 ? '📈' : '📉'} Floating P/L: ${Math.floor(totalGain).toLocaleString()}`;
        txt += `\n_(After Tax ${rate*100}%)_`;

        return msg.reply(txt);
    }

    // 5. DIVIDEN
    if (command === 'dividen' || command === 'claim') {
        const COOLDOWN = 3600000; 
        const now = Date.now();
        const diff = now - (user.lastDividend || 0);

        if (diff < COOLDOWN) return msg.reply(`⏳ Tunggu ${Math.ceil((COOLDOWN - diff)/60000)} menit.`);

        let totalAsset = 0;
        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) totalAsset += getStockData(ticker).price * data.qty;
        }

        if (totalAsset === 0) return msg.reply("❌ Gak punya saham.");

        const amount = Math.floor(totalAsset * 0.03); // 3%
        user.balance += amount;
        user.lastDividend = now;
        saveDB(db);

        return msg.reply(`💸 *DIVIDEN CAIR*\nAsset: ${totalAsset.toLocaleString()}\nYield: 3%\n💵 *Diterima: ${amount.toLocaleString()}*`);
    }
};
