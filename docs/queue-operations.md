# Menjalankan antrean Cuplik

## Lingkungan pengembangan

Redis berjalan di Docker; API dan worker Node.js memakai checkout backend,
database, dan direktori media yang sama. Frontend tetap Vite. Tidak perlu load
balancer atau container API untuk integrasi lokal ini.

1. Pastikan Docker Desktop memakai Linux containers.
2. Dari root repo: `docker compose up -d --wait redis`.
3. Pada backend, jalankan `npm ci`, `npm run db:generate`, dan `npm run db:validate`.
4. Atur `REDIS_URL=redis://127.0.0.1:6379` dan `QUEUE_PREFIX=cuplik-local` pada
   environment backend. Gunakan prefix berbeda untuk database/lingkungan berbeda.
5. Database target harus sudah mempunyai migrasi `20260915000000_processing_jobs`.
   Review migrasi sebelum menerapkan; **jangan menerapkan ke Aiven bersama tanpa
   persetujuan eksplisit**. Konfigurasi Aiven tetap TLS dengan verifikasi sertifikat.
6. Jalankan `npm run dev` dan `npm run worker:dev` pada dua terminal backend.
7. Jalankan `npm run dev` dari frontend; gunakan `http://localhost:5173`.

HTTP 202 dari upload/render berarti job sudah tersimpan pada database. Dispatcher
worker meneruskannya ke Redis maksimal sekitar satu interval pemeriksaan (5 detik)
ketika koneksi sehat. Browser memantau database melalui endpoint proyek/klip.

`npm run worker` tersedia untuk menjalankan worker tanpa watch. SIGINT/SIGTERM
menghentikan pengambilan job baru dan menunggu pekerjaan aktif selesai sebelum
menutup Redis/Prisma. Penghentian paksa dipulihkan melalui mekanisme stalled job.

## Pengujian Redis dan PostgreSQL terisolasi

Dari root repo:

```powershell
docker compose -p cuplik-queue-tests -f compose.test.yaml up -d --wait
```

Dari backend:

```powershell
npm run db:generate
npm run test:queue
```

Runner menggunakan target tetap `127.0.0.1:15432/cuplik_queue_test` dan Redis
`127.0.0.1:16379`. Nilai DATABASE_URL dari `.env` tidak dipakai untuk tes ini.
Migrasi diterapkan pada PostgreSQL pengujian tersebut, bukan database aplikasi.
Credential pada Compose pengujian hanya credential lokal sekali pakai.

Tes memakai Redis, transaksi PostgreSQL, dan child worker nyata; ASR/LLM serta
render diganti provider pengujian. Kasus yang diperiksa meliputi rollback admission,
job tercatat sebelum enqueue, pemulihan worker mati, checkpoint, fencing percobaan
lama, ownership, blok edit/delete, dan render ulang satu klip.

Sesudah pengujian, dari root repo:

```powershell
docker compose -p cuplik-queue-tests -f compose.test.yaml stop
```

Volume tetap disimpan. Jangan gunakan `down -v`, flush Redis, atau reset database
sebagai cara pemulihan. Tes rutin `npm test` tidak menjalankan tes queue terisolasi;
suite provider lama dapat memakai kredensial LLM bila tersedia pada `.env`.

## Diagnosis dan pemulihan

### Uji provider nyata pada database terisolasi

Setelah container pengujian dan migrasi lokal siap, jalankan dari backend:

```powershell
node scripts/run-live-queue-check.js <path-video-webinar>
```

Perintah ini memakai kredensial ASR/LLM dari environment dan membuat cuplikan
enam menit mulai menit kelima dari video sumber. Gunakan video berdurasi minimal
11 menit dengan layout slide-only. Sumber asli tidak diubah. Pekerjaan dijalankan
oleh child worker memakai service produksi, PostgreSQL `cuplik_queue_test`, dan
Redis port 16379 dengan prefix unik. Tidak ada penulisan ke Aiven bersama.

Laporan JSON dan media uji dipertahankan di `backend/uploads/verification/live-queue`
dan direktori media proyek uji. Ini adalah uji service/worker dengan provider nyata,
bukan bukti login Google atau interaksi browser. Jangan jalankan bersamaan dengan
tes queue lain pada database pengujian yang sama.

- `docker compose exec redis redis-cli ping` memeriksa Redis lokal.
- `/api/health` hanya membuktikan proses API hidup, bukan worker/database siap.
- Periksa log worker berdasarkan `jobId`, tahap, percobaan, kode, dan durasi.
  Secret, token, dan bytes video tidak disimpan pada payload queue.
- Redis terputus: pulihkan koneksinya; catatan pending akan dikirim kembali.
- Worker mati: hidupkan worker kembali. Jangan menjalankan ulang upload yang
  sudah diterima hanya karena tab browser tertutup.
- Job gagal terminal: setelah memperbaiki penyebabnya, operator boleh menjalankan
  `npm run job:retry -- <jobId>` pada database yang telah diotorisasi. Perintah ini
  membuat job pengganti dan mempertahankan checkpoint. Tidak ada endpoint retry publik.
- Sumber hilang: worker mengembalikan `SOURCE_MISSING`; pemulihan memerlukan sumber
  asli. Retry job saja tidak membuat berkas sumber muncul kembali.
- Job lama sebelum integrasi ini tidak otomatis dibuatkan catatan baru. Selesaikan
  pekerjaan API lama sebelum mengaktifkan versi ini; jangan menjalankan keduanya
  untuk pekerjaan yang sama.

## Batas implementasi

Scheduler retensi belum dihubungkan. Integrasinya harus memakai lock proyek yang
sama dan memeriksa job pending/running. Sumber tetap +24 jam sejak upload berhasil,
ekspor +24 jam sejak render berhasil; metadata/transkrip tetap dipertahankan.

Tes provider pengganti tidak membuktikan kualitas ASR, kualitas kurasi webinar,
atau target waktu 15 menit. Uji alur nyata dengan video dan provider yang disepakati
setelah migrasi pada lingkungan aplikasi disetujui.
