# Pedoman Pengembangan Cuplik

## Prinsip kerja

- Pahami permintaan sebelum mengubah kode. Sampaikan interpretasi dan asumsi yang memengaruhi implementasi.
- Tanyakan satu klarifikasi singkat jika menebak berisiko. Untuk pekerjaan jelas dan berisiko rendah, nyatakan asumsi lalu lanjutkan.
- Buat perubahan terkecil yang memenuhi kebutuhan. Ikuti gaya lokal; jangan menambahkan fitur, dependency, konfigurasi, atau abstraksi tanpa kebutuhan nyata.
- Jangan mencampurkan perubahan perilaku dengan perapian, rename, atau refactor yang tidak diminta. Bersihkan hanya kode yang menjadi tidak terpakai akibat perubahan sendiri.
- Tentukan hasil yang dapat diperiksa sebelum mulai. Gunakan verifikasi paling sempit yang bermakna dan jelaskan pemeriksaan yang belum dilakukan.
- Jika pendekatan memperbesar lingkup tanpa manfaat yang diperlukan, jelaskan risikonya dan tawarkan pendekatan lebih kecil.

## Sumber kebutuhan dan stack

- Baca `docs/cuplik-cliper-prd.md` dan `docs/frd-cuplik.md` sebelum mengerjakan fitur terkait.
- FRD v2 menjadi acuan untuk pembaruan eksplisit atas PRD, termasuk autentikasi dan persistensi proyek. Retensi mengikuti keputusan terbaru yang diselaraskan pada PRD/FRD: sumber 24 jam sejak upload berhasil, ekspor 24 jam sejak render berhasil. Klarifikasi konflik lain; jangan mengarang kebutuhan dari bagian dokumen yang terpotong.
- Frontend: React dengan Vite, menggunakan JavaScript dan JSX.
- Backend: Express dan Node.js, menggunakan JavaScript. Jangan menambahkan TypeScript atau layanan Python tanpa keputusan tim.
- Database: PostgreSQL di Aiven dengan Prisma sebagai ORM. Kode backend tetap menggunakan JavaScript.
- Antrean: BullMQ dengan Redis. API Express dan worker Node.js berjalan sebagai proses terpisah.
- Pemrosesan media: FFmpeg. Integrasi ASR dan LLM berada di service backend; provider/model ditetapkan bersama sebelum integrasi.
- Jangan mengubah PRD/FRD untuk menyesuaikannya dengan implementasi tanpa persetujuan.

## Struktur frontend

```text
frontend/
├── public/                   # Aset statis yang disajikan langsung
├── src/
│   ├── assets/               # Gambar, logo, dan font yang diimpor
│   ├── components/           # Komponen yang digunakan lintas fitur
│   ├── layouts/              # Navbar dan kerangka halaman
│   ├── features/
│   │   ├── auth/             # Login Google dan state pengguna
│   │   ├── projects/         # Dashboard dan daftar proyek
│   │   ├── ingestion/        # Upload, pilihan layout, kamus, progres
│   │   └── clips/            # Preview, editor, dan ekspor
│   ├── lib/
│   │   └── api.js            # Konfigurasi request ke backend
│   ├── styles/               # CSS global
│   ├── App.jsx              # Routing dan penyusunan aplikasi
│   └── main.jsx             # Entry point React
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

- Simpan halaman, komponen khusus, dan fungsi API dalam fitur masing-masing. Contoh: `features/ingestion/UploadPage.jsx`, `features/ingestion/components/UploadForm.jsx`, dan `features/ingestion/ingestion.api.js`.
- Pindahkan komponen ke `src/components/` ketika benar-benar digunakan lintas fitur; jangan membuat abstraksi untuk satu pemakai.
- Frontend menampilkan input, hasil, dan status; otorisasi serta validasi otoritatif dilakukan backend.
- Gunakan polling status setiap 5 detik selama pemrosesan aktif. Hentikan polling saat tidak diperlukan.
- Jangan memasukkan rahasia ke variabel `VITE_*`, karena nilainya dapat diakses browser.

## Struktur backend

```text
backend/
├── src/
│   ├── config/              # Konfigurasi environment, PostgreSQL, Redis
│   │   └── prisma.js        # Inisialisasi Prisma Client per proses
│   ├── controllers/         # Membaca request dan mengirim response
│   ├── models/              # Fungsi akses data melalui Prisma
│   ├── routes/              # Endpoint dan pemasangan middleware
│   ├── middlewares/         # Autentikasi, validasi, penanganan error
│   ├── services/            # Logika bisnis dan integrasi eksternal
│   │   ├── auth.service.js
│   │   ├── project.service.js
│   │   ├── upload.service.js
│   │   ├── transcription.service.js
│   │   ├── curation.service.js
│   │   ├── clip.service.js
│   │   ├── render.service.js
│   │   └── retention.service.js
│   ├── queues/              # Definisi antrean dan pengiriman job BullMQ
│   ├── workers/             # Pipeline background dan render ulang
│   ├── utils/               # Helper kecil, misalnya format waktu dan SRT
│   └── app.js               # Inisialisasi Express dan middleware global
├── migrations/              # Lokasi ilustratif; ikuti versi Prisma yang dikunci
├── tests/                   # Pengujian backend
├── .env                     # Rahasia lokal; diabaikan Git
├── .env.example             # Contoh konfigurasi tanpa kredensial
├── .gitignore
├── package.json
└── server.js                # Entry point HTTP server
```

- Gunakan struktur berlapis ini; jangan menggantinya dengan struktur backend `modules/` tanpa kesepakatan tim.
- Alur HTTP: route → middleware → controller → service → model → Prisma → PostgreSQL.
- `models/` berisi fungsi akses data melalui Prisma; `services/` tetap menangani aturan bisnis. Jangan menduplikasi definisi schema Prisma sebagai model ORM lain.
- Inisialisasi Prisma Client di `src/config/prisma.js` dan gunakan kembali instance tersebut dalam setiap proses. API dan worker memiliki instance masing-masing; jangan membuat client baru untuk setiap request atau job.
- Kunci versi Prisma saat setup. Lokasi dan format schema, konfigurasi, serta migrasi harus mengikuti versi tersebut; struktur migrasi di atas hanya ilustrasi. Jangan mencampur pola atau perintah dari versi Prisma yang berbeda. Pertahankan kode aplikasi dan konfigurasi yang ditulis tim dalam JavaScript.
- Controller tidak memuat logika bisnis berat. Service dapat dipanggil controller maupun worker tanpa bergantung pada objek request/response Express.
- Service mengirim pekerjaan berat ke queue; worker memanggil service AI/FFmpeg dan menyimpan status ke database.
- Jangan menjalankan transkripsi, kurasi panjang, atau rendering di handler HTTP. Jalankan FFmpeg sebagai proses anak worker, bukan melalui command shell yang dibangun dari input pengguna.
- Gunakan nama berbasis fitur: `project.routes.js`, `project.controller.js`, `project.service.js`, dan `project.model.js`.
- Daftar struktur merupakan pedoman penempatan, bukan kewajiban membuat semua file kosong. Tambahkan file ketika dibutuhkan.
- Simpan video di penyimpanan media yang dikonfigurasi dan dapat diakses API/worker; PostgreSQL menyimpan metadata, status, dan transkrip. Jangan commit media runtime.

## Kolaborasi tiga orang

| Anggota | Frontend | Backend |
| --- | --- | --- |
| A | `auth`, `projects`: Google Sign-In, halaman login, dashboard proyek | Verifikasi token Google, CRUD metadata proyek, schema Users/Projects/Clips melalui Prisma, koordinasi database, cron-job pembersihan dan retensi |
| B | `ingestion`: form upload, kamus istilah, pilihan layout, progres seluruh tahapan pipeline | API upload, validasi media, ekstraksi audio, ASR dengan timestamp per kata, kamus istilah |
| C | `clips`: kartu hasil kurasi, preview, editor waktu/subtitle, tombol ekspor | Kurasi LLM, klip, layout FFmpeg, subtitle, API render ulang per klip, ekspor MP4/SRT, koordinasi fondasi BullMQ/Redis dan worker bersama |

- Kepemilikan pekerjaan mengikuti Bab 3 FRD dan tabel di atas, dari frontend sampai backend. Jika penugasan pada jadwal Bab 7 berbeda, gunakan Bab 3 sebagai acuan pemilik; jadwal tidak otomatis memindahkan tanggung jawab.
- Bantuan lintas anggota harus disepakati dengan pemilik fitur dan mencantumkan lingkup serta file yang dikerjakan. Bedakan pemilik utama dengan anggota pendukung; jangan mengimplementasikan bagian yang sama secara paralel tanpa koordinasi.
- Setiap anggota menggunakan checkout atau worktree sendiri. Jangan berganti branch di direktori yang sedang digunakan anggota lain.
- Gunakan branch fitur `feat/<fitur>` untuk pekerjaan tim dan PR ke `dev` untuk integrasi. Agen tetap menggunakan branch aktif kecuali diminta membuat atau berpindah branch.
- Sebelum pekerjaan paralel, catat pemilik, lingkup, dependensi, dan file bersama pada issue atau draft PR. Agen tidak mengirim pesan atau memublikasikan update eksternal tanpa otorisasi.
- Jangan mengedit modul milik anggota lain tanpa koordinasi, menimpa perubahan lokal orang lain, atau melakukan refactor lintas fitur di dalam PR fitur.
- A mengoordinasikan file bersama: `App.jsx`, `main.jsx`, `app.js`, `server.js`, konfigurasi (termasuk `src/config/prisma.js` dan konfigurasi tooling Prisma), schema Prisma, manifest dependency, lockfile, dan migrasi. Koordinator mengatur urutan perubahan; anggota lain tetap dapat mengusulkan patch melalui PR.
- B dan C menyepakati payload serta urutan pipeline sebelum mengubah queue/worker bersama. A mengoordinasikan integrasinya dengan status proyek dan database.
- B memiliki implementasi tahap ingest/transkripsi; C memiliki tahap kurasi/render dan render ulang. UI progres milik B menampilkan status dari seluruh tahap tersebut menggunakan kontrak status bersama.
- C mengoordinasikan fondasi BullMQ/Redis dan entry point worker bersama pada H-02 sesuai FRD. B mengimplementasikan job ingest/ekstraksi audio/transkripsi; C mengimplementasikan kurasi/render/render ulang. A mengoordinasikan persistensi status dan schema. Sepakati payload serta status pada H-01; fondasi harus tersedia sebelum integrasi pipeline.
- Targetkan integrasi lengkap termasuk editor, render ulang per klip, dan ekspor pada H-07 sebelum user testing H-08. H-08 digunakan untuk pengujian dan perbaikan, bukan setup awal queue/worker.
- A bertanggung jawab atas cron-job pembersihan berkas dan retensi sesuai Bab 3 FRD. B dan C menyediakan kebutuhan lokasi media serta aktivitas pemrosesan/penyuntingan yang relevan; jangan membuat scheduler pembersihan terpisah per fitur.
- Struktur folder tidak menggantikan review: setiap PR integrasi memerlukan review minimal satu anggota lain.

## Kontrak integrasi dan database bersama

- Sebelum fitur paralel bergantung satu sama lain, sepakati endpoint, request/response, autentikasi, error, status proses, dan payload job yang relevan.
- Saat pekerjaan kontrak dimulai, catat kontrak HTTP di `docs/API_Contract.yaml` dan payload pipeline di dokumen pendamping yang disepakati. Jangan menganggap dokumen tersebut sudah tersedia.
- Perubahan kontrak harus dikoordinasikan dengan pemilik fitur yang terdampak sebelum implementasi.
- Gunakan database atau schema pengembangan terisolasi per anggota dan lingkungan integrasi terpisah. Pastikan target koneksi sebelum menjalankan migrasi.
- Jangan mengedit migrasi yang sudah diterapkan bersama; tambahkan migrasi baru dan koordinasikan urutannya.
- Review perubahan schema Prisma dan migrasi yang dihasilkan dalam PR sebelum diterapkan pada lingkungan bersama.
- Jangan menjalankan reset, seed destruktif, atau migrasi pada database bersama tanpa persetujuan eksplisit tim.
- Gunakan TLS dengan verifikasi sertifikat untuk koneksi Aiven. Jangan menonaktifkan verifikasi sertifikat sebagai solusi koneksi.
- Simpan kredensial pada environment lokal/server; `.env.example` hanya berisi placeholder. Jangan mencetak secret ke log atau memasukkannya ke Git.

## Batas produk dan keamanan

- MVP: login Google, proyek persisten, satu upload MP4/MOV maksimal 45 menit dan 1 GB, maksimal 20 istilah kustom, ASR timestamp per kata, kurasi 3–5 klip berdurasi 25–75 detik, tiga layout 9:16, dua gaya subtitle, editor ringan, serta ekspor MP4 1080×1920 dan SRT.
- Editor mendukung penyesuaian batas waktu per 0,5 detik, koreksi judul/subtitle, dan render ulang hanya klip yang berubah.
- Simpan gaya subtitle per klip melalui `subtitleStyle` (`clean` atau `active_word_highlight`, default `clean`). Backend wajib memvalidasi maksimal 20 istilah, transkrip per kata dengan `word`, `start_time`, `end_time`, `confidence`, 3–5 hasil kurasi berdurasi 25–75 detik, serta pilihan layout/subtitle yang didukung. Schema saja bukan bukti validasi pipeline sudah diimplementasikan.
- Jangan menambahkan tracking pembicara dinamis, posting media sosial, batch upload, timeline multi-track, B-roll, pembayaran, atau workspace kolaboratif pengguna aplikasi ke MVP.
- Verifikasi kepemilikan proyek dan klip pada setiap akses, perubahan, preview, dan unduhan. Jangan membuka folder media privat sebagai direktori publik tanpa kontrol akses.
- Validasi media di server, bukan hanya dari ekstensi/nama yang dikirim browser.
- Video sumber kedaluwarsa 24 jam setelah upload/upload ulang berhasil; ekspor MP4/SRT kedaluwarsa 24 jam setelah render berhasil. Metadata dan transkrip tetap disimpan. Render ulang setelah sumber hilang meminta upload ulang sumber asli.
- Kebijakan retensi adalah fitur aplikasi yang diuji dan dibatasi pada media terkelola, bukan izin untuk menjalankan perintah penghapusan massal saat pengembangan.
- Ikuti aturan persistensi retensi pada Bab 4 FRD: upload/upload ulang berhasil menetapkan masa retensi sumber; penyimpanan edit hanya memperbarui aktivitas edit, tidak memperpanjang retensi. Polling/unduhan tidak memperpanjang retensi; render berhasil menetapkan kedaluwarsa ekspor klip tersebut. Simpan transkrip sumber lengkap, tahap proses, waktu aktivitas edit, dan waktu kedaluwarsa. Setelah pembersihan, kosongkan path media terkait tanpa menghapus metadata; tunda pembersihan media yang dipakai job aktif. Scheduler retensi dan validasi pipeline merupakan pekerjaan tahap berikutnya, belum diimplementasikan oleh setup schema H-01.
- Jangan menyatakan fitur selesai dengan data mock. Integrasi AI yang belum memiliki provider/kredensial harus dinyatakan belum terverifikasi.

## Git dan keselamatan perubahan

- Konfirmasi repo dan branch aktif pada awal tugas coding. Inspeksi read-only boleh dilakukan terlebih dahulu.
- Untuk pekerjaan bertahap, tanyakan preferensi checkpoint commit/push jika belum ada keputusan pada sesi. Jika belum disetujui, perubahan tetap lokal.
- Jika checkpoint disetujui, commit/push milestone kecil setelah verifikasi yang relevan. Ringkas perubahan sebelum commit dan sertakan hanya perubahan terkait tugas.
- Gunakan akses commit/push normal. Jangan force-push, menulis ulang history, mengubah remote, pengaturan repo, collaborator, branch protection, atau menghapus branch.
- Jika push diperlukan tetapi remote belum tersedia, minta pengguna menyediakan atau mengonfigurasinya.
- Jangan menggunakan perintah penghapusan massal/rekursif, wildcard cleanup, atau loop penghapusan.
- Penghapusan manual hanya ketika diperlukan, satu target literal yang disebutkan secara eksplisit per perintah. Untuk beberapa target atau kebutuhan rekursif, tanyakan dahulu.

## Verifikasi dan pelaporan

- Bug fix: tentukan kasus gagal dan perilaku yang diharapkan. Fitur: tentukan perilaku yang dapat diamati. Refactor: pastikan perilaku lama tetap terjaga.
- Jalankan pemeriksaan relevan sesuai perubahan, termasuk isolasi akses pengguna, persistensi, validasi upload, dan status job ketika area tersebut diubah.
- Untuk pipeline video, verifikasi menggunakan sampel webinar nyata. Uji kegagalan provider/render dan pastikan render ulang satu klip tidak memproses ulang seluruh batch.
- Build atau pemeriksaan statis tidak membuktikan koneksi Aiven, Google login, kualitas ASR, atau rendering nyata. Laporkan batas bukti dengan jelas.
- Target waktu pemrosesan dan akurasi pada PRD/FRD harus diukur, bukan diklaim dari inspeksi kode.
- Untuk pekerjaan nontrivial, laporkan secara ringkas: asumsi, perubahan, verifikasi, dan risiko tersisa. Jangan menambahkan seremoni untuk perubahan satu baris yang jelas.
