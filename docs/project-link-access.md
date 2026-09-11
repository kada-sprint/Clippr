# Akses proyek melalui link — fondasi A

Alur aplikasi tetap login → upload → progres → hasil/editor → ekspor, tanpa dashboard atau daftar proyek.

## Format link

- Progres: `/queue?projectId=<UUID proyek>`.
- Hasil/editor: `/editor?projectId=<UUID proyek>`.
- Gunakan ID proyek yang sudah tersimpan; membuka link tidak membuat proyek baru.
- Parameter `projectId` wajib berisi satu UUID. Nilai kosong, rusak, atau berulang ditolak.
- Login biasa menuju `/upload`. Link tujuan dipertahankan melalui state router saat login diperlukan, termasuk query dan hash.
- Navigasi sidebar antara progres dan editor mempertahankan query proyek. Upload memulai alur baru tanpa membawa ID tersebut.

## Perilaku saat ini

Routing milik A memanggil `GET /api/projects/:id` dengan cookie sesi. Backend memeriksa kepemilikan; proyek akun lain dan proyek tidak ditemukan menampilkan pesan yang sama. Respons 401 memicu pemeriksaan sesi ulang. Gangguan jaringan/server menyediakan tombol coba lagi.

Setelah akses berhasil, rute menampilkan status terakhir dari API, tombol muat ulang status, dan salin link. Progres rinci dan hasil editor belum terhubung. Data contoh editor tidak ditampilkan untuk link proyek. Metadata hanya dimuat saat dibuka atau dimuat ulang, belum ada polling progres.

Rute `/queue` dan `/editor` tanpa parameter tetap memakai tampilan lama milik B/C. Tampilan lama tersebut bukan bukti hasil proyek tersimpan.

## Serah terima B/C

A memiliki pemeriksaan akses di `features/projects/ProjectAccess.jsx` dan routing bersama. B/C perlu menyepakati pemakaian format link ini sebelum mengintegrasikan halaman mereka. B menghubungkan link setelah proyek dibuat/upload; C menghubungkan hasil dan editor ke data klip nyata. Saat integrasi, ganti tampilan sementara setelah akses berhasil dengan halaman terkait. Pemeriksaan ini tidak menggantikan otorisasi backend pada setiap akses klip, preview, dan unduhan.

## Pemeriksaan manual

Gunakan `http://localhost:5173` dan ID proyek milik akun uji yang sudah ada.

1. Buka link proyek saat sudah login, muat ulang halaman, lalu tutup tab dan buka kembali link tersimpan: proyek yang sama harus dimuat.
2. Buka link ketika belum login: login harus kembali ke path, query, dan hash semula. Login tanpa tujuan tetap menuju upload.
3. Buka proyek akun A dengan akun B serta UUID yang tidak ada: keduanya menampilkan “Proyek tidak tersedia” tanpa metadata.
4. Coba `?projectId=`, `?projectId=rusak`, dan dua parameter `projectId`: tampilkan link tidak valid.
5. Saat proyek terbuka, pindah progres/editor lewat sidebar: ID harus tetap ada dan data contoh tidak muncul.
6. Simulasikan kegagalan request pada lingkungan uji, lalu coba lagi: data lama tidak boleh tetap terlihat. Sesi kedaluwarsa harus meminta login kembali ke tujuan semula.
7. Salin link, lalu buka hasil salinannya. Jika clipboard ditolak, tampilkan petunjuk menyalin alamat browser.

Tes backend dengan repository uji membuktikan kontrak autentikasi/kepemilikan; build frontend hanya membuktikan bundling. Google login, pembukaan ulang tab, dan akses dua akun nyata tetap memerlukan pemeriksaan browser.
