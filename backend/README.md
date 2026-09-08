# Backend Cuplik — H-01 Bagian A

Express + JavaScript/CommonJS, Prisma **6.19.3**, PostgreSQL Aiven, dan verifikasi Google ID token. Semua file konfigurasi aplikasi menggunakan JavaScript; schema dan migrasi mengikuti Prisma 6. Tidak menggunakan konfigurasi Prisma 7.

## Menjalankan lokal

Jalankan dari folder `backend` dengan Node.js 22 atau 24:

```powershell
npm ci
# Hanya jika .env belum tersedia:
Copy-Item .env.example .env
npm run db:generate
npm run dev
```

`GET http://localhost:3000/api/health` harus menghasilkan `{"status":"ok"}`. Server terikat ke loopback untuk pengembangan; health hanya memeriksa HTTP, bukan database. Endpoint Google belum mengeluarkan sesi aplikasi. Jangan gunakan H-01 sebagai autentikasi produksi.

## Konfigurasi Aiven (database bersama)

1. Ambil host, port, database, username, password dan CA dari Overview layanan PostgreSQL Aiven.
2. Simpan CA sebagai `backend/certs/ca.pem` dan isi `DATABASE_URL` pada `.env`. Gunakan database/schema yang benar-benar tersedia, bukan nama contoh.
3. URL-encode username/password jika mengandung karakter khusus (misalnya `@` menjadi `%40`, `#` menjadi `%23`). Jangan encode keseluruhan URL.
4. Untuk Prisma 6 pertahankan `sslmode=require&sslaccept=strict&sslcert=../certs/ca.pem`. Lokasi relatif sertifikat dihitung dari `backend/prisma`. Runtime menormalisasikannya menjadi path absolut.
5. Jalankan `npm run db:check`. Pemeriksaan hanya SELECT: TLS aktif, schema efektif, dan keberadaan tiga tabel. Tidak mencetak URI/password dan tidak mengubah database.

Koneksi berhasil tidak membuktikan schema cocok. Jika tabel belum tersedia, autentikasi yang menyimpan pengguna masih akan gagal dengan `DATABASE_UNAVAILABLE`.

**Dua migrasi telah diterapkan ke Aiven bersama (`defaultdb`, schema `public`) setelah persetujuan tim.** `20260908000000_initial` membuat tabel `users`, `projects`, dan `clips`; `20260908010000_add_subtitle_style` menambahkan enum `SubtitleStyle` dan kolom `clips.subtitle_style` wajib dengan default `clean`. Deployment memakai `prisma migrate deploy`; checksum kedua migrasi cocok dengan file lokal dan pemeriksaan schema tidak menemukan perbedaan. File migrasi yang sudah diterapkan tidak boleh diedit. Jangan menjalankan `migrate dev`, `db push`, reset, atau seed terhadap database bersama. Perubahan berikutnya menggunakan migrasi baru, review A/B/C, dan persetujuan penerapan; pengembangan tiap anggota tetap menggunakan database/schema terisolasi.

## Schema dan kebutuhan pipeline berikutnya

`User` dan avatar Google tetap. `Clip.subtitleStyle` menyimpan `clean` (default) atau `active_word_highlight` melalui kolom enum `subtitle_style`. Worker nantinya membaca gaya tersimpan saat render/render ulang.

Aturan retensi yang diselaraskan dengan PRD/FRD:

- `sourceExpiresAt` = waktu upload/upload ulang berhasil +24 jam.
- Penyimpanan edit hanya memperbarui `lastEditActivityAt`, tidak memperpanjang retensi sumber. Polling/unduhan juga tidak memperpanjang retensi.
- Render berhasil menetapkan `renderedAt` dan `exportExpiresAt` +24 jam untuk MP4/SRT klip tersebut.
- Pembersihan mengosongkan path media yang dihapus, mempertahankan metadata/transkrip, dan menunda media yang dipakai job aktif. Render ulang setelah sumber hilang meminta upload ulang sumber asli.

Validasi backend yang wajib dibuat saat pipeline diimplementasikan: maksimal 20 istilah kustom; transkrip per kata berisi `word`, `start_time`, `end_time`, `confidence`; 3–5 hasil kurasi masing-masing 25–75 detik; serta pilihan layout/subtitle yang didukung. **Scheduler retensi dan validasi pipeline belum diimplementasikan.** Tugas ini hanya memperbarui schema, migrasi lokal, dan kontrak dokumentasi.

## Konfigurasi Google

Pada Google Auth Platform pilih client **Web application**. Isi branding dan authorized JavaScript origins `http://localhost` serta `http://localhost:5173`. Redirect URI tidak diperlukan untuk callback JavaScript yang mengirim token ke backend. Gunakan scope identitas dasar, bukan akses Drive/Gmail.

Isi `GOOGLE_CLIENT_ID` dengan client ID berakhiran `.apps.googleusercontent.com`. Client secret tidak diperlukan untuk verifikasi ID token. Restart backend setelah mengubah `.env`.

Frontend produk tidak dibuat oleh backend ini. Untuk tes Google nyata **tanpa perubahan database**, jalankan `npm run google:check`, buka `http://localhost:5173`, lalu klik tombol Google. Script diagnostik memakai verifier service yang sama, tetapi hanya mengembalikan profil terverifikasi tanpa memanggil model/database. `/check-status` pada server diagnostik mengembalikan jumlah verifikasi berhasil tanpa token atau profil. Hentikan diagnostik sebelum menjalankan frontend Vite pada port yang sama. Endpoint diagnostik tidak dipasang oleh `server.js`.

Pada frontend produk nanti, callback menerima `response.credential`, lalu mengirim ke API port 3000:

```javascript
const result = await fetch('http://localhost:3000/api/auth/google', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ credential: response.credential }),
});
```

Client ID bukan ID token. Jangan menempelkan ID token di chat, log, atau shell history. HTTP 200 berisi `{ user: { id, email, displayName, avatarUrl } }`; backend hanya memakai identitas yang sudah diverifikasi. Penyimpanan menggunakan Google `sub`, bukan email, sebagai identitas unik. Profil tidak memberi akses ke resource privat; sesi/middleware lengkap milik H-03.

Tes Google nyata akan melakukan upsert pengguna. Pada database bersama koordinasikan akun uji setelah schema siap. Pemeriksaan koneksi `db:check` tidak melakukan upsert tersebut.

Pengecualian: halaman `google:check` di port 5173 sengaja hanya memverifikasi token dan tidak menguji upsert. Jangan menyatakan persistensi pengguna selesai berdasarkan hasil diagnostik ini.

## Pemeriksaan

```powershell
npm test
npm run db:validate
npm run db:generate
npm run db:check
```

Tes otomatis HTTP/service memakai verifier dan persistence terkontrol; bukan bukti Google/Aiven nyata. Uji live yang masih diperlukan: token Google valid, dua login dengan Google subject sama menghasilkan satu pengguna, koneksi CA yang benar berhasil dan CA yang tidak cocok ditolak, serta kecocokan schema pada database tujuan.

## Bukti verifikasi setup H-01

- Sembilan tes otomatis lulus, termasuk verifier library resmi dengan JWT bertanda tangan lokal (audience, issuer, expiry, dan signature). Ini bukan token dari akun Google nyata.
- Prisma validate/generate berhasil; API lokal health menjawab HTTP 200.
- Query read-only Aiven berhasil dengan TLS; CA yang tidak cocok ditolak. Pada pemeriksaan awal schema `public` belum memiliki `users`, `projects`, atau `clips`.
- Setelah persetujuan tim, kedua migrasi diterapkan melalui `prisma migrate deploy`. Status up to date, schema cocok, checksum SQL cocok, enum/default/nullability gaya subtitle benar, dan ketiga model dapat dibaca melalui Prisma. Tidak ada data uji yang ditulis; verifikasi ini belum membuktikan login Google dan persistensi pengguna end-to-end.
- `npm audit` menemukan tiga entri high pada rantai `prisma -> @prisma/config -> deepmerge-ts` untuk satu advisory [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx). Belum diperbaiki; jangan menjalankan `audit fix --force` karena solusi yang ditawarkan mengubah versi Prisma terkunci. Aplikasi ini tidak menerima konfigurasi Prisma dari request pengguna, tetapi hasil audit tetap menjadi risiko dependency yang perlu ditinjau sebelum deployment.

Sumber: [Google backend verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [Aiven Node.js TLS](https://aiven.io/docs/products/postgresql/howto/connect-node), [Prisma PostgreSQL](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql).
