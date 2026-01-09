require('dotenv').config();
const couchbase = require('couchbase');

// Konfigurasi Cluster (Sesuaikan dengan kredensial kamu)
const clusterConnStr = 'couchbases://cb.1t0wwbqqav1skwl3.cloud.couchbase.com'; 
const username = 'adminbot'; 
const password = '@Arya260408'; 
const bucketName = 'algojogacor';   

let cluster;
let bucket;
let collection;
let localData = {}; // Penampung data di RAM

// Fungsi Koneksi
async function connectToCloud() {
    try {
        console.log("☁️ Menghubungkan ke Couchbase...");
        cluster = await couchbase.connect(clusterConnStr, {
            username: username,
            password: password,
            configProfile: 'wanDevelopment',
        });
        bucket = cluster.bucket(bucketName);
        collection = bucket.defaultCollection();
        console.log("✅ Terhubung ke Couchbase Cloud!");

        // Langsung Load Data saat konek
        await loadFromCloud();
    } catch (err) {
        console.error("❌ Gagal Konek Couchbase:", err);
    }
}

// Fungsi Load Data dari Cloud ke RAM
async function loadFromCloud() {
    try {
        const result = await collection.get('bot_data'); // 'bot_data' adalah ID dokumen kita
        localData = result.content;
        console.log("📥 Data berhasil ditarik dari Cloud.");
    } catch (err) {
        if (err.message.includes('document not found')) {
            console.log("ℹ️ Data baru di Cloud. Menggunakan default.");
            localData = { users: {}, groups: {}, market: {} };
        } else {
            console.error("⚠️ Gagal Load Data:", err.message);
        }
    }
    return localData;
}

// Fungsi Load (Dipanggil index.js)
const loadDB = () => localData;

// Fungsi Save (Push RAM ke Cloud)
const saveDB = async (data) => {
    if (data) localData = data;
    try {
        await collection.upsert('bot_data', localData);
        // console.log("☁️ Data tersimpan ke Cloud.");
    } catch (err) {
        console.error("⚠️ Gagal Save ke Cloud:", err.message);
    }
};

// Helper Quest (Sama kayak kemarin)
const addQuestProgress = (user, questId) => {
    if (!user.quest || !user.quest.daily) return null;
    const quest = user.quest.daily.find(q => q.id === questId);
    if (quest && !quest.claimed && quest.progress < quest.target) {
        quest.progress++;
        if (quest.progress >= quest.target) {
            return `🎉 Quest *${quest.name}* Selesai! Ketik !daily klaim.`;
        }
    }
    return null;
};


module.exports = { connectToCloud, loadDB, saveDB, addQuestProgress };

