# Clippr

Cuplik adalah aplikasi web yang dirancang untuk mengubah rekaman webinar menjadi 3–5 klip vertikal (9:16) dengan subtitle bahasa Indonesia. Alur produk mencakup login Google, pengelolaan proyek, upload video, transkripsi dan kurasi AI, editor ringan, serta ekspor MP4/SRT. Integrasi pipeline video masih dalam pengembangan.

Aplikasi menggunakan **React + Vite** pada frontend, **Express + Node.js** pada backend, dan **PostgreSQL Aiven + Prisma** untuk penyimpanan data.

## Persiapan

- Gunakan Node.js 22.12+ atau 24 beserta npm.
- Siapkan koneksi PostgreSQL Aiven dengan schema aplikasi yang sudah tersedia dan sertifikat CA di `backend/certs/ca.pem`. Pengaturan database dijelaskan di [README backend](backend/README.md#konfigurasi-aiven-database-bersama); migrasi database bersama memerlukan persetujuan tim.
- Siapkan Google OAuth client bertipe **Web application**, dengan Authorized JavaScript origins `http://localhost` dan `http://localhost:5173`.

Dari root repository, salin contoh konfigurasi **hanya jika file `.env` belum ada**:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Isi konfigurasi berikut sebelum menjalankan aplikasi:

| File | Variabel | Nilai |
| --- | --- | --- |
| `backend/.env` | `DATABASE_URL` | URI Aiven dengan TLS dan verifikasi CA sesuai contoh |
| `backend/.env` | `GOOGLE_CLIENT_ID` | Google OAuth Web client ID |
| `backend/.env` | `SESSION_SECRET` | Secret acak minimal 32 karakter |
| `backend/.env` | `PORT` | `3000` |
| `backend/.env` | `FRONTEND_ORIGIN` | `http://localhost:5173` |
| `frontend/.env` | `VITE_GOOGLE_CLIENT_ID` | Client ID yang sama dengan backend |
| `frontend/.env` | `VITE_API_BASE_URL` | `http://localhost:3000` |

Untuk upload dan transkripsi, siapkan juga FFmpeg/ffprobe pada `PATH`, lalu tambahkan `ELICE_API_KEY`, `ELICE_API_BASE_URL`, dan `STT_MODEL` (default `whisper-large-v3`) ke `backend/.env` sesuai layanan transkripsi tim. Simpan kredensial hanya di backend; jangan commit `.env`.

## Menjalankan aplikasi

**Terminal 1 — backend**, mulai dari root repository:

```powershell
cd backend
npm ci
npm run db:generate
npm run db:check
npm run dev
```

Pastikan pemeriksaan database berhasil. API berjalan di `http://localhost:3000`; endpoint `http://localhost:3000/api/health` mengembalikan `{"status":"ok"}` jika server HTTP aktif.

**Terminal 2 — frontend**, mulai dari root repository:

```powershell
cd frontend
npm ci
npm run dev
```

Buka **http://localhost:5173** atau langsung **http://localhost:5173/login** untuk masuk dengan Google. Gunakan hostname `localhost` agar sesuai konfigurasi login dan origin. Restart proses setelah mengubah `.env`; hentikan dengan `Ctrl+C` pada masing-masing terminal.

Setelah persiapan pertama selesai, cukup jalankan `npm run dev` di folder `backend` dan `frontend`. Login memerlukan konfigurasi Google dan database yang valid; server aktif belum membuktikan seluruh pipeline AI/render berjalan.

Detail kebutuhan produk tersedia di [PRD](docs/cuplik-cliper-prd.md) dan [FRD](docs/frd-cuplik.md).
