const { saveDB } = require('../helpers/database');

// --- KONFIGURASI HARGA (SULTAN TIER) ---
const CONFIG = {
    FOUNDING_COST: 5_000_000_000, // 5 Miliar (Entry Ticket)
    SOLDIER_COST: 50_000_000,     // 50 Juta per tentara (Mahal!)
    BASE_TAX: 100_000,            // Pajak per kepala naik jadi 100rb
    
    // Gedung & Efeknya (Harga Naik Drastis)
    BUILDINGS: {
        'bank':   { name: "Bank Sentral", cost: 10_000_000_000, desc: "Pajak +10%" }, // 10 Miliar
        'benteng':{ name: "Benteng Pertahanan", cost: 25_000_000_000, desc: "Defense +20%" }, // 25 Miliar
        'rs':     { name: "Rumah Sakit", cost: 5_000_000_000, desc: "Populasi tumbuh cepat" } // 5 Miliar
    }
};

module.exports = async (command, args, msg, user, db) => {
    // Hapus command 'spionase' dari daftar valid
    const validCommands = ['negara', 'nation', 'buatnegara', 'bangun', 'build', 'rekrut', 'pajaknegara', 'korupsi', 'subsidi', 'serang', 'war'];
    if (!validCommands.includes(command)) return;

    if (!db.nations) db.nations = {};
    const senderId = msg.author || msg.key.participant || msg.key.remoteJid;

    // --- HELPER: MIGRASI DATA LAMA ---
    if (db.nations[senderId]) {
        const n = db.nations[senderId];
        if (!n.buildings) n.buildings = { bank: 0, benteng: 0, rs: 0 };
        if (typeof n.stability === 'undefined') n.stability = 100;
        if (typeof n.networth === 'undefined') n.networth = 0;
    }

    // 1. DASHBOARD NEGARA (!negara)
    if (command === 'negara' || command === 'nation') {
        const nation = db.nations[senderId];

        if (!nation) {
            return msg.reply(`❌ Kamu belum punya negara.\nKetik \`!buatnegara <nama>\` (Biaya: Rp ${CONFIG.FOUNDING_COST.toLocaleString()})`);
        }

        const taxBonus = (nation.buildings.bank * 10);
        const defBonus = (nation.buildings.benteng * 20);
        
        let status = "🟢 Stabil";
        if (nation.stability < 50) status = "⚠️ Rusuh";
        if (nation.stability < 20) status = "🔥 ANARKI";

        let txt = `🏳️ *REPUBLIK ${nation.name.toUpperCase()}* 🏳️\n`;
        txt += `👤 Presiden: ${msg.pushName}\n`;
        txt += `📊 Stabilitas: ${nation.stability}% (${status})\n`;
        txt += `👥 Penduduk: ${nation.population.toLocaleString()} Jiwa\n`;
        txt += `💰 Kas Negara: Rp ${nation.treasury.toLocaleString()}\n`;
        txt += `⚔️ Militer: ${nation.defense.toLocaleString()} Personil\n\n`;

        txt += `🏗️ *INFRASTRUKTUR:*\n`;
        txt += `🏦 Bank (Lv.${nation.buildings.bank}): Pajak +${taxBonus}%\n`;
        txt += `🏰 Benteng (Lv.${nation.buildings.benteng}): Def +${defBonus}%\n`;
        txt += `🏥 RS (Lv.${nation.buildings.rs}): Pertumbuhan Penduduk ++\n\n`;

        txt += `⚙️ *COMMANDS:*\n`;
        txt += `• \`!pajaknegara\` | \`!rekrut <jml>\`\n`;
        txt += `• \`!bangun <tipe>\` (bank/benteng/rs)\n`;
        txt += `• \`!subsidi <jml>\` (Masuk Kas)\n`;
        txt += `• \`!korupsi <jml>\` (Ambil Kas)\n`;
        txt += `• \`!serang @target\` (War)`; // Spionase dihapus dari menu

        return msg.reply(txt);
    }

    // 2. BUAT NEGARA (!buatnegara)
    if (command === 'buatnegara') {
        if (db.nations[senderId]) return msg.reply("❌ Satu akun satu negara, Pak Presiden.");
        if (user.balance < CONFIG.FOUNDING_COST) return msg.reply(`❌ Modal kurang! Butuh Rp ${CONFIG.FOUNDING_COST.toLocaleString()} untuk mendirikan negara.`);
        
        const name = args.join(" ");
        if (!name) return msg.reply("❌ Nama negaranya apa?");

        user.balance -= CONFIG.FOUNDING_COST;
        db.nations[senderId] = {
            name: name,
            population: 1000, // Start 1000 rakyat
            defense: 50,      // Start 50 tentara
            treasury: 1_000_000_000, // Kas awal 1M (biar gak miskin banget)
            stability: 100,
            lastTax: 0,
            buildings: { bank: 0, benteng: 0, rs: 0 }
        };
        saveDB(db);
        return msg.reply(`🎉 Negara *${name}* berhasil didirikan!\nBiaya Rp ${CONFIG.FOUNDING_COST.toLocaleString()} telah dibayar.`);
    }

    // --- COMMAND KHUSUS PRESIDEN ---
    const nation = db.nations[senderId];
    if (!nation) return msg.reply("❌ Kamu belum punya negara.");

    // 3. BANGUN INFRASTRUKTUR (!bangun <tipe>)
    if (command === 'bangun' || command === 'build') {
        const type = args[0]?.toLowerCase();
        const building = CONFIG.BUILDINGS[type];

        if (!building) {
            return msg.reply(`❌ Tipe bangunan salah!\nPilih: \`bank\`, \`benteng\`, \`rs\`\n\n🏦 *Bank*: Rp 10 M (Naikkan Pajak)\n🏰 *Benteng*: Rp 25 M (Pertahanan)\n🏥 *RS*: Rp 5 M (Populasi)`);
        }

        if (nation.treasury < building.cost) {
            return msg.reply(`❌ Kas Negara kurang! Butuh Rp ${building.cost.toLocaleString()}.`);
        }

        nation.treasury -= building.cost;
        nation.buildings[type] += 1;
        saveDB(db);

        return msg.reply(`🏗️ *PEMBANGUNAN SUKSES*\n${building.name} naik ke Level ${nation.buildings[type]}.\nBiaya: Rp ${building.cost.toLocaleString()} diambil dari Kas.`);
    }

    // 4. KEUANGAN: SUBSIDI & KORUPSI
    if (command === 'subsidi') { // Dompet -> Kas
        let amount = parseInt(args[0]);
        if (args[0] === 'all') amount = user.balance;
        if (isNaN(amount) || amount < 1000) return msg.reply("❌ Nominal salah.");
        if (user.balance < amount) return msg.reply("❌ Uang pribadi kurang.");

        user.balance -= amount;
        nation.treasury += amount;
        
        if (nation.stability < 100) nation.stability += 5;
        if (nation.stability > 100) nation.stability = 100;

        saveDB(db);
        return msg.reply(`💸 *SUBSIDI NEGARA*\nKamu menyumbang Rp ${amount.toLocaleString()} ke Kas Negara.\nStabilitas Rakyat: ${nation.stability}%`);
    }

    if (command === 'korupsi') { // Kas -> Dompet
        let amount = parseInt(args[0]);
        if (args[0] === 'all') amount = nation.treasury;
        if (isNaN(amount) || amount < 1000) return msg.reply("❌ Nominal salah.");
        if (nation.treasury < amount) return msg.reply("❌ Kas negara kosong.");

        nation.treasury -= amount;
        user.balance += amount;

        const drop = Math.floor(Math.random() * 10) + 5; // Turun 5-15%
        nation.stability -= drop;

        saveDB(db);
        
        let txt = `😈 *KORUPSI BERHASIL*\nKamu mencuri Rp ${amount.toLocaleString()} dari rakyat.\n📉 Stabilitas: -${drop}% (Sisa: ${nation.stability}%)\n`;
        
        if (nation.stability <= 0) {
            delete db.nations[senderId];
            txt += `\n🔥 *REVOLUSI RAKYAT PECAH!* 🔥\nNegara hancur digulingkan massa.`;
        }
        return msg.reply(txt);
    }

    // 5. PAJAK & REKRUT
    if (command === 'pajaknegara') {
        const now = Date.now();
        const cooldown = 60 * 60 * 1000; 
        if (now - nation.lastTax < cooldown) return msg.reply("⏳ Sabar, rakyat baru bayar pajak.");

        const baseIncome = nation.population * CONFIG.BASE_TAX;
        const multiplier = 1 + (nation.buildings.bank * 0.1); 
        const totalIncome = Math.floor(baseIncome * multiplier);

        const growthRate = 0.05 + (nation.buildings.rs * 0.02); 
        const newPop = Math.floor(nation.population * growthRate);

        nation.treasury += totalIncome;
        nation.population += newPop;
        nation.lastTax = now;
        saveDB(db);

        return msg.reply(`💰 *PENDAPATAN NEGARA*\nPajak Terkumpul: Rp ${totalIncome.toLocaleString()}\nBonus Bank: x${multiplier.toFixed(1)}\nPopulasi Baru: +${newPop} Jiwa`);
    }

    if (command === 'rekrut') {
        const qty = parseInt(args[0]);
        if (isNaN(qty) || qty < 1) return msg.reply("❌ Jumlah salah.");
        
        const cost = qty * CONFIG.SOLDIER_COST;
        if (nation.treasury < cost) return msg.reply(`❌ Kas kurang Rp ${cost.toLocaleString()}.\n(Harga: 50 Juta per tentara)`);

        nation.treasury -= cost;
        nation.defense += qty;
        saveDB(db);
        return msg.reply(`🛡️ Merekrut ${qty} Pasukan. Total: ${nation.defense}`);
    }

    // 6. PERANG / WAR (!serang)
    // SPIONASE DIHAPUS - JADI SERANGAN BUTA
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetId = mentions[0];

    if (command === 'serang' || command === 'war') {
        if (!targetId) return msg.reply("❌ Tag negara yang mau diserang!");
        if (targetId === senderId) return msg.reply("❌ Stress?");

        const enemy = db.nations[targetId];
        if (!enemy) return msg.reply("❌ Target tidak punya negara.");

        // HITUNG KEKUATAN
        const myBonus = 1 + (nation.buildings.benteng * 0.2); 
        const myPower = (nation.defense * myBonus) * (Math.random() * 0.4 + 0.8);

        const enemyDefBonus = 1 + (enemy.buildings.benteng * 0.5); 
        const enemyPower = (enemy.defense * enemyDefBonus) * (Math.random() * 0.4 + 0.8);

        let txt = `⚔️ *WAR REPORT* ⚔️\n`;
        txt += `🚩 ${nation.name} vs 🏴 ${enemy.name}\n`;
        txt += `_(Intelijen tidak tersedia, ini serangan buta!)_\n\n`;

        if (myPower > enemyPower) {
            // MENANG
            const loot = Math.floor(enemy.treasury * 0.5); 
            const kill = Math.floor(enemy.population * 0.15); 
            
            enemy.treasury -= loot;
            nation.treasury += loot;
            enemy.population -= kill;
            
            // Hancurkan Infrastruktur Musuh (Peluang 30%)
            if (Math.random() < 0.3 && enemy.buildings.bank > 0) {
                enemy.buildings.bank -= 1;
                txt += `💣 *BOOM!* Rudal kita menghancurkan 1 level Bank musuh!\n`;
            }

            enemy.stability -= 20;

            const myLoss = Math.floor(nation.defense * 0.1);
            const enemyLoss = Math.floor(enemy.defense * 0.4);
            nation.defense -= myLoss;
            enemy.defense -= enemyLoss;

            txt += `🏆 *KEMENANGAN TELAK!*\n`;
            txt += `💰 Menjarah: Rp ${loot.toLocaleString()}\n`;
            txt += `💀 Membunuh: ${kill} Rakyat\n`;
            txt += `📉 Musuh kehilangan ${enemyLoss} Tentara.\n`;

        } else {
            // KALAH
            const loss = Math.floor(nation.treasury * 0.1); 
            nation.treasury -= loss;
            
            const myLoss = Math.floor(nation.defense * 0.4); // Rugi banyak
            const enemyLoss = Math.floor(enemy.defense * 0.1);
            nation.defense -= myLoss;
            enemy.defense -= enemyLoss;
            
            nation.stability -= 10;

            txt += `🏳️ *SERANGAN GAGAL!*\n`;
            txt += `Pertahanan musuh terlalu kuat!\n`;
            txt += `📉 Kita kehilangan ${myLoss} Tentara.\n`;
            txt += `💸 Rugi Logistik: Rp ${loss.toLocaleString()}`;
        }
        
        // Validasi minus
        if (enemy.stability < 0) enemy.stability = 0;
        if (nation.stability < 0) nation.stability = 0;
        if (nation.defense < 0) nation.defense = 0;
        if (enemy.defense < 0) enemy.defense = 0;

        saveDB(db);
        return msg.reply(txt, null, { mentions: [targetId] });
    }
};
