# Orang A menuju H-06 — hasil lokal

Pemeriksaan 13 September 2026 pada branch `dev`, dasar commit `7384fd3`.
Perubahan tetap lokal. Bagian B/C yang belum terintegrasi tidak dikerjakan.
**H-06 belum selesai:** integrasi B/C dan verifikasi browser nyata masih tertunda.

## Hasil per tahap

| Tahap | Hasil bagian A | Yang belum dibuktikan / menunggu |
| --- | --- | --- |
| H-01/H-02 | Kontrak dan fixture layout diselaraskan menjadi `slide-cam`, `talking-head`, `slide-only`; dua tes metadata kembali lulus. Schema Prisma valid dan tiga SQL migrasi lokal dibaca tanpa perubahan. | Kesepakatan kontrak pipeline A/B/C; kecocokan seluruh schema/checksum migrasi database belum diperiksa. |
| H-03 | Tes HTTP login, logout, tanda tangan dan kedaluwarsa sesi, serta isolasi proyek lulus. | Google login dengan akun nyata dan ownership klip menunggu API C. |
| H-04 | Pemeriksaan kode menunjukkan tujuan login mempertahankan path/query/hash, validasi link, pesan proyek tidak tersedia, retry jaringan, dan pembacaan metadata berdasarkan pemilik. Logika retensi terisolasi ditambahkan. | Browser tidak tersedia; alur tab/login belum diuji lewat UI. Halaman progres/hasil, adapter klaim media nyata, dan scheduler belum diintegrasikan. |
| H-05 | Tes retensi waktu terkontrol dan berkas sementara lulus; pembacaan proyek tidak mengubah expiry, aktivitas edit, atau transkrip pada repository uji. | Persistensi klip/status pipeline dan retensi pada database/media nyata belum diuji. |
| H-06 | Matriks HTTP bagian A di bawah sudah dijalankan dengan identitas dan repository uji. | Pipeline video nyata, API klip, preview dan unduhan menunggu B/C. |

## Verifikasi yang dijalankan

Jalankan dari `backend`:

```powershell
node --test tests/auth.test.js tests/session.test.js tests/project-crud.test.js tests/google-verifier.test.js tests/database-config.test.js tests/retention.test.js
npm run db:validate
npm run db:check
```

- **39 tes lulus, 0 gagal.** Ini bukan seluruh suite kurasi/render milik B/C.
- `db:validate` lulus. Tiga migrasi lokal berisi schema awal, gaya subtitle, dan `llm_calls`; tidak ada migrasi yang dijalankan atau diubah.
- `db:check` SELECT-only berhasil: schema `public`, TLS aktif, tabel users/projects/clips tersedia. Percobaan dalam sandbox gagal; pengulangan di luar sandbox berhasil. Tidak ada penulisan data uji ke Aiven.
- `git diff --check` lulus. Frontend tidak diubah sehingga build tidak diulang pada tahap implementasi ini; build pada pemeriksaan sebelumnya lulus.
- Browser runtime tidak menemukan browser tersedia. Pemeriksaan frontend saat ini hanya inspeksi kode, bukan bukti interaksi browser.

## Matriks akses H-06

| Endpoint / tindakan | Tanpa sesi / palsu / kedaluwarsa | Pemilik / sesi valid | Pengguna lain | Bukti |
| --- | --- | --- | --- | --- |
| `POST /api/auth/google` | Token hilang/rusak ditolak | Cookie HttpOnly; identitas dari verifier | Identitas dari body tidak dapat mengganti subject token | Tes HTTP dengan verifier/persistensi uji; verifier resmi diuji dengan token kriptografis lokal |
| `GET /api/auth/me` | 401 | Profil pemilik sesi | Sesi yang dimodifikasi ditolak | Tes sesi dengan penyimpanan pengguna uji |
| `POST /api/auth/logout` | Tanpa sesi tetap idempoten | 204, cookie dihapus | Origin tak tepercaya ditolak | Tes HTTP; logout browser belum diuji |
| `GET /api/projects` | 401 | Hanya proyek pemilik sesi | Tidak melihat proyek akun lain | Tes HTTP, repository memori |
| `POST /api/projects` | 401 | Proyek kosong milik sesi | Tidak dapat menentukan pemilik dari body | Tes HTTP, repository memori |
| `GET /api/projects/:id` | 401 | 200, tanpa path privat/transkrip | 404 identik dengan ID tidak ditemukan | Tes HTTP, repository memori |
| `PATCH /api/projects/:id` | 401 | 200 untuk proyek kosong; 409 untuk proyek yang tidak dapat diedit | 404, data tetap utuh | Tes HTTP, repository memori |
| `DELETE /api/projects/:id` | 401 | 204 hanya proyek kosong; 409 untuk proyek berisi media | 404, proyek tetap ada | Tes HTTP, repository memori |
| `POST /api/projects/:id/source` | 401 sebelum upload | Belum diuji pada tahap A ini | Belum diuji pada tahap A ini | Hanya gerbang autentikasi; ownership upload/media milik B menunggu integrasi |
| API klip, preview, unduhan, render ulang | Menunggu endpoint C | Menunggu endpoint C | Menunggu endpoint C | Belum dapat diuji; 404 karena route tidak ada bukan bukti ownership |

Saat B/C siap, jalankan ulang matriks terhadap implementasi nyata dengan dua akun uji dan webinar nyata. Pastikan respons yang ditolak tidak memuat metadata, path, atau bytes media; polling/unduhan tidak memperpanjang retensi. Jangan menulis fixture ke database bersama tanpa persetujuan.

## Kontrak internal retensi — persiapan, belum integrasi

`backend/src/services/retention.service.js` mengekspor `createRetentionService({ repository, mediaRoot, files, clock })` dengan metode `runOnce()`. Tidak diimpor oleh server, tidak memiliki timer/cron, tidak membuat Prisma Client, dan tidak menentukan direktori media produksi secara otomatis.

- `mediaRoot` wajib path absolut untuk direktori media terkelola. `files` default ke `node:fs/promises`; `clock` default ke waktu saat ini. Pengujian mengganti waktu dan menggunakan direktori sementara terisolasi.
- `repository.listExpired(now)` mengembalikan kandidat `{ id, kind, path, expiresAt }`; `kind` adalah `source`, `mp4`, atau `srt`, `expiresAt` berupa `Date`. Kandidat hanya usulan, bukan izin hapus.
- `repository.withCleanupClaim(candidate, now, callback)` wajib memperoleh klaim eksklusif yang digunakan bersama upload/upload ulang, antrean, render, dan akses media terkait. Jika media sedang dipakai/dipesan job, jangan panggil callback. Klaim harus ditahan sampai callback selesai, dilepas saat gagal, dan mencegah penggantian path selama penghapusan.
- Callback menerima `{ media, clearPath }`: `media` merupakan snapshot terbaru di bawah klaim; `clearPath()` mengosongkan hanya kolom path media tersebut dengan pemeriksaan ID/path/expiry yang sama. Kegagalan pembaruan harus melempar error. Metadata, transkrip, expiry, serta path media lain tetap ada.
- Pemetaan nantinya: `source` ke Project.sourceVideoPath/sourceExpiresAt; `mp4` ke Clip.clipVideoPath/exportExpiresAt; `srt` ke Clip.srtPath/exportExpiresAt. Adapter Prisma dan mekanisme klaim nyata **belum dibuat**, menunggu kontrak A/B/C. Pemeriksaan `status` sekali saja tidak memenuhi kontrak klaim.
- Upload berhasil menetapkan expiry sumber +24 jam; render berhasil menetapkan expiry ekspor +24 jam. Service ini **mengonsumsi expiry tersimpan**, tidak menetapkan timestamp upload/render dan tidak memperpanjang expiry akibat edit/polling/unduhan. Penetapan timestamp nyata tetap harus diuji saat pipeline siap.
- Satu kandidat menangani satu file. Path di luar root, traversal, ekstensi tidak sesuai, direktori, symlink file, dan resolusi ke luar root ditolak. Penghapusan tidak rekursif. Direktori media harus hanya dapat diubah proses tepercaya; validasi path bukan pengganti perlindungan filesystem terhadap perubahan eksternal bersamaan.
- File hilang (`ENOENT`) dengan parent yang valid dapat dikosongkan path-nya. Parent hilang/tidak dapat diverifikasi menghasilkan kegagalan konservatif; tidak menghapus metadata.
- Hasil per kandidat `{ id, kind, status }`: `cleaned`, `missing`, `deferred`, atau `failed`. Kegagalan hanya menyertakan kode `UNSAFE_MEDIA_PATH`/`RETENTION_FAILED`, tanpa path privat. Setelah unlink berhasil tetapi pembaruan database gagal, path dipertahankan agar retry menangani file yang sudah hilang. Kandidat lain tetap diproses.

Tes memakai berkas sementara nyata untuk penghapusan/expiry/retry, repository memori untuk klaim/persistensi, dan operasi filesystem pengganti untuk kegagalan serta symlink/junction. Hasil ini tidak membuktikan klaim atomik lintas proses atau keamanan integrasi produksi.

## Langkah berikutnya yang menunggu

1. Jalankan pemeriksaan browser pada `docs/project-link-access.md` dengan akun nyata: login biasa, kembali ke tujuan, buka ulang tab, sesi kedaluwarsa, link rusak, akun lain, dan retry jaringan. Gunakan `localhost:5173`.
2. B/C menyediakan integrasi upload/progres, queue/worker, API klip/media, dan kesepakatan lokasi serta klaim media. A baru menghubungkan adapter retensi/scheduler setelah mekanisme itu tersedia.
3. Uji persistensi dan retensi dengan waktu terkontrol di lingkungan terisolasi, kemudian E2E video nyata sampai preview/unduhan. H-06 tetap terbuka hingga seluruh bukti tersedia.
