const { saveDB } = require('../helpers/database');

// KONFIGURASI SAHAM 
const STOCKS = {
    // TIER 1: RECEH (Buat Pemula / Gorengan)
    GOTO: { name: "GoTo Gojek Tokped", base: 100, volatility: 0.80 }, 
    FREN: { name: "Smartfren Telecom", base: 50, volatility: 0.90 },

    // TIER 2: BLUE CHIP (Aman & Stabil)
    TLKM: { name: "Telkom Indonesia", base: 4000, volatility: 0.10 },
    BBCA: { name: "Bank Central Asia", base: 9500, volatility: 0.05 }, 
    BMRI: { name: "Bank Mandiri", base: 6000, volatility: 0.06 },

    // TIER 3: HIGH CLASS (Harga Puluhan Ribu)
    GGRM: { name: "Gudang Garam", base: 25000, volatility: 0.15 },
    UNTR: { name: "United Tractors", base: 28000, volatility: 0.18 },
    
    // TIER 4: SULTAN ONLY (Harga Jutaan)
    IHSG: { name: "Indeks Saham Gabungan", base: 750000, volatility: 0.03 }, 
    BTC:  { name: "Bitcoin (Futures)", base: 5000000, volatility: 0.50 }   
};

// FUNGSI HARGA REAL-TIME (UPDATE TIAP 10 DETIK)
const getStockPrice = (ticker) => {
    const stock = STOCKS[ticker];
    const now = Date.now();
    
    // Perioda 10 Detik
    const period = Math.floor(now / 10000); 

    // ALGORITMA PERGERAKAN HARGA
    const wave = Math.sin(period / 5); 
    const uniqueSeed = period + stock.name.length; 
    const chaos = Math.sin(uniqueSeed * 1337); 

    // Gabungan Tren + Chaos
    const movement = (wave * 0.3) + (chaos * 0.7);

    // Kalkulasi Perubahan
    let changeAmount = stock.base * stock.volatility * movement;
    let currentPrice = Math.floor(stock.base + changeAmount);

    // Proteksi Harga Minimal
    return Math.max(50, currentPrice); 
};

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['saham', 'stock', 'market', 'belisaham', 'buystock', 'jualsaham', 'sellstock', 'porto'];
    if (!validCommands.includes(command)) return;

    if (!user.portfolio) user.portfolio = {};

    // 1. CEK PASAR (!saham)
    if (command === 'saham' || command === 'stock' || command === 'market') {
        const now = Date.now();
        const nextUpdate = Math.ceil((10000 - (now % 10000)) / 1000);

        let txt = `📈 *BURSA EFEK INDONESIA* 📉\n`;
        txt += `⏱️ Refresh: *${nextUpdate} detik lagi*\n`;
        txt += `------------------------------\n`;

        for (let [ticker, data] of Object.entries(STOCKS)) {
            const price = getStockPrice(ticker);
            const diff = price - data.base; 
            
            let icon = '➖';
            if (diff > 0) icon = '🟢';
            if (diff < 0) icon = '🔴';
            
            const percent = ((diff / data.base) * 100).toFixed(2);
            const sign = diff > 0 ? '+' : '';

            // Format angka
            txt += `${icon} *${ticker}*: Rp ${price.toLocaleString('id-ID')} (${sign}${percent}%)\n`;
        }
        
        txt += `\n💡 Beli: \`!belisaham <kode> <lembar>\``;
        txt += `\n💡 Jual: \`!jualsaham <kode> <lembar>\``;
        txt += `\n💡 Porto: \`!porto\``;

        return msg.reply(txt);
    }

    // 2. BELI SAHAM (!belisaham)
    if (command === 'belisaham' || command === 'buystock') {
        const ticker = args[0]?.toUpperCase();
        let qtyRaw = args[1];

        if (!STOCKS[ticker]) return msg.reply("❌ Kode saham tidak valid. Cek `!saham`.");
        
        // Fitur 'all' untuk beli maksimal
        let qty = parseInt(qtyRaw);
        const currentPrice = getStockPrice(ticker);

        if (qtyRaw === 'max' || qtyRaw === 'all') {
            qty = Math.floor(user.balance / currentPrice);
            if (qty < 1) return msg.reply(`❌ Uangmu gak cukup buat beli 1 lembar pun.`);
        }

        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah lembar minimal 1.");

        const totalCost = currentPrice * qty;

        if (user.balance < totalCost) return msg.reply(`❌ Uang kurang! Butuh: Rp ${totalCost.toLocaleString('id-ID')}`);

        user.balance -= totalCost;

        if (!user.portfolio[ticker]) user.portfolio[ticker] = { qty: 0, avg: 0 };
        
        const oldQty = user.portfolio[ticker].qty;
        const oldAvg = user.portfolio[ticker].avg;
        
        // Rumus Average Down
        const newAvg = Math.floor(((oldQty * oldAvg) + totalCost) / (oldQty + qty));
        
        user.portfolio[ticker].qty += qty;
        user.portfolio[ticker].avg = newAvg;

        saveDB(db);
        return msg.reply(`✅ *ORDER BUY DONE!*\nEmiten: ${ticker}\nVol: ${qty.toLocaleString()} Lbr\nHarga: Rp ${currentPrice.toLocaleString('id-ID')}\n📉 Total: Rp ${totalCost.toLocaleString('id-ID')}`);
    }

    // 3. JUAL SAHAM (!jualsaham)
    if (command === 'jualsaham' || command === 'sellstock') {
        const ticker = args[0]?.toUpperCase();
        let qty = args[1];

        if (!user.portfolio[ticker] || user.portfolio[ticker].qty <= 0) {
            return msg.reply("❌ Kamu gak punya saham ini.");
        }

        const maxQty = user.portfolio[ticker].qty;
        if (qty === 'all') qty = maxQty;
        qty = parseInt(qty);

        if (isNaN(qty) || qty < 1 || qty > maxQty) return msg.reply("❌ Jumlah lembar tidak valid.");

        const currentPrice = getStockPrice(ticker);
        const totalRevenue = currentPrice * qty;
        const avgBuyPrice = user.portfolio[ticker].avg;
        
        const profit = totalRevenue - (avgBuyPrice * qty);
        const profitPercent = ((profit / (avgBuyPrice * qty)) * 100).toFixed(2);
        const status = profit >= 0 ? '🟢 CUAN' : '🔴 BONCOS';

        user.balance += totalRevenue;
        user.portfolio[ticker].qty -= qty;
        
        if (user.portfolio[ticker].qty === 0) delete user.portfolio[ticker];

        saveDB(db);
        return msg.reply(`✅ *ORDER SELL DONE!*\nEmiten: ${ticker}\nVol: ${qty.toLocaleString()} Lbr\nHarga: Rp ${currentPrice.toLocaleString('id-ID')}\n💰 Terima: Rp ${totalRevenue.toLocaleString('id-ID')}\n\n📊 P/L: ${status} Rp ${profit.toLocaleString('id-ID')} (${profitPercent}%)`);
    }

    // 4. CEK PORTFOLIO (!porto)
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTFOLIO SAHAM* 💼\n`;
        let totalAssetVal = 0;
        let totalProfit = 0;
        let hasStock = false;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                const currentPrice = getStockPrice(ticker); 
                const assetVal = currentPrice * data.qty;
                const modal = data.avg * data.qty;
                const gain = assetVal - modal;
                const gainPercent = ((gain / modal) * 100).toFixed(1);
                
                const icon = gain >= 0 ? '🟢' : '🔴';
                const sign = gain >= 0 ? '+' : '';

                txt += `📜 *${ticker}* (${data.qty.toLocaleString()} Lbr)\n`;
                txt += `   Avg: Rp ${data.avg.toLocaleString()}\n`;
                txt += `   Now: Rp ${currentPrice.toLocaleString()}\n`;
                txt += `   ${icon} P/L: Rp ${gain.toLocaleString()} (${sign}${gainPercent}%)\n\n`;

                totalAssetVal += assetVal;
                totalProfit += gain;
                hasStock = true;
            }
        }

        if (!hasStock) return msg.reply("💼 Portfolio saham kosong melompong.");

        const globalIcon = totalProfit >= 0 ? '📈' : '📉';
        txt += `━━━━━━━━━━━━━━━━━━\n`;
        txt += `💰 Nilai Aset: Rp ${totalAssetVal.toLocaleString('id-ID')}\n`;
        txt += `${globalIcon} Floating P/L: Rp ${totalProfit.toLocaleString('id-ID')}`;

        return msg.reply(txt);
    }
};
