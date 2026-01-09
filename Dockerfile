FROM node:20-bookworm

# 1. Install FFmpeg & Library Pendukung (Wajib buat stiker/PDF)
RUN apt-get update && \
    apt-get install -y \
    ffmpeg \
    imagemagick \
    webp && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# 2. Set Folder Kerja
WORKDIR /app

# 3. Copy Package JSON dulu biar cache jalan
COPY package*.json ./

# 4. Install Library Node.js
RUN npm install

# 5. Copy Semua File Bot
COPY . .

# 6. Buka Port untuk Koyeb
EXPOSE 3000

# 7. Jalankan Bot
CMD ["node", "index.js"]