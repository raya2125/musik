)

Aplikasi pemutar musik yang menggabungkan pencarian katalog **Spotify** dan **YouTube Music**, pemutaran file lokal **FLAC/WAV PCM**, **Spotify Wrapped Sync Bridge**, serta **Pencarian berbasis Lirik**. Kualitas stream dari katalog online tidak diverifikasi sebagai lossless.

---

## ✨ Fitur Unggulan

1.
   - **Spotify Mode:** Cari lagu dari katalog Spotify; audio online berasal dari stream pihak ketiga dan kualitasnya tidak dijamin lossless.
   - **YT Music Mode:** Akses lagu resmi, versi remix, akustik, dan *live sessions* dari YouTube Music tanpa batas.
2. **Spotify Wrapped Sync Bridge (Anti-Ketinggalan Wrapped)**
   - Setiap kali memutar lagu di mode apa pun (bahkan YT Music atau Offline), pemutaran tetap dicocokkan ke Spotify Web API & Scrobbler sehingga menit dengar & artis favoritmu **tetap terhitung 100% di Spotify Wrapped**.

4. **Pencarian Cerdas Berbasis Lirik (Neural Lyric Search)**
   - Cukup ketik potongan lirik yang kamu ingat (misal: *"ku kira kita akan bersama"* atau *"sial sialnya ku bertemu"*), sistem otomatis menemukan judul lagunya secara tepat dan menampilkan tombol **`▶ Putar di mm:ss`** langsung ke detik lirik tersebut dinyanyikan.
5. **Simpan Audio Offline**
   - Simpan audio untuk pemutaran offline. Mengubah stream online menjadi wadah FLAC tidak menambah detail yang hilang dari sumber.
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
- **Backend:** Node.js, Express, `yt-dlp`, FFmpeg audio conversion, LRCLIB API
- **Mobile:** Capacitor 6, Android SDK (API 34), Gradle 8.0, OpenJDK 17
