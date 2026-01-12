const { saveDB } = require('../helpers/database');

// KONFIGURASI FEE (PAJAK) - ANTI SCALPING
const FEE_BUY = 0.03; // 3% Biaya Broker saat Beli
const FEE_SELL = 0.05; // 5% Pajak saat Jual (Total Spread 8%)

// KONFIGURASI SAHAM (VOLATILITY DITURUNKAN)
const STOCKS = {
    // TIER 1: RECEH
    GOTO: { name: "GoTo Gojek Tokped", base: 100, volatility: 0.15 }, 
    FREN: { name: "Smartfren Telecom", base: 50, volatility: 0.15 },

    // TIER 2: BLUE CHIP
    TLKM: { name: "Telkom Indonesia", base: 4000, volatility: 0.05 },
    BBCA: { name: "Bank Central Asia", base: 9500, volatility: 0.03 }, 
    BMRI: { name: "Bank Mandiri", base: 6000, volatility: 0.04 },

    // TIER 3: HIGH CLASS
    GGRM: { name: "Gudang Garam", base: 25000, volatility: 0.08 },
    UNTR: { name: "United Tractors", base: 28000, volatility: 0.07 },
    
    // TIER 4: SULTAN ONLY
    IHSG: { name: "Indeks Saham Gabungan", base: 750000, volatility: 0.02 }, 
    BTC:  { name: "Bitcoin (Futures)", base: 5000000, volatility: 0.20 } 
};

// --- LOGIKA PASAR & KRISIS ---
const getStockData = (ticker) => {
    const stock = STOCKS[ticker];
    const now = Date.now();
    
    // Periode 60 Detik
    const period = Math.floor(now / 60000); 

    // KRISIS EKONOMI (Setiap 30 menit)
    const isCrash = (period % 30 === 0); 

    // Algoritma Pergerakan
    const wave = Math.sin(period / 10); 
    const uniqueSeed = period + stock.name.length; 
    const chaos = Math.sin(uniqueSeed * 1337); 

    const movement = (wave * 0.4) + (chaos * 0.4);

    let changeAmount = stock.base * stock.volatility * movement;
    let currentPrice = Math.floor(stock.base + changeAmount);

    // Diskon Krisis 40%
    if (isCrash) {
        currentPrice = Math.floor(currentPrice * 0.6); 
    }

    return {
        price: Math.max(50, currentPrice),
        isCrash: isCrash
    };
};

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto', 'dividen', 'claim'];
    if (!validCommands.includes(command)) return;

    if (!user.portfolio) user.portfolio = {};

    // 1. CEK PASAR (!saham)
    if (command === 'saham' || command === 'stock' || command === 'market') {
        const now = Date.now();
        const nextUpdate = Math.ceil((60000 - (now % 60000)) / 1000); 

        const marketStatus = getStockData('BTC');
        const isCrisis = marketStatus.isCrash;

        let txt = isCrisis 
            ? `🚨 *MARKET CRASH!! KRISIS EKONOMI!!* 🚨\n🔥 HARGA SAHAM RUNTUH 🔥\n`
            : `📈 *BURSA EFEK INDONESIA* 📉\n`;
        
        txt += `⏱️ Refresh: *${nextUpdate} detik lagi*\n`;
        txt += `💸 Fee Beli: ${(FEE_BUY*100)}% | Fee Jual: ${(FEE_SELL*100)}%\n`;
        txt += `------------------------------\n`;

        for (let [ticker, data] of Object.entries(STOCKS)) {
            const { price } = getStockData(ticker);
            const diff = price - data.base; 
            
            let icon = '➖';
            if (isCrisis) icon = '🔥';
            else if (diff > 0) icon = '🟢';
            else if (diff < 0) icon = '🔴';
            
            const percent = ((diff / data.base) * 100).toFixed(2);
            const sign = diff > 0 ? '+' : '';

            txt += `${icon} *${ticker}*: Rp ${price.toLocaleString('id-ID')} (${sign}${percent}%)\n`;
        }
        
        txt += `\n💡 Beli: \`!belisaham <kode> <lembar>\``;
        txt += `\n💡 Jual: \`!jualsaham <kode> <lembar>\``;

        return msg.reply(txt);
    }

    // 2. BELI SAHAM (!belisaham)
    if (command === 'belisaham' || command === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        let qtyRaw = args[1];

        if (!STOCKS[ticker]) return msg.reply("❌ Kode saham tidak valid.");
        
        let qty = parseInt(qtyRaw);
        const { price: currentPrice } = getStockData(ticker);

        if (qtyRaw === 'max' || qtyRaw === 'all') {
            // Hitung max buy kena fee
            qty = Math.floor(user.balance / (currentPrice * (1 + FEE_BUY)));
            if (qty < 1) return msg.reply(`❌ Uangmu gak cukup (Ingat ada Fee Admin 3%).`);
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah lembar minimal 1.");

        const rawCost = currentPrice * qty;
        const adminFee = Math.floor(rawCost * FEE_BUY);
        const totalCost = rawCost + adminFee;

        if (user.balance < totalCost) return msg.reply(`❌ Uang kurang! Harga + Fee 3% = Rp ${totalCost.toLocaleString('id-ID')}`);

        user.balance -= totalCost;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        
        const oldQty = user.portfolio[ticker].qty;
        const oldAvg = user.portfolio[ticker].avg;
        
        const newAvg = Math.floor(((oldQty * oldAvg) + rawCost) / (oldQty + qty));
        
        user.portfolio[ticker].qty += qty;
        user.portfolio[ticker].avg = newAvg;

        saveDB(db);
        return msg.reply(`✅ *ORDER BUY SUKSES*\nEmiten: ${ticker}\nVol: ${qty.toLocaleString()} Lbr\nHarga: Rp ${currentPrice.toLocaleString()}\nAdmin (3%): Rp ${adminFee.toLocaleString()}\n📉 Total Bayar: Rp ${totalCost.toLocaleString()}`);
    }

    // 3. JUAL SAHAM (!jualsaham)
    if (command === 'jualsaham' || command === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        let qty = args[1];

        if (!user.portfolio[ticker] || user.portfolio[ticker].qty <= 0) return msg.reply("❌ Kamu gak punya saham ini.");

        const maxQty = user.portfolio[ticker].qty;
        if (qty === 'all') qty = maxQty;
        qty = parseInt(qty);

        if (isNaN(qty) || qty < 1 || qty > maxQty) return msg.reply("❌ Jumlah lembar tidak valid.");

        const { price: currentPrice } = getStockData(ticker);
        
        const rawRevenue = currentPrice * qty;
        const tax = Math.floor(rawRevenue * FEE_SELL);
        const netRevenue = rawRevenue - tax;

        const avgBuyPrice = user.portfolio[ticker].avg;
        
        const profit = netRevenue - (avgBuyPrice * qty);
        const profitPercent = ((profit / (avgBuyPrice * qty)) * 100).toFixed(2);
        const status = profit >= 0 ? '🟢 CUAN' : '🔴 BONCOS';

        user.balance += netRevenue;
        user.portfolio[ticker].qty -= qty;
        
        if (user.portfolio[ticker].qty === 0) delete user.portfolio[ticker];

        saveDB(db);
        return msg.reply(`✅ *ORDER SELL SUKSES*\nEmiten: ${ticker}\nVol: ${qty.toLocaleString()} Lbr\nHarga: Rp ${currentPrice.toLocaleString()}\nPajak (5%): Rp ${tax.toLocaleString()}\n💰 Terima Bersih: Rp ${netRevenue.toLocaleString()}\n📊 Realized P/L: ${status} Rp ${profit.toLocaleString()} (${profitPercent}%)`);
    }

    // 4. CEK PORTFOLIO (!porto)
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO SAHAM* 💼\n`;
        let totalAssetVal = 0;
        let totalProfit = 0;
        let hasStock = false;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                const { price: currentPrice } = getStockData(ticker); 
                
                const rawVal = currentPrice * data.qty;
                const estTax = rawVal * FEE_SELL;
                const netVal = rawVal - estTax;

                const modal = data.avg * data.qty;
                const gain = netVal - modal;
                const gainPercent = ((gain / modal) * 100).toFixed(1);
                
                const icon = gain >= 0 ? '🟢' : '🔴';

                txt += `📜 *${ticker}* (${data.qty.toLocaleString()} Lbr)\n`;
                txt += `   Avg: Rp ${data.avg.toLocaleString()} | Now: Rp ${currentPrice.toLocaleString()}\n`;
                txt += `   ${icon} Est. P/L: Rp ${gain.toLocaleString()} (${gainPercent}%)\n\n`;

                totalAssetVal += netVal;
                totalProfit += gain;
                hasStock = true;
            }
        }

        if (!hasStock) return msg.reply("💼 Portfolio saham kosong.");

        const globalIcon = totalProfit >= 0 ? '📈' : '📉';
        txt += `━━━━━━━━━━━━━━━━━━\n`;
        txt += `💰 Est. Aset Bersih: Rp ${Math.floor(totalAssetVal).toLocaleString()}\n`;
        txt += `${globalIcon} Floating P/L: Rp ${Math.floor(totalProfit).toLocaleString()}`;
        txt += `\n_(Nilai sudah dikurangi estimasi pajak jual 5%)_`;

        return msg.reply(txt);
    }

    // 5. KLAIM DIVIDEN (!dividen)
    if (command === 'dividen' || command === 'claim') {
        const COOLDOWN = 3600000; 
        
        const lastClaim = user.lastDividend || 0;
        const now = Date.now();
        const diff = now - lastClaim;

        if (diff < COOLDOWN) {
            const minutesLeft = Math.ceil((COOLDOWN - diff) / 60000);
            return msg.reply(`⏳ *SABAR DULU!* ⏳\nDividen baru bisa diklaim lagi dalam *${minutesLeft} menit*.`);
        }

        let totalAsset = 0;
        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                const { price } = getStockData(ticker);
                totalAsset += price * data.qty;
            }
        }

        if (totalAsset === 0) return msg.reply("❌ Kamu gak punya saham. Beli dulu biar dapet dividen!");

        const yieldPercent = 0.03; // 3% FLAT
        const dividendAmount = Math.floor(totalAsset * yieldPercent);

        user.balance += dividendAmount;
        user.lastDividend = now;

        saveDB(db);

        return msg.reply(`💸 *DIVIDEN CAIR!* 💸\n\n💰 Aset Saham: Rp ${totalAsset.toLocaleString('id-ID')}\n📊 Yield: ${(yieldPercent * 100)}%\n💵 *Diterima: Rp ${dividendAmount.toLocaleString('id-ID')}*`);
    }
};
