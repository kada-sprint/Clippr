# My Project dan akses proyek melalui link

Keputusan produk 14 September 2026: login biasa menuju **My Project** (`/projects`). Pengguna melihat proyek akun aktif terbaru dahulu, mengunggah video baru, membuka proyek lama, atau menghapus proyek nonaktif setelah konfirmasi.

## Routing dan data

- Progres: `/queue?projectId=<UUID>`; hasil/editor: `/editor?projectId=<UUID>`.
- Pipeline aktif menuju progres. Proyek dengan klip menuju editor; proyek tanpa klip menuju progres.
- Upload berhasil menyertakan ID pada URL. Progres mengambil metadata melalui `ProjectAccess` dan context, sehingga refresh tidak memerlukan state navigasi.
- Login dari link kembali ke tujuan semula, termasuk query dan hash. Sidebar progres/editor mempertahankan ID proyek.
- `GET /api/projects` dan `GET /api/projects/:id` menggunakan cookie sesi dan pemeriksaan kepemilikan backend. Daftar/detail menyertakan `isBusy`, tanpa path media privat atau transkrip sumber.
- My Project dan metadata progres melakukan polling setiap 5 detik selama `isBusy`; berhenti setelah selesai, kegagalan request, atau unmount. Kegagalan menyediakan coba lagi. Editor tetap mengambil klip melalui integrasi yang tersedia.
- ID tidak valid, proyek hilang, dan akun lain ditangani oleh pemeriksaan akses; 401 memeriksa sesi ulang. Link akses tidak menggantikan otorisasi preview/unduhan backend.

## My Project dan hapus

- Kartu: `Proyek <8 karakter ID>`, waktu dibuat, status/tahap, layout, jumlah klip. Grid desktop/tablet/mobile: 3/2/1 kolom.
- Aksi satu baris: **Buka Proyek** dan ikon trash dengan rasio `3fr 1fr`, tinggi sama minimal 44 px. Tombol trash memiliki tooltip dan label aksesibel.
- Pipeline aktif, transisi `TRANSCRIBED`, dan klip rendering/processing menonaktifkan hapus. Backend memeriksa ulang saat permintaan diterima.
- Dialog menegaskan penghapusan permanen media, transkrip, klip, ekspor, serta log LLM. Batal mendapat fokus awal; Escape menutup sebelum penghapusan; fokus dikembalikan ke pemicu atau judul daftar jika kartu telah hilang.
- Penghapusan, penerimaan sumber, dan awal render memakai row lock PostgreSQL per proyek. Status `deleting` disimpan sebelum menyentuh berkas agar kegagalan transaksi tidak membuka kembali upload/render. DELETE dapat dicoba ulang pada status ini.
- Pembersihan hanya menyentuh berkas terkelola proyek, termasuk keluaran render gagal dan ASS sementara yang dikenali; tidak menghapus direktori secara rekursif. Path di luar penyimpanan atau melalui symlink ditolak.
- Hapus relasi klip dan log LLM sebelum record proyek. Jika cleanup sebagian gagal, metadata dipertahankan untuk retry; media yang sudah hilang dianggap selesai. UI hanya menghilangkan kartu setelah 204; 404 memuat ulang daftar.
- Retensi otomatis tetap 24 jam untuk sumber/ekspor sesuai waktu upload/render berhasil, dengan metadata/transkrip bertahan. Penghapusan manual eksplisit juga menghapus metadata/transkrip.

## Kepemilikan dan batas verifikasi

A memiliki My Project, autentikasi, akses proyek, dan penghapusan. Patch pendukung yang disetujui terbatas pada URL upload/pemulihan progres milik B dan pengaman awal render milik C. Tidak ada perombakan pipeline atau migrasi schema.

Pengujian backend memakai repository/transaction double serta berkas uji terisolasi; simulasi kunci transaksi bukan bukti konkurensi PostgreSQL/Aiven nyata. Build bukan bukti Google OAuth atau perilaku browser. Pemeriksaan browser perlu mencakup login biasa/link langsung, refresh antrean/editor, kondisi kosong/gagal, polling berhenti, rasio tombol desktop/mobile, dialog keyboard, 404 dari tab lain, dan hapus pada data uji terisolasi.
