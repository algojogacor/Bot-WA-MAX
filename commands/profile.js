const { saveDB } = require('../helpers/database');

// Simulasi harga crypto (Bisa diupdate real-time kalau mau canggih nanti)
const cryptoPrices = {
    btc: 1, // 1.5 Milyar
    eth: 1,
    sol: 1,
    doge: 1,
    bnb: 1
};

module.exports = async (command, args, msg, user, db, chat, sock) => {
    const today = new Date().toISOString().split("T")[0];

    // Helper: Title System
    const getTitle = (lvl) => {
        if (lvl >= 100) return "🐲 Dragon Slayer";
        if (lvl >= 50) return "👑 Crypto King";
        if (lvl >= 30) return "🧛 Lord";
        if (lvl >= 20) return "⚔️ Commander";
        if (lvl >= 10) return "🛡️ Warrior";
        if (lvl >= 5) return "🗡️ Soldier";
        return "🥚 Newbie";
    };

    // Helper: Amanin Angka (Biar ga NaN)
    const safeInt = (val) => isNaN(Number(val)) ? 0 : Number(val);

    // ==================================================================
    // 1. PROFILE USER (!me, !profile)
    // ==================================================================
    if (command === "me" || command === "profile" || command === "level" || command === "status") {
        
        // 1. Cek Buff Aktif
        let buffList = [];
        if (user.buffs) {
            if (user.buffs.xp?.active) buffList.push("⚡ XP Boost");
            if (user.buffs.gacha?.active) buffList.push("🍀 Luck Charm");
        }

        // 2. Hitung Aset Crypto (Aman dari NaN)
        let cryptoValue = 0;
        if (user.crypto) {
            for (let [coin, amount] of Object.entries(user.crypto)) {
                const price = cryptoPrices[coin.toLowerCase()] || 0;
                cryptoValue += safeInt(amount) * price;
            }
        }

        const balance = safeInt(user.balance);
        const bank = safeInt(user.bank);
        const totalNetWorth = balance + bank + cryptoValue;
        
        // 3. Info Level
        const currentLevel = safeInt(user.level) || 1;
        const currentXP = safeInt(user.xp);
        const xpToNextLevel = currentLevel * 100;
        
        // 4. Nama (Ambil dari PushName atau User DB)
        const name = user.name || msg.pushName || "Warga Sipil";

        return msg.reply(
`👤 *IDENTITAS PENGGUNA*
━━━━━━━━━━━━━━━━━
🏷️ Nama: *${name}*
🎖️ Title: *${getTitle(currentLevel)}*
⭐ Level: *${currentLevel}*
✨ XP: *${Math.floor(currentXP)} / ${xpToNextLevel}*
━━━━━━━━━━━━━━━━━
💵 Dompet: Rp ${Math.floor(balance).toLocaleString('id-ID')}
🏦 Bank: Rp ${Math.floor(bank).toLocaleString('id-ID')}
📈 Aset Crypto: Rp ${Math.floor(cryptoValue).toLocaleString('id-ID')}
💰 *Total Kekayaan: Rp ${Math.floor(totalNetWorth).toLocaleString('id-ID')}*
━━━━━━━━━━━━━━━━━
🎒 Isi Tas: *${user.inv ? user.inv.length : 0}* Item
💊 Buff: ${buffList.length > 0 ? buffList.join(", ") : "_Tidak ada_"}
━━━━━━━━━━━━━━━━━
_Ketik !quest untuk melihat misi harian!_`
        );
    }

    // ==================================================================
    // 2. LEADERBOARD (!rank / !top)
    // ==================================================================
    if (command === "rank" || command === "leaderboard" || command === "top") {
        
        let targetIds = [];
        let titleHeader = "";

        try {
            // A. Tentukan Siapa yang Mau Diranking
            if (chat.isGroup) {
                // Versi Grup: Ambil Metadata Grup
                // Kita butuh 'sock' di sini. Pastikan di index.js kamu kirim sock!
                if (!sock) return msg.reply("❌ Error Sistem: Socket tidak terdeteksi di command profile.");
                
                const metadata = await sock.groupMetadata(chat.id._serialized);
                targetIds = metadata.participants.map(p => p.id);
                titleHeader = `🏆 *TOP SULTAN GRUP* 🏆\n_(Khusus Member Sini)_`;
            } else {
                // Versi Japri: Global Rank
                targetIds = Object.keys(db.users);
                titleHeader = `🌍 *TOP SULTAN GLOBAL* 🏆\n_(Semua Server)_`;
            }

            // B. Filter & Hitung Kekayaan Semua Orang
            let allPlayers = targetIds
                .filter(id => db.users[id]) // Pastikan usernya ada di DB bot
                .map(id => {
                    const data = db.users[id];
                    
                    // Hitung Crypto Orang Lain
                    let cVal = 0;
                    if (data.crypto) {
                        for (let [c, amt] of Object.entries(data.crypto)) {
                            const p = cryptoPrices[c.toLowerCase()] || 0;
                            cVal += safeInt(amt) * p;
                        }
                    }

                    const netWorth = safeInt(data.balance) + safeInt(data.bank) + cVal;
                    
                    return {
                        id: id,
                        name: data.name || "Unknown", // Pakai nama tersimpan
                        level: safeInt(data.level) || 1,
                        netWorth: netWorth
                    };
                });

            // C. Urutkan (Terkaya di atas)
            allPlayers.sort((a, b) => b.netWorth - a.netWorth);

            // D. Ambil Top 10
            const top10 = allPlayers.slice(0, 10);
            
            let text = `${titleHeader}\n━━━━━━━━━━━━━━━━━\n`;
            
            if (top10.length === 0) {
                text += "_Belum ada data member yang main bot di sini._";
            } else {
                top10.forEach((u, i) => {
                    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
                    // Format ID: 628xxx@s.whatsapp.net -> @628xxx
                    const mentionId = `@${u.id.split('@')[0]}`;
                    
                    text += `${medal} ${mentionId}\n`;
                    text += `   └ Lv.${u.level} | Rp ${Math.floor(u.netWorth).toLocaleString('id-ID')}\n`;
                });
            }

            // E. Cari Posisi Sendiri
            const myRank = allPlayers.findIndex(u => u.id === (msg.author || msg.from));
            if (myRank !== -1) {
                text += `━━━━━━━━━━━━━━━━━\n👤 Posisi Kamu: #${myRank + 1}`;
            }

            // Kirim (Wajib Mentions array agar tag @user berwarna biru)
            // Cek apakah chat.sendMessage support mentions, kalau tidak pakai sock
            if (chat.sendMessage) {
                await chat.sendMessage({
                    text: text,
                    mentions: top10.map(u => u.id)
                });
            } else {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: text,
                    mentions: top10.map(u => u.id)
                }, { quoted: msg });
            }

        } catch (err) {
            console.error("Error Rank:", err);
            msg.reply("⚠️ Gagal mengambil data rank. Pastikan bot adalah Admin (untuk baca data member).");
        }
    }

    // ==================================================================
    // 3. DAFTAR QUEST (!quest)
    // ==================================================================
    if (command === "quest" || command === "misi") {
        if (!user.quest) return msg.reply("❌ Data quest rusak/belum ada.");

        let text = `📜 *PAPAN MISI HARIAN*\n📅 ${today}\n\n`;
        
        user.quest.daily.forEach(q => {
            const percent = Math.min(100, Math.floor((q.progress / q.target) * 100));
            const completedBlocks = Math.floor(percent / 10);
            const bar = '█'.repeat(completedBlocks) + '░'.repeat(10 - completedBlocks);
            
            const statusIcon = q.claimed ? "✅ Selesai" : (percent >= 100 ? "🎁 SIAP KLAIM" : "🔄 Proses");

            text += `🔹 *${q.name}* (${statusIcon})\n`;
            text += `   ${bar} ${percent}%\n`;
            text += `   Target: ${q.progress}/${q.target} | Reward: 💰${q.reward}\n\n`;
        });

        if (user.quest.weekly) {
            const w = user.quest.weekly;
            const wPercent = Math.min(100, Math.floor((w.progress / w.target) * 100));
            const wStatus = w.claimed ? "✅ Selesai" : (wPercent >= 100 ? "🎁 SIAP KLAIM" : "🔥 Mingguan");
            
            text += `🏆 *${w.name}* (${wStatus})\n`;
            text += `   Target: ${w.progress}/${w.target} | Reward: 💰${w.reward}\n`;
        }

        text += `\n💡 _Ketik *!claim* untuk mengambil hadiah!_`;
        return msg.reply(text);
    }

    // ==================================================================
    // 4. CLAIM HADIAH (!claim)
    // ==================================================================
    if (command === "claim") {
        if (!user.quest) return;

        let totalGift = 0;
        let totalXP = 0;
        let count = 0;
        const rewardList = [];

        user.quest.daily.forEach(q => {
            if (q.progress >= q.target && !q.claimed) {
                q.claimed = true;
                totalGift += q.reward;
                totalXP += 50; 
                count++;
                rewardList.push(q.name);
            }
        });

        const w = user.quest.weekly;
        if (w && w.progress >= w.target && !w.claimed) {
            w.claimed = true;
            totalGift += w.reward;
            totalXP += 500;
            count++;
            rewardList.push("🏆 Weekly Warrior");
        }

        if (count === 0) {
            return msg.reply("❌ Tidak ada misi yang siap diklaim.\nSelesaikan misi dulu atau cek *!quest*.");
        }

        user.balance = safeInt(user.balance) + totalGift;
        user.xp = safeInt(user.xp) + totalXP;
        saveDB(db);

        return msg.reply(`🎉 *KLAIM BERHASIL!*\n\n✅ Misi Selesai:\n- ${rewardList.join('\n- ')}\n\n🎁 Total Hadiah:\n💰 +Rp ${totalGift.toLocaleString('id-ID')}\n⚡ +${totalXP} XP`);
    }

    // ==================================================================
    // 5. INVENTORY (!inv)
    // ==================================================================
    if (command === "inv" || command === "inventory" || command === "tas") {
        if (!user.inv || user.inv.length === 0) return msg.reply("🎒 Tas kamu kosong melompong.\nBelanja dulu di *!shop*");
        
        const counts = {};
        user.inv.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
        
        let list = `🎒 *ISI TAS PETUALANG*\n━━━━━━━━━━━━━━━━━\n`;
        Object.keys(counts).forEach((item, i) => {
            list += `${i + 1}. *${item.toUpperCase()}* (x${counts[item]})\n`;
        });

        return msg.reply(list);
    }
};