# Frontend Clippr

Landing page React + Vite dengan JavaScript/JSX dan teks bahasa Indonesia.

```powershell
cd frontend
npm install
npm run dev
```

Vite menampilkan URL lokal di terminal (default `http://127.0.0.1:5173`). Build produksi: `npm run build`. Pratinjau build: `npm run preview`.

## Struktur

- `src/features/landing/`: halaman, stylesheet, dan komponen demo khusus landing page.
- `src/features/auth/`: halaman login, Google Sign-In, state sesi, dan request autentikasi.
- `src/lib/api.js`: request JSON ke backend dengan cookie dan timeout.
- `src/layouts/`: navbar responsif dan footer.
- `src/components/`: ikon yang dipakai lintas bagian halaman dan layout.
- `src/styles/global.css`: gaya global, tipografi, dan layout bersama.
- `src/App.jsx`: penyusunan aplikasi; `src/main.jsx`: entry point.
- `public/`: favicon SVG.

Folder fitur lain serta modul API ditambahkan ketika implementasinya diperlukan, sesuai AGENTS.md.

## Batas implementasi

Routing memakai `react-router-dom`: `BrowserRouter` dipasang di `src/main.jsx`, sedangkan `Routes` dan `Route` didefinisikan di `src/App.jsx`. Route `/` menampilkan landing page; `/login` menampilkan halaman login/akun; URL lain menampilkan halaman tidak ditemukan. Tautan antarbagian landing page tetap menggunakan anchor.

Saat hosting produksi, konfigurasikan server frontend agar permintaan URL halaman diarahkan ke `index.html` (SPA fallback), sehingga membuka URL langsung atau refresh tetap ditangani React Router. Permintaan API dan aset tetap ditangani melalui jalurnya masing-masing.

Tombol masuk/mulai menuju `/login`. Login memakai Google Identity Services resmi, mengirim ID token ke backend, lalu memverifikasi cookie lewat `/auth/me` sebelum menampilkan status berhasil. Setelah login, pengguna kembali ke beranda; klik nama di navbar untuk membuka akun dan keluar. Refresh memulihkan profil dari `/auth/me`, bukan localStorage. Tidak ada token atau profil login di localStorage/sessionStorage. Dashboard proyek, upload, transkripsi, dan render belum diimplementasikan.

## Konfigurasi login Google lokal

Isi `VITE_GOOGLE_CLIENT_ID` pada `.env` dengan OAuth Web client ID yang sama dengan `GOOGLE_CLIENT_ID` backend. Ini ID publik, bukan client secret. Gunakan `VITE_API_BASE_URL=http://localhost:3000` dan `FRONTEND_ORIGIN=http://localhost:5173` pada backend. Backend memerlukan `SESSION_SECRET` acak minimal 32 karakter; jangan menaruhnya di frontend.

Buka **http://localhost:5173/login**, bukan alamat IP 127.0.0.1. Tambahkan `http://localhost` serta `http://localhost:5173` ke Authorized JavaScript origins di Google Auth Platform. Jika aplikasi Google berada dalam testing, gunakan akun uji yang diizinkan. Tidak perlu redirect URI untuk callback popup ini. Restart proses setelah mengubah environment.

Verifikasi manual: pilih akun Google sendiri, pastikan nama tampil di navbar, refresh dan buka `/login` untuk memeriksa profil, lalu keluar dan refresh lagi. Login nyata melakukan upsert profil pengguna pada database yang dikonfigurasi. Jangan mengirim ID token ke chat atau log. Pengujian otomatis dengan respons terkontrol bukan bukti Google/Aiven end-to-end.

Font DM Sans dan Manrope dimuat dari Google Fonts; jika akses jaringan tidak tersedia, browser menggunakan font sans-serif bawaan.
