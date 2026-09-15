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

### Docker (disarankan untuk tim)

Aktifkan Docker Desktop dengan Linux containers. Siapkan `.env` backend/frontend
dan `backend/certs/ca.pem` sesuai bagian Persiapan. Database tujuan harus sudah
memiliki migrasi `ProcessingJob`; Compose tidak menjalankan migrasi otomatis.
Gunakan database/schema pengembangan terisolasi per anggota. Prefix Redis berbeda
saja tidak mengisolasi job pada database bersama.

Dari root repo:

```powershell
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 worker
docker compose exec api npm run db:check
```

API tersedia di `http://localhost:3000`; log worker harus menampilkan
`Cuplik worker siap.` Hentikan API/worker Node.js lokal sebelum menjalankan versi
Docker agar port dan pengambilan job tidak bertabrakan. Redis, API, dan worker
dijalankan oleh Compose; tidak perlu `npm ci` backend di host.

Frontend tetap dijalankan pada terminal lokal:

```powershell
cd frontend
npm ci
npm run dev
```

Buka `http://localhost:5173`. Setelah kode backend berubah, jalankan kembali
`docker compose up -d --build`; setelah `.env` berubah, jalankan
`docker compose up -d --force-recreate api worker` dari root repo.
Hentikan layanan dengan `docker compose stop`. Volume media/Redis tetap disimpan.
Detail konfigurasi, media lama, dan alternatif tanpa container backend tersedia
di [panduan antrean](docs/queue-operations.md).

### Alternatif: backend Node.js lokal

Jalankan Redis dengan `docker compose up -d redis`, lalu jalankan API berikut
dan `npm run worker` pada terminal backend terpisah.

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
