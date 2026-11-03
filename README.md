# 🎵 Aura Music Studio

Aplikasi pemutar musik modern yang menggabungkan pencarian katalog **Spotify** dan **YouTube Music**, pemutaran file lokal **Lossless**, **Spotify Wrapped Sync Bridge**, serta **Pencarian Cerdas berbasis Lirik**.

---

## 🚀 Cara Menjalankan Setelah Clone (Untuk Pengguna Baru)

Bagi siapa pun yang meng-clone repository ini ke komputer mereka:

```bash
# 1. Clone repository
git clone https://github.com/raya2125/musik.git
cd musik

# 2. Install dependensi Node.js
npm install

# 3. Pastikan Python terpasang dan install yt-dlp
pip install yt-dlp

# 4. Jalankan aplikasi (Pilih salah satu)
# Cara A (Windows): Klik 2x file start.bat
# Cara B (Manual):
node server/index.js
npm run dev
```

Buka browser di `http://localhost:5173` atau `http://localhost:3001`.

---

### Atau Jalankan dengan Docker (Tanpa Perlu Install Node/Python):
```bash
docker build -t aura-music .
docker run -p 3001:3001 aura-music
```
Buka browser di `http://localhost:3001`.

---

## ✨ Fitur Unggulan

1. **Dual Engine Mode:**
   - **Spotify Mode:** Cari lagu dari katalog Spotify dan album resmi.
   - **YT Music Mode:** Akses lagu resmi, versi remix, akustik, dan *live sessions* dari YouTube Music tanpa batas.
2. **Spotify Wrapped Sync Bridge:**
   - Pemutaran tetap dicocokkan ke Spotify Web API & Scrobbler sehingga menit dengar & artis favoritmu tetap terhitung di Spotify Wrapped.
3. **Pencarian Cerdas Berbasis Lirik (Neural Lyric Search):**
   - Ketik potongan lirik, sistem otomatis menemukan judul lagunya secara tepat dan menyediakan tombol lompat langsung ke detik lirik tersebut dinyanyikan.
4. **Song Radio & Infinite Mix:**
   - Algoritma radio dinamis YouTube Music InnerTube: otomatis mengalirkan 50 lagu radio serupa yang cocok genre & mood.
5. **Multi-Platform Support:**
   - **Android Native APK:** `AuraMusic-Studio.apk`
   - **Desktop App:** `start.bat` / `Buka-Aura-Music.bat`
   - **Docker / Cloud Ready:** Siap di-deploy ke Render / VPS / Koyeb via Dockerfile.
