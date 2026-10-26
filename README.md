# AURA Music Studio 🎵 (Lossless Hi-Res & Dual Engine)

Aplikasi pemutar musik studio modern yang menggabungkan katalog **Spotify** dan **YouTube Music** dengan pemrosesan audio **24-Bit / 96kHz Lossless FLAC**, **Spotify Wrapped Sync Bridge**, serta **Pencarian Pintar berbasis Lirik**.

---

## ✨ Fitur Unggulan

1. **Dual-Mode Engine (`Spotify Mode` ⇄ `YT Music Mode`)**
   - **Spotify Mode:** Akses katalog lagu Spotify dengan kualitas audio Lossless Hi-Res.
   - **YT Music Mode:** Akses lagu resmi, versi remix, akustik, dan *live sessions* dari YouTube Music tanpa batas.
2. **Spotify Wrapped Sync Bridge (Anti-Ketinggalan Wrapped)**
   - Setiap kali memutar lagu di mode apa pun (bahkan YT Music atau Offline), pemutaran tetap dicocokkan ke Spotify Web API & Scrobbler sehingga menit dengar & artis favoritmu **tetap terhitung 100% di Spotify Wrapped**.
3. **24-Bit / 96kHz Lossless Audio DSP & 5-Band Parametric EQ**
   - Pemrosesan sinyal audio 32-bit float dengan equalizer parametrik 5-band (*60Hz Sub-Bass, 230Hz Warmth, 910Hz Vocal, 3.6kHz Presence, 14kHz Air*) serta *Real-Time Spectrum Visualizer*.
4. **Pencarian Cerdas Berbasis Lirik (Neural Lyric Search)**
   - Cukup ketik potongan lirik yang kamu ingat (misal: *"ku kira kita akan bersama"* atau *"sial sialnya ku bertemu"*), sistem otomatis menemukan judul lagunya secara tepat dan menampilkan tombol **`▶ Putar di mm:ss`** langsung ke detik lirik tersebut dinyanyikan.
5. **Download Offline 24-Bit FLAC di HP & Desktop**
   - Simpan lagu ke penyimpanan lokal HP (IndexedDB) untuk diputar tanpa kuota, atau ekspor langsung sebagai file `.flac` 24-bit murni menggunakan konverter FFmpeg.
6. **Lirik Karaoke Real-Time (Live Synced Lyrics)**
   - Lirik lagu sinkron otomatis baris demi baris mengikuti detik nyanyian penyanyi ala Apple Music / Spotify.
7. **Multi-Platform Support**
   - **Android Native APK:** `AuraMusic-Studio.apk` (Signed Release APK).
   - **Desktop App:** Jendela mandiri borderless tanpa tab/URL bar (`Buka-Aura-Music.bat`).
   - **PWA (Progressive Web App):** Bisa langsung di-install di Chrome/Safari.

---

## 🚀 Cara Menjalankan

### 1. Jalankan di Desktop (Windows)
Cukup klik ganda file:
```cmd
Buka-Aura-Music.bat
```
Atau secara manual:
```bash
# Terminal 1: Backend Server (Port 3001)
node server/index.js

# Terminal 2: Frontend Web App (Port 5173)
npm run dev
```

### 2. Install di HP Android
File APK rilis sudah siap di-install langsung:
- File lokal: `AuraMusic-Studio.apk`
- Langsung transfer ke HP via WhatsApp / USB / Google Drive, lalu buka dan install.

---

## 🛠️ Tech Stack
- **Frontend:** React 18, Tailwind CSS, Vite, Lucide Icons, Web Audio API DSP
- **Backend:** Node.js, Express, `yt-dlp`, FFmpeg 24-Bit Audio Transcoder, LRCLIB API
- **Mobile:** Capacitor 6, Android SDK (API 34), Gradle 8.0, OpenJDK 17
