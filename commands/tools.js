const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { saveDB, addQuestProgress } = require('../helpers/database');
const fs = require('fs-extra');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg'); // ✅ FIX 1: Pakai Installer Otomatis

// ✅ FIX 2: Set Path agar jalan di Windows & Linux (Hosting)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

module.exports = async (command, args, msg, user, db, chat) => {
    
    // Ambil ID Chat lawan bicara
    const jid = msg.key.remoteJid; 

    // --- FITUR 2: STICKER ---
    if (command === "s" || command === "sticker") {
        try {
            const isQuotedImage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            const isImage = msg.message.imageMessage;
            const isVideo = msg.message.videoMessage || msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;

            if (isImage || isQuotedImage || isVideo) {
                // 1. Download Media
                let buffer;
                let isVid = false;
                
                // Cek apakah user mereply pesan atau kirim langsung
                if (isQuotedImage || (isVideo && msg.message.extendedTextMessage?.contextInfo?.quotedMessage)) {
                     buffer = await downloadMediaMessage(
                        {
                            key: msg.message.extendedTextMessage.contextInfo.stanzaId,
                            message: msg.message.extendedTextMessage.contextInfo.quotedMessage
                        },
                        'buffer', {}, { logger: console }
                    );
                    if (isVideo) isVid = true;
                } else {
                    buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: console });
                    if (isVideo) isVid = true;
                }

                // 2. Simpan File Sementara
                const time = Date.now();
                const ext = isVid ? 'mp4' : 'jpg'; 
                const tempInput = path.join(__dirname, `../temp/input_${time}.${ext}`);
                const tempOutput = path.join(__dirname, `../temp/output_${time}.webp`);

                await fs.ensureDir(path.join(__dirname, '../temp'));
                await fs.writeFile(tempInput, buffer);

                // 3. Konversi pakai FFmpeg
                msg.reply("⏳ Membuat stiker...");
                
                await new Promise((resolve, reject) => {
                    const commandFfmpeg = ffmpeg(tempInput)
                        .on('error', (err) => {
                            console.error('FFmpeg Error:', err);
                            reject(err);
                        })
                        .on('end', () => resolve());

                    if (isVid) {
                        commandFfmpeg.inputFormat('mp4');
                        // Batasi durasi dan frame rate biar ga berat
                        commandFfmpeg.duration(5); 
                        commandFfmpeg.fps(15);
                    } 

                    // ✅ FIX 3: Perbaikan Filter Scale yang Error (Typo kutip)
                    commandFfmpeg.addOutputOptions([
                        `-vcodec`, `libwebp`,
                        `-vf`, `scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`,
                        `-loop`, `0`,
                        `-ss`, `00:00:00.0`,
                        `-t`, `00:00:05.0`,
                        `-preset`, `default`,
                        `-an`,
                        `-vsync`, `0`
                    ])
                    .toFormat('webp')
                    .save(tempOutput);
                });

                // 4. Kirim Stiker (✅ FIX: Tambah JID)
                const stickerBuffer = await fs.readFile(tempOutput);
                await chat.sendMessage(jid, { sticker: stickerBuffer }, { quoted: msg });

                // Bersihkan file sampah
                fs.unlinkSync(tempInput);
                fs.unlinkSync(tempOutput);

                // Update Quest
                const qNotif = addQuestProgress(user, "sticker");
                if (qNotif) msg.reply(qNotif);
                saveDB(db);

            } else {
                msg.reply("📸 Balas foto/video atau kirim foto dengan caption *!s*");
            }

        } catch (err) {
            console.error("Sticker Error:", err);
            msg.reply("❌ Gagal. Pastikan file tidak rusak atau durasi video terlalu panjang.");
        }
    }

    // --- FITUR 3: TOIMG (Ubah Stiker jadi Gambar) ---
    if (command === "toimg") {
        try {
            const isQuotedSticker = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
            
            if (isQuotedSticker) {
                msg.reply("⏳ Mengubah stiker ke gambar...");

                // 1. Download Stiker (WebP)
                const buffer = await downloadMediaMessage(
                    {
                        key: msg.message.extendedTextMessage.contextInfo.stanzaId,
                        message: msg.message.extendedTextMessage.contextInfo.quotedMessage
                    },
                    'buffer', {}, { logger: console }
                );

                // 2. Simpan File Sementara
                const time = Date.now();
                const tempInput = path.join(__dirname, `../temp/sticker_${time}.webp`);
                const tempOutput = path.join(__dirname, `../temp/image_${time}.png`);

                await fs.ensureDir(path.join(__dirname, '../temp'));
                await fs.writeFile(tempInput, buffer);

                // 3. Konversi WebP -> PNG pakai FFmpeg
                await new Promise((resolve, reject) => {
                    ffmpeg(tempInput)
                        .on('error', (err) => {
                            console.error('ToImg Error:', err);
                            reject(err);
                        })
                        .on('end', () => resolve())
                        .outputOptions([
                            '-vframes 1', // Ambil 1 frame saja
                            '-vcodec png' // Format PNG
                        ])
                        .save(tempOutput);
                });

                // 4. Kirim Gambar (✅ FIX: Tambah JID)
                const imgBuffer = await fs.readFile(tempOutput);
                await chat.sendMessage(jid, { image: imgBuffer, caption: "🖼️ Ini gambarnya!" }, { quoted: msg });

                // Bersihkan
                fs.unlinkSync(tempInput);
                fs.unlinkSync(tempOutput);
                
            } else {
                msg.reply("⚠️ Balas stiker dengan perintah *!toimg*");
            }
        } catch (err) {
            console.error("ToImg Error:", err);
            msg.reply("❌ Gagal. Stiker tidak bisa dikonversi.");
        }
    }

    // --- FITUR 4: YTMP3 ---
    if (command === "ytmp3") {
        const url = args[0];
        if (!url) return msg.reply("❌ Masukkan URL YouTube!");
        msg.reply("⏳ Sedang memproses audio...");

        try {
            // API Wuk.sh (Public API - Bisa down sewaktu-waktu)
            const response = await axios.post("https://co.wuk.sh/api/json", {
                url: url, aFormat: "mp3", isAudioOnly: true
            }, { 
                headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }
            });

            if (response.data && response.data.url) {
                // ✅ FIX: Tambah JID & Quoted
                await chat.sendMessage(jid, { 
                    audio: { url: response.data.url }, 
                    mimetype: 'audio/mp4',
                    fileName: 'lagu.mp3'
                }, { quoted: msg });
                
                msg.reply("✅ *Download Berhasil!*");
            } else {
                msg.reply("❌ Gagal mendapatkan link (API Error).");
            }
        } catch (err) {
            console.error("YT API Error:", err.message);
            msg.reply("❌ Gagal. Pastikan link valid atau coba beberapa saat lagi.");
        }
    }
};