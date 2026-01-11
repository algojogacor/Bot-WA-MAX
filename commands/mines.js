const { saveDB } = require('../helpers/database');

// Session sementara untuk menyimpan state permainan
// Format: { 'id_user': { bet: 100000, multiplier: 1, opened: [], bombs: [3, 7, 9], grid: 12 } }
const sessions = {};

module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['mines', 'bom', 'gali', 'open', 'stop', 'cashout', 'nyerah'];
    if (!validCommands.includes(command)) return;

    const senderId = msg.author || msg.key.remoteJid;

    // 1. MULAI GAME (!bom <taruhan>)
    if (command === 'mines' || command === 'bom') {
        if (sessions[senderId]) {
            return msg.reply("❌ Kamu masih punya sesi permainan aktif!\nKetik `!gali <angka>` atau `!stop`.");
        }

        const bet = parseInt(args[0]);
        if (isNaN(bet) || bet < 1000) return msg.reply("❌ Minimal taruhan 💰1.000");
        if (user.balance < bet) return msg.reply("❌ Uang kurang bos!");

        // Kurangi saldo di awal (Biar gak kabur kalau kalah)
        user.balance -= bet;
        saveDB(db);

        // Generate Posisi Bom (3 Bom dari 12 Kotak)
        const bombs = [];
        while (bombs.length < 3) {
            const r = Math.floor(Math.random() * 12) + 1;
            if (!bombs.includes(r)) bombs.push(r);
        }

        // Simpan Sesi
        sessions[senderId] = {
            bet: bet,
            currentWin: bet, // Awalnya sama dengan taruhan
            multiplier: 1.0,
            opened: [],
            bombs: bombs
        };

        let txt = `💣 *TEBAK BOM DIMULAI* 💣\n`;
        txt += `💰 Taruhan: Rp ${bet.toLocaleString('id-ID')}\n\n`;
        txt += `📦 *PILIH KOTAK (1-12)*:\n`;
        txt += `[1] [2] [3] [4]\n[5] [6] [7] [8]\n[9] [10] [11] [12]\n\n`;
        txt += `⚠️ Ada *3 BOM* tersembunyi.\n`;
        txt += `⛏️ Ketik: \`!gali <angka>\` untuk buka kotak.\n`;
        txt += `🛑 Ketik: \`!stop\` untuk ambil uang sekarang.`;

        return msg.reply(txt);
    }

    // Cek apakah user punya sesi
    const ses = sessions[senderId];
    if (!ses) return msg.reply("❌ Kamu belum main. Ketik `!bom <jumlah>` dulu.");

    // 2. GALI KOTAK (!gali <angka>)
    if (command === 'gali' || command === 'open') {
        const pick = parseInt(args[0]);
        if (isNaN(pick) || pick < 1 || pick > 12) return msg.reply("❌ Pilih angka 1 sampai 12.");
        if (ses.opened.includes(pick)) return msg.reply("❌ Kotak ini sudah dibuka.");

        // CEK APAKAH KENA BOM?
        if (ses.bombs.includes(pick)) {
            // DUAR!!! MELEDAK
            delete sessions[senderId]; // Hapus sesi
            // Uang taruhan sudah diambil di awal, jadi tidak perlu dikurangi lagi.
            // Cukup kasih tau kalau hangus.
            
            let txt = `💥 *BOOOOM!!!* 💥\n`;
            txt += `Kamu menggali kotak *${pick}* dan terkena BOM!\n\n`;
            txt += `💸 Uang Taruhan: Rp ${ses.bet.toLocaleString('id-ID')} *HANGUS*.\n`;
            txt += `💣 Lokasi Bom: ${ses.bombs.join(', ')}\n`;
            txt += `_Jangan serakah makanya..._ 💀`;
            
            return msg.reply(txt);
        } else {
            // AMAN - LANJUT
            ses.opened.push(pick);
            
            // Rumus Multiplier: Makin banyak buka, makin gede
            // 1 kotak: 1.2x, 2 kotak: 1.5x, dst.
            const totalOpened = ses.opened.length;
            let multi = 1.0;
            if (totalOpened === 1) multi = 1.3;
            else if (totalOpened === 2) multi = 1.6;
            else if (totalOpened === 3) multi = 2.0;
            else if (totalOpened === 4) multi = 2.5;
            else if (totalOpened === 5) multi = 3.2;
            else if (totalOpened === 6) multi = 4.0;
            else if (totalOpened >= 7) multi = 5.0 + (totalOpened - 6); // Gila-gilaan

            ses.multiplier = multi;
            ses.currentWin = Math.floor(ses.bet * multi);

            // Tampilan Grid
            let grid = "";
            for (let i = 1; i <= 12; i++) {
                if (ses.opened.includes(i)) grid += "[✅] ";
                else grid += `[${i}] `;
                if (i % 4 === 0) grid += "\n";
            }

            let txt = `✅ *AMAN!* (x${multi.toFixed(1)})\n\n`;
            txt += grid + "\n";
            txt += `💰 Uang Sekarang: *Rp ${ses.currentWin.toLocaleString('id-ID')}*\n`;
            txt += `⛏️ Lanjut gali? Ketik \`!gali <angka>\`\n`;
            txt += `🛑 Takut meledak? Ketik \`!stop\``;

            // Update sesi di memory (gak perlu saveDB karena cuma temporary)
            sessions[senderId] = ses;
            return msg.reply(txt);
        }
    }

    // 3. STOP / AMBIL DUIT (!stop)
    if (command === 'stop' || command === 'cashout' || command === 'nyerah') {
        if (ses.opened.length === 0) return msg.reply("❌ Belum gali satupun kok udah nyerah? Minimal gali 1 kotak.");

        // Masukkan uang kemenangan ke saldo
        user.balance += ses.currentWin;
        saveDB(db);
        
        // Hapus sesi
        delete sessions[senderId];

        let txt = `🛑 *CASHOUT BERHASIL* 🛑\n\n`;
        txt += `Mental tempe! Tapi selamat, kamu cari aman.\n`;
        txt += `💰 Total Dapat: *Rp ${ses.currentWin.toLocaleString('id-ID')}*\n`;
        txt += `📈 Profit Bersih: Rp ${(ses.currentWin - ses.bet).toLocaleString('id-ID')}`;

        return msg.reply(txt);
    }
};
