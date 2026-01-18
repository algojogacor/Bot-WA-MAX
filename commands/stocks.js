const { saveDB } = require('../helpers/database');

// KONFIGURASI FEE (PAJAK DASAR)
const FEE_BUY = 0.03; // 3% Biaya Broker

// KONFIGURASI SAHAM (EDISI SULTAN KUADRILIUN)
// Harga disesuaikan agar Top 1 (23 Kuadriliun) tetap merasa saham ini barang mewah.
const STOCKS = {
    // TIER 1: RECEH (Jutaan)
    GOTO: { name: "GoTo Gojek Tokped", base: 10_000_000, volatility: 0.15 }, 
    FREN: { name: "Smartfren Telecom", base: 5_000_000, volatility: 0.15 },

    // TIER 2: BLUE CHIP (Ratusan Juta)
    TLKM: { name: "Telkom Indonesia", base: 400_000_000, volatility: 0.05 },
    BBCA: { name: "Bank Central Asia", base: 950_000_000, volatility: 0.03 }, 
    BMRI: { name: "Bank Mandiri", base: 600_000_000, volatility: 0.04 },

    // TIER 3: HIGH CLASS (Miliaran)
    GGRM: { name: "Gudang Garam", base: 2_500_000_000, volatility: 0.08 },
    UNTR: { name: "United Tractors", base: 2_800_000_000, volatility: 0.07 },
    
    // TIER 4: SULTAN ONLY (Puluhan Miliar)
    IHSG: { name: "Indeks Saham Gabungan", base: 75_000_000_000, volatility: 0.02 }, 
    BTCF: { name: "Bitcoin Futures ETF", base: 500_000_000_000, volatility: 0.20 } 
};

// --- LOGIKA PASAR (REALISTIS DENGAN TREN) ---
const getStockData = (ticker) => {
    const stock = STOCKS[ticker];
    const now = Date.now();
    
    // Periode Tren (Berubah setiap 15 menit)
    const trendPeriod = Math.floor(now / (15 * 60 * 1000)); 
    
    // Periode Fluktuasi (Berubah setiap 1 menit)
    const tickPeriod = Math.floor(now / 60000);

    // 1. Tentukan Tren Pasar (Bullish / Bearish)
    // Menggunakan Math.sin pada trendPeriod agar ada siklus naik-turun jangka panjang
    const marketCycle = Math.sin(trendPeriod / 4); // Siklus lambat
    const trendBias = marketCycle * 0.3; // Bias +/- 30% dari Base Price

    // 2. Tentukan Fluktuasi Harian (Noise)
    const uniqueSeed = tickPeriod + stock.name.length;
    const noise = Math.sin(uniqueSeed * 1337) * 0.5; // Random noise +/- 50% dari Volatility

    // 3. Gabungkan Tren + Noise
    // Volatility makin tinggi, noise makin berpengaruh
    const movement = trendBias + (stock.volatility * noise);

    // 4. Hitung Harga Final
    let changeAmount = stock.base * movement;
    let currentPrice = Math.floor(stock.base + changeAmount);

    // KRISIS EKONOMI (Setiap 2 Jam sekali ada peluang crash)
    const isCrash = (trendPeriod % 8 === 0) && (Math.random() > 0.5); 
    if (isCrash) {
        currentPrice = Math.floor(currentPrice * 0.7); // Diskon 30% saat crash
    }

    return {
        price: Math.max(1000, currentPrice),
        trend: movement > 0 ? 'bull' : 'bear',
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

        const marketStatus = getStockData('IHSG');
        const isCrisis = marketStatus.isCrash;

        let txt = isCrisis 
            ? `🚨 *MARKET CRASH!! IHSG MERAH DARAH!!* 🚨\n🔥 HARGA SAHAM DISKON 30% 🔥\n`
            : `📈 *BURSA EFEK INDONESIA (BEI)* 📉\n`;
        
        txt += `⏱️ Refresh: *${nextUpdate} detik lagi*\n`;
        txt += `------------------------------\n`;

        for (let [ticker, data] of Object.entries(STOCKS)) {
            const { price, trend } = getStockData(ticker);
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

    // 3. JUAL SAHAM (!jualsaham) - DENGAN PAJAK PROGRESIF
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

        // --- PAJAK PROGRESIF SULTAN ---
        let taxRate = 0.05; // Default 5%
        
        // > 100 Triliun kena 50%
        if (user.balance > 100_000_000_000_000) { 
            taxRate = 0.50; 
        } 
        // > 10 Triliun kena 20%
        else if (user.balance > 10_000_000_000_000) {
            taxRate = 0.20; 
        }

        const tax = Math.floor(rawRevenue * taxRate);
        const netRevenue = rawRevenue - tax;

        const avgBuyPrice = user.portfolio[ticker].avg;
        const profit = netRevenue - (avgBuyPrice * qty);
        const profitPercent = ((profit / (avgBuyPrice * qty)) * 100).toFixed(2);
        const status = profit >= 0 ? '🟢 CUAN' : '🔴 BONCOS';

        user.balance += netRevenue;
        user.portfolio[ticker].qty -= qty;
        
        if (user.portfolio[ticker].qty === 0) delete user.portfolio[ticker];

        saveDB(db);
        return msg.reply(`✅ *ORDER SELL SUKSES*\nEmiten: ${ticker}\nVol: ${qty.toLocaleString()} Lbr\nHarga: Rp ${currentPrice.toLocaleString()}\n\n💰 Nilai Jual: Rp ${rawRevenue.toLocaleString()}\n💸 Pajak Sultan (${(taxRate*100)}%): Rp ${tax.toLocaleString()}\n💵 *Terima Bersih: Rp ${netRevenue.toLocaleString()}*\n\n📊 P/L: ${status} Rp ${profit.toLocaleString()} (${profitPercent}%)`);
    }

    // 4. CEK PORTFOLIO (!porto)
    if (command === 'porto' || command === 'pf') {
        let txt = `💼 *PORTOFOLIO SAHAM* 💼\n`;
        let totalAssetVal = 0;
        let totalProfit = 0;
        let hasStock = false;

        // Cek Pajak Estimasi untuk Display
        let estTaxRate = 0.05;
        if (user.balance > 100_000_000_000_000) estTaxRate = 0.50;
        else if (user.balance > 10_000_000_000_000) estTaxRate = 0.20;

        for (let [ticker, data] of Object.entries(user.portfolio)) {
            if (data.qty > 0) {
                const { price: currentPrice } = getStockData(ticker); 
                
                const rawVal = currentPrice * data.qty;
                const estTax = rawVal * estTaxRate;
                const netVal = rawVal - estTax;

                const modal = data.avg * data.qty;
                const gain = netVal - modal;
                const gainPercent = ((gain / modal) * 100).toFixed(1);
                
                const icon = gain >= 0 ? '🟢' : '🔴';

                txt += `📜 *${ticker}* (${data.qty.toLocaleString()} Lbr)\n`;
                txt += `   Avg: Rp ${data.avg.toLocaleString()} | Now: Rp ${currentPrice.toLocaleString()}\n`;
                txt += `   ${icon} Est. P/L (Net): Rp ${gain.toLocaleString()} (${gainPercent}%)\n\n`;

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
        txt += `\n_(Nilai bersih setelah estimasi pajak ${(estTaxRate*100)}%)_`;

        return msg.reply(txt);
    }

    // 5. KLAIM DIVIDEN (!dividen)
    if (command === 'dividen' || command === 'claim') {
        const COOLDOWN = 3600000; // 1 Jam
        
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
