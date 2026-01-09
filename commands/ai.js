require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const { saveDB } = require('../helpers/database'); 

// Konfigurasi Client OpenRouter
const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    // API KEY HARDCODED (Sesuai request)
    apiKey: "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", 
    defaultHeaders: {
        "HTTP-Referer": "https://wa-bot.com",
        "X-Title": "Arya Bot Multi-Model",
    }
});

// SYSTEM PROMPT
const SYSTEM_PROMPT = `
The AI embodies a professional English instructor who blends modern, Gen Z awareness with clear, structured teaching. 
It maintains a composed, confident tone while delivering direct, no-nonsense feedback. 
The AI focuses on helping the user improve practical English skills—speaking, writing, vocabulary, grammar, and real-life usage. 
It corrects mistakes immediately, explains the “why,” and provides improved versions without being overly soft. 
It encourages the user to think critically and stay consistent. The AI keeps the learning atmosphere chill, constructive, and forward-looking.
`;

// --- DAFTAR MODEL (SESUAI REQUEST) ---
const tier0 = [ "google/gemini-2.5-flash", "deepseek/deepseek-v3.2", "anthropic/claude-sonnet-4.5", "x-ai/grok-code-fast-1", "x-ai/grok-4.1-fast" ];
const tier1 = [ "google/gemini-2.0-flash-lite-preview-02-05:free", "google/gemini-2.0-pro-exp-02-05:free", "deepseek/deepseek-r1:free", "deepseek/deepseek-v3:free", "meta-llama/llama-3.3-70b-instruct:free", "qwen/qwen-2.5-72b-instruct:free" ];
const tier2 = [ "gryphe/mythomax-l2-13b:free", "sophosympatheia/midnight-rose-70b:free", "nousresearch/hermes-3-llama-3.1-405b:free" ];
const tier3 = [ "deepseek/deepseek-r1-distill-llama-70b:free", "nvidia/llama-3.1-nemotron-70b-instruct:free", "mistralai/mistral-nemo:free", "microsoft/phi-3-medium-128k-instruct:free" ];

// GABUNGAN SEMUA MODEL (Untuk cadangan)
const ALL_MODELS = [...tier0, ...tier1, ...tier2, ...tier3];

module.exports = async (command, args, msg, user, db) => {
    // Validasi command
    const validCommands = ['ask', 'ai', 'tanya', 'ai0', 'ai1', 'ai2', 'ai3', 'sharechat', 'history'];
    if (!validCommands.includes(command)) return;

    // --- FITUR 1: SHARE CHAT / HISTORY ---
    if (command === 'sharechat' || command === 'history') {
        if (!user.aiFullHistory || user.aiFullHistory.length === 0) {
            return msg.reply("❌ *Belum ada riwayat chat!* Ngobrol dulu dong sama Algojo.");
        }

        await msg.reply("⏳ *Sedang menyusun riwayat chat & membuat link...*");

        let historyText = `=== RIWAYAT CHAT: ${user.name || msg.pushName} ===\n`;
        historyText += `Total Pesan: ${user.aiFullHistory.length}\n`;
        historyText += `Dibuat pada: ${new Date().toLocaleString("id-ID")}\n`;
        historyText += `==========================================\n\n`;

        user.aiFullHistory.forEach((chat) => {
            const sender = chat.role === 'user' ? '👤 USER' : '🤖 BOT';
            const time = chat.date || '-';
            const model = chat.model ? `[${chat.model}]` : '';
            historyText += `${sender} (${time}) ${model}\n${chat.content}\n------------------------------------------\n`;
        });

        try {
            const response = await axios.post('https://paste.rs', historyText, { headers: { 'Content-Type': 'text/plain' } });
            return msg.reply(`✅ *Sukses! Ini link riwayat chat kamu:*\n\n🔗 ${response.data.trim()}\n\n_Klik link di atas untuk membaca semua kenangan kita._ 📂`);
        } catch (error) {
            console.error("Gagal upload:", error);
            return msg.reply("❌ Gagal membuat link (Server Paste.rs error).");
        }
    }

    // --- FITUR 2: AI CHAT ---
    const userPrompt = args.join(' ');
    if (!userPrompt) return msg.reply(`🤖 *Format salah.*\n\nContoh:\n!ai1 Apa itu simple present tense?\n!sharechat (Untuk lihat history)`);

    // LOGIKA PENENTUAN URUTAN MODEL (PRIORITY + FAILOVER)
    let priorityList = [];
    let modeName = "";

    if (command === 'ai0') { priorityList = tier0; modeName = "💎 Algojo (Priority)"; }
    else if (command === 'ai1') { priorityList = tier1; modeName = "🧠 Algojo (Smart)"; }
    else if (command === 'ai2') { priorityList = tier2; modeName = "🎭 Algojo (Roleplay)"; }
    else if (command === 'ai3') { priorityList = tier3; modeName = "⚡ Algojo (Cepat)"; }
    else { 
        // Default (!ai / !ask) -> Mulai dari Tier 1 (Gratis Pintar) baru ke yang lain
        priorityList = tier1; 
        modeName = "🤖 Algojo AI"; 
    }

    // 🔥 PENTING: GABUNGKAN LIST (Priority Dulu, Baru Sisanya)
    // Set digunakan untuk menghapus duplikat jika ada model yang sama
    const finalTargetList = [...new Set([...priorityList, ...ALL_MODELS])];

    await msg.reply(`*${modeName} sedang berpikir...*`);
    await msg.react('⏳');

    if (!user.aiMemory) user.aiMemory = [];
    if (!user.aiFullHistory) user.aiFullHistory = [];

    const messagesToSend = [
        { role: "system", content: SYSTEM_PROMPT },
        ...user.aiMemory,
        { role: "user", content: userPrompt }
    ];

    let success = false;
    let lastError = "";

    // Loop Semua Model (Sampai Berhasil)
    for (const modelId of finalTargetList) {
        try {
            // Log supaya kamu tau dia lagi nyoba siapa
            console.log(`🔄 Mencoba model: ${modelId}...`);
            
            const completion = await client.chat.completions.create({
                messages: messagesToSend,
                model: modelId,
            });

            const answer = completion.choices[0].message.content;
            const timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

            // Simpan Memory
            user.aiMemory.push({ role: "user", content: userPrompt });
            user.aiMemory.push({ role: "assistant", content: answer });
            if (user.aiMemory.length > 20) user.aiMemory = user.aiMemory.slice(-20);

            // Simpan Archive
            user.aiFullHistory.push({ role: "user", content: userPrompt, date: timestamp });
            user.aiFullHistory.push({ role: "assistant", content: answer, date: timestamp, model: modelId });

            saveDB(db);

            await msg.reply(`*${modeName}:* \n\n${answer}\n\n_`);
            await msg.react('✅');
            
            success = true;
            console.log(`✅ SUKSES pakai model: ${modelId}`);
            break; // BERHENTI LOOP KARENA SUDAH SUKSES

        } catch (error) {
            // Cek error, kalau 404/400/429 lanjut aja
            console.log(`⚠️ Gagal ${modelId}: ${error.status || 'Error'} - ${error.message}`);
            lastError = error.message;
            continue; // LANJUT KE MODEL BERIKUTNYA
        }
    }

    if (!success) {
        await msg.reply(`❌ *Gagal Total.* Saya sudah mencoba ${finalTargetList.length} model tapi semuanya sibuk/error.\n\n⚠️ Error Terakhir: ${lastError}`);
        await msg.react('❌');
    }
};