**FUNCTIONAL REQUIREMENTS DOCUMENT**

*Sistem Automasi Video Repurposing "Cuplik" Berbasis Konsep Utuh (MVP)*

| *Dokumen Spesifikasi Fungsional (FRD) ini mendefinisikan arsitektur modular, alur kerja full-stack berbasis fitur, skema persistensi, dan pembagian tugas untuk Tim Capstone 3 Orang (Orang A, Orang B, Orang C). Tim bekerja secara vertikal per fitur (feature-by-feature) untuk mempercepat integrasi dan meminimalkan ketergantungan antar perancang.* |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 1. Informasi Dokumen & Metadata

Dokumen ini berfungsi sebagai baseline teknis final untuk eksekusi sprint pengembangan aplikasi Cuplik. Seluruh tim berkomitmen untuk bekerja dalam lingkup (in-scope) yang telah ditentukan demi memitigasi kegagalan pengiriman tepat waktu.

| **Nama Aplikasi**   | Cuplik (AI-Powered Video Repurposing for Webinars)                                 |
|---------------------|------------------------------------------------------------------------------------|
| **Versi Dokumen**   | v2.0 (Baseline Kerja Per-Fitur 3 Orang)                                            |
| **Tanggal Terbit**  | 8 September 2026                                                                   |
| **Durasi Proyek**   | 9 Hari Kalender (Sprint Capstone Padat)                                            |
| **Model Kerja**     | Vertical Feature Slicing (Full-Stack Responsibility)                               |
| **Status**          | Approved for Sprint Execution                                                      |
| **Target Pengguna** | Trainer Independen, Konsultan Edukasi, Tim Marketing Lembaga Pelatihan (Indonesia) |

**Stack yang disepakati:** frontend React + Vite, backend Express, JavaScript/JSX tanpa TypeScript, PostgreSQL di Aiven dengan Prisma, serta BullMQ + Redis dan worker Node.js terpisah untuk FFmpeg/AI. Versi Prisma dikunci saat setup; schema, konfigurasi, dan migrasi mengikuti versi tersebut. Koneksi Aiven menggunakan TLS dengan verifikasi sertifikat.

# 2. Visi Produk & Filosofi "Concept Completeness"

Cuplik lahir untuk memecahkan masalah friction kognitif dan teknis tinggi yang dihadapi oleh trainer independen di Indonesia. Menonton ulang materi webinar 60 menit hanya untuk mengekstrak 1 menit klip vertikal berkualitas menghabiskan waktu produktif hingga 1 jam penuh. Melalui model otomasi berbasis kecerdasan buatan, Cuplik memangkas durasi ini menjadi kurang dari sepertiga durasi video asli.

Berbeda dari kompetitor global (seperti Opus.pro) yang menggunakan metrik viralitas instan (viral triggers, ekspresi ekstrim, clickbait), Cuplik menetapkan keunggulan bersaing melalui metrik **Kelengkapan Konsep Ajar (Concept Completeness Score)**. Klip hasil kurasi Cuplik harus memiliki struktur ajar mandiri yang terdiri dari:

> · **Pembuka Kontekstual:** Pengajar mendefinisikan masalah, premis dasar, atau melontarkan pertanyaan kunci.
>
> · **Elaborasi / Solusi:** Penjelasan rinci mengenai konsep utama, visualisasi slide, analogi cerdas, atau demonstrasi konkret.
>
> · **Kesimpulan Mandiri:** Klip diselesaikan dengan kesimpulan utuh, tidak terpotong di tengah kalimat, sehingga bernilai edukatif tinggi tanpa memaksa audiens menonton sisa webinar.

# 3. Pembagian Kerja Berbasis Fitur (Feature Slicing Model)

Untuk mengoptimalkan kapasitas tim 3 orang dalam tenggat waktu 9 hari yang sangat ketat, tim menolak pembagian tradisional berbasis peran statis (misal: satu orang hanya backend, satu orang hanya frontend). Sebaliknya, setiap anggota tim memegang tanggung jawab penuh secara vertikal (**Full-Stack Feature Ownership**) atas fitur spesifik dari hulu ke hilir (mendesain database, menulis API, memproses logika server, hingga menyusun komponen UI).

Keuntungan utama model ini adalah meminimalkan hambatan komunikasi API, mengeliminasi merge-conflict berlebih pada Git, dan mempercepat debugging karena satu orang menguasai siklus hidup penuh dari fitur yang ia buat.

<table>
<colgroup>
<col style="width: 24%" />
<col style="width: 17%" />
<col style="width: 30%" />
<col style="width: 27%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Nama Fitur Utama</strong></th>
<th><strong>Pemilik (PIC)</strong></th>
<th><strong>Komponen Teknis Backend &amp; DB</strong></th>
<th><strong>Komponen Teknis Frontend / UI</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>Fitur 1: Portal Akses, Google OAuth, &amp; Dashboard Proyek</strong></td>
<td><strong>Orang A</strong></td>
<td>1. Database schema (PostgreSQL di Aiven dengan Prisma) untuk tabel Users, Projects, Clips.<br />
2. Alur integrasi Google OAuth 2.0 Backend Token Verification.<br />
3. API Endpoints: CRUD Project metadata.<br />
4. Cron-job pembersihan berkas &amp; retensi data.</td>
<td>1. Integrasi Google OAuth 2.0 SDK Klien.<br />
2. Halaman Login minimalis.<br />
3. UI Dashboard Proyek (daftar draf video aktif, status pengerjaan asinkron, opsi hapus/edit proyek).</td>
</tr>
<tr class="header">
<td><strong>Fitur 2: Ingest Validasi, Ekstraksi Audio, &amp; Mesin Transkripsi (ASR)</strong></td>
<td><strong>Orang B</strong></td>
<td>1. Upload API dengan limitasi file (mp4/mov, &lt;1GB, &lt;45 mnt).<br />
2. Script penanganan FFmpeg ekstraksi audio (WAV/MP3 16kHz Mono).<br />
3. Integrasi SDK STT (Whisper/AssemblyAI) untuk word-level timestamps.<br />
4. Integrasi payload kustom kamus istilah (maks 20 kata).</td>
<td>1. Form Pengunggahan Video dengan drag-and-drop.<br />
2. Form Input Kamus Istilah Teknis.<br />
3. Visual Selector 3 Template Layout (Slide+Cam, Talking-Head, Slide Saja).<br />
4. UI Progress Bar Antrean Asinkron Real-time (WebSocket / Polling 5s).</td>
</tr>
<tr class="odd">
<td><strong>Fitur 3: AI Curation, FFmpeg Vertikal Reframe, &amp; Editor Interaktif</strong></td>
<td><strong>Orang C</strong></td>
<td>1. API Prompting LLM dengan skema validasi keluaran JSON.<br />
2. FFmpeg Video Reframe Engine (Template A, B, C).<br />
3. FFmpeg Subtitle Burner (Clean &amp; Highlight ASS filter).<br />
4. API Endpoint Delta Re-render parsial klip tunggal.<br />
5. API Export Kit (Video MP4 9:16 + Berkas .SRT).<br />
6. Koordinasi fondasi BullMQ/Redis dan entry point worker bersama; implementasi tahap kurasi/render.</td>
<td>1. UI Tampilan Kartu Klip Hasil Kurasi (preview video, usulan judul, concept score).<br />
2. UI Web Editor Ringan (nudge slider interval 0.5s).<br />
3. UI In-Place Subtitle Text Correction (inline text editor).<br />
4. Tombol Ekspor MP4 &amp; SRT.</td>
</tr>
</tbody>
</table>

**Koordinasi pipeline:** C menyiapkan fondasi queue/worker pada H-02. B mengimplementasikan job ingest/ekstraksi audio/transkripsi, C mengimplementasikan kurasi/render/render ulang, dan A mengoordinasikan persistensi status serta schema Prisma. Ketiganya menyepakati payload job dan status pada H-01. Bantuan lintas fitur harus menyebut pemilik utama, anggota pendukung, dan file yang dikerjakan.

# 4. Spesifikasi Skema Database Relasional

Untuk mendukung kebutuhan login dan penyimpanan proyek draf video secara persisten, Cuplik mengimplementasikan sistem database relasional dengan skema terpusat sebagai berikut:

<table>
<colgroup>
<col style="width: 25%" />
<col style="width: 36%" />
<col style="width: 37%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Nama Tabel</strong></th>
<th><strong>Atribut / Kolom Utama</strong></th>
<th><strong>Keterangan &amp; Relasi</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>users</strong></td>
<td>• id (PK - Google ID)<br />
• email (VARCHAR)<br />
• display_name (VARCHAR)<br />
• avatar_url (TEXT)<br />
• created_at (TIMESTAMP)</td>
<td>Menyimpan data identitas unik pengguna hasil verifikasi token Google OAuth 2.0.</td>
</tr>
<tr class="header">
<td><strong>projects</strong></td>
<td>• id (PK - UUID)<br />
• user_id (FK -&gt; users.id)<br />
• source_video_path (TEXT)<br />
• selected_layout (VARCHAR)<br />
• custom_vocabulary (TEXT)<br />
• status (VARCHAR: processing/idle/error)<br />
• processing_stage (VARCHAR: ingest/transcribe/analyze/render; nullable)<br />
• transcript_json (JSONB - transkrip sumber lengkap per kata; nullable)<br />
• last_edit_activity_at (TIMESTAMP)<br />
• source_expires_at (TIMESTAMP)<br />
• created_at (TIMESTAMP)</td>
<td>Menampung metadata satu berkas video webinar yang diunggah pengguna. Terhubung langsung ke data user pemroses.</td>
</tr>
<tr class="odd">
<td><strong>clips</strong></td>
<td>• id (PK - UUID)<br />
• project_id (FK -&gt; projects.id)<br />
• title (VARCHAR)<br />
• subtitle_style (ENUM SubtitleStyle: clean/active_word_highlight; NOT NULL, default clean)<br />
• start_time (DECIMAL)<br />
• end_time (DECIMAL)<br />
• transcript_json (JSONB - Word Level)<br />
• concept_score (DECIMAL)<br />
• pedagogical_reason (TEXT)<br />
• clip_video_path (TEXT)<br />
• srt_path (TEXT)<br />
• status (VARCHAR: pending/rendering/rendered/error)<br />
• rendered_at (TIMESTAMP; nullable)<br />
• export_expires_at (TIMESTAMP; nullable)</td>
<td>Menyimpan segmen-segmen klip rekomendasi LLM. Menyimpan metadata penyuntingan subtitle kata demi kata dan timestamp kustom pasca-edit.</td>
</tr>
</tbody>
</table>

**Aturan persistensi:** saat upload/upload ulang sumber asli berhasil, `last_edit_activity_at` diisi waktu upload dan `source_expires_at` ditetapkan 24 jam kemudian. Penyimpanan edit judul, subtitle, gaya subtitle, atau batas klip hanya memperbarui `last_edit_activity_at`, tidak memperpanjang `source_expires_at`. Polling dan unduhan tidak memperpanjang retensi. Render yang berhasil menetapkan `rendered_at` dan `export_expires_at` 24 jam kemudian untuk MP4/SRT klip tersebut. Setelah berkas kedaluwarsa dihapus, path terkait menjadi null; metadata dan transkrip tetap tersimpan. Jangan menghapus media yang sedang dipakai job aktif; lakukan pembersihan setelah job selesai.

**Gaya subtitle dan validasi backend:** `Clip.subtitleStyle` dipetakan ke `subtitle_style` dengan nilai `clean` atau `active_word_highlight`, default `clean`. Worker memakai pilihan tersimpan saat render/render ulang. Backend wajib memvalidasi maksimal 20 istilah kustom, struktur transkrip per kata (`word`, `start_time`, `end_time`, `confidence`), 3–5 hasil kurasi masing-masing 25–75 detik, dan pilihan layout/subtitle yang didukung. Scheduler retensi serta validasi pipeline ini merupakan kebutuhan tahap berikutnya, belum diimplementasikan oleh setup schema H-01.

Schema ini merupakan baseline kebutuhan. Migrasi awal dan tambahan gaya subtitle telah diterapkan ke Aiven bersama setelah persetujuan tim; bukti deployment dicatat pada README backend. A mengoordinasikan perubahan schema dan review migrasi; setiap anggota menggunakan database/schema pengembangan terisolasi. Migrasi berikutnya pada database bersama tetap memerlukan persetujuan eksplisit tim; migrasi yang sudah diterapkan tidak boleh diedit.

# 5. Persyaratan Non-Fungsional (NFR) & Kebijakan Data

**NFR-1: Processing Latency.** Total waktu pemrosesan video berdurasi 45 menit tidak boleh melebihi 1/3 durasi aslinya (\< 15 menit). Hal ini menjamin pengguna tidak menunggu terlalu lama pada antrean asinkron.

**NFR-2: Queue Isolation & Reliability.** Video rendering dan tugas berat FFmpeg wajib berjalan di background worker terisolasi (BullMQ + Redis dengan worker Node.js pada VPS) dan dilarang keras berjalan di thread server web utama atau fungsi serverless berbasis timeout.

**NFR-3: Kebijakan Retensi 24 Jam (Penyesuaian PRD).** Video sumber (.mp4/.mov) kedaluwarsa 24 jam setelah upload/upload ulang berhasil; ekspor MP4/SRT kedaluwarsa 24 jam setelah render berhasil. Edit, polling, dan unduhan tidak memperpanjang masa retensi. Pembersihan menunda media yang dipakai job aktif sampai job selesai, menghapus berkas kedaluwarsa, dan mengosongkan path tanpa menghapus metadata atau transkrip. Jika sumber sudah hilang, render ulang meminta upload ulang sumber asli ke proyek bersangkutan. Aturan ini menggantikan kebijakan retensi sebelumnya.

**NFR-4: UI Responsiveness.** Antarmuka frontend wajib memperbarui status pemrosesan (Ingest -\> Transcribe -\> Analyze -\> Render) secara asinkron dengan visual update real-time via long-polling interval 5 detik atau koneksi WebSocket.

# 6. Penanganan Risiko & Jalur Kontinjensi Hari-1

| **Risiko Teridentifikasi**                                                                          | **Tingkat Dampak** | **Strategi Mitigasi & Jalur Kontinjensi**                                                                                                                                                                                                                                                             |
|-----------------------------------------------------------------------------------------------------|--------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Tingkat akurasi transkripsi (WER) Bahasa Indonesia tinggi pada istilah teknis.**                  | **Fatal**          | Day-1 Gate Check: Orang B & Orang C menjalankan skrip benchmark ASR terpilih dengan 3 audio riil. Jika WER \> 25%, otomatis matikan fitur zero-touch burned subtitles. Alihkan model di mana pengguna harus menyunting transkrip teks secara manual di editor review sebelum render video dijalankan. |
| **Rendering FFmpeg mengalami kegagalan Out-Of-Memory (OOM) atau timeout di server.**                | **Tinggi**         | Gunakan VPS dedicated mandiri (misal: DigitalOcean 4-Core 8GB RAM). Batasi eksekusi render-ulang parsial (Delta Re-render) agar hanya memproses segmen klip 25-75 detik tunggal yang diubah, alih-alih merender seluruh batch ulang.                                                                  |
| **Penyusupan cakupan (scope creep) oleh tim penguji (fitur stiker, multi-track timeline, b-roll).** | **Sedang**         | Tolak secara tegas seluruh usulan fitur tambahan yang melanggar kontrak scope PRD Bab 7. Fokus penuh pada otomasi concept-completeness, layout 9:16 statis, subtitle burner, & delta re-render.                                                                                                       |

# 7. Jadwal Kerja Harian & Daily Tracker 9 Hari (Kerja Per-Fitur)

Dengan mengalihkan model kerja dari spesialisasi peran ke pengembangan per-fitur vertikal, ketiga anggota tim dapat bekerja secara simultan tanpa saling memblokir satu sama lain:

<table>
<colgroup>
<col style="width: 10%" />
<col style="width: 29%" />
<col style="width: 28%" />
<col style="width: 31%" />
</colgroup>
<thead>
<tr class="header">
<th><strong>Hari</strong></th>
<th><strong>Fokus Orang A<br />
(Fitur Portal &amp; DB - Fullstack)</strong></th>
<th><strong>Fokus Orang B<br />
(Fitur Ingest &amp; ASR - Fullstack)</strong></th>
<th><strong>Fokus Orang C<br />
(Fitur AI, Render &amp; Editor - Fullstack)</strong></th>
</tr>
</thead>
<tbody>
<tr class="odd">
<td><strong>H-01</strong></td>
<td>Setup PostgreSQL Aiven dan schema Prisma Users, Projects, Clips. Konfigurasi awal Google OAuth backend dan Google Sign-In frontend. Bersama B/C menyepakati kontrak API, payload job, status, dan retensi.</td>
<td>Inisiasi struktur modul frontend/backend untuk Fitur Ingest &amp; ASR. Bersama Orang C mengevaluasi WER ASR Bahasa Indonesia.</td>
<td>Pembuatan skrip benchmarking ASR dan evaluasi bersama B dengan audio riil. Mengumpulkan dataset webinar; menyepakati payload pipeline bersama A/B.</td>
</tr>
<tr class="header">
<td><strong>H-02</strong></td>
<td>Menulis REST API endpoints untuk Dashboard Proyek (CRUD Project Metadata &amp; status polling endpoint). Pembuatan UI Dashboard Proyek (tampilan kartu draf video aktif, tombol "Buat Cuplikan Baru", status proyek).</td>
<td>Menyiapkan struktur awal UI dan workflow Fitur Ingest &amp; ASR untuk proses upload dan transkripsi.</td>
<td>Menyiapkan fondasi BullMQ/Redis dan entry point worker Node.js terpisah untuk pipeline bersama. Memverifikasi job sederhana dan persistensi status bersama A/B. Merancang prompt kurasi serta validator keluaran JSON.</td>
</tr>
<tr class="odd">
<td><strong>H-03</strong></td>
<td>Menyelesaikan halaman Login dan alur Google OAuth client-backend, termasuk middleware autentikasi dan pemeriksaan kepemilikan proyek/klip.</td>
<td>Menulis API Upload Video yang mendukung multipart form-data beserta validasi strict (mp4/mov, &lt;1GB, &lt;45 mnt). Pembuatan UI Form Pengunggahan Video dengan fungsionalitas drag-and-drop, input kamus kustom, &amp; selector 3 layout.</td>
<td>Menghubungkan LLM ke provider yang dipilih, memvalidasi keluaran segmen, dan membuat UI kartu klip untuk menampilkan hasil kurasi.</td>
</tr>
<tr class="header">
<td><strong>H-04</strong></td>
<td>Mengintegrasikan Dashboard dengan CRUD metadata dan status proyek. Menyiapkan cron-job retensi serta koordinasi akses media dengan B/C.</td>
<td>Implementasi ekstraksi audio FFmpeg pada worker ingest milik B. Menghubungkan upload ke API dan queue, serta menampilkan upload progress.</td>
<td>Menulis modul rendering video vertikal FFmpeg untuk 3 Layout Template (Template A: Slide+Cam, B: Talking-head, C: Slide Saja).</td>
</tr>
<tr class="odd">
<td><strong>H-05</strong></td>
<td>Memverifikasi persistensi proyek/klip, status asinkron, dan retensi sumber/ekspor dengan waktu uji yang dikontrol.</td>
<td>Integrasi API ASR (word-level timestamps) ke workflow backend dan menyatukan data transkrip hasil upload. Pembuatan UI Halaman Antrean Status Proses (tahap Ingest, Transcribe, Curation, Rendering) dengan visual polling 5 detik.</td>
<td>Mengintegrasikan subtitle ASS Clean/Active Word Highlight pada worker render. Memulai editor batas waktu dan koreksi subtitle.</td>
</tr>
<tr class="header">
<td><strong>H-06</strong></td>
<td>Pengujian E2E autentikasi dan kepemilikan pada seluruh API, preview, dan unduhan; mendukung integrasi pipeline bersama B/C.</td>
<td>Integrasi Upload -> Audio Extraction -> ASR dan custom vocabulary. Bersama C menghubungkan transkrip ke kurasi/render dan memverifikasi UI progres seluruh tahap.</td>
<td>Menyelesaikan editor dan API delta re-render per klip, menghubungkan penyimpanan edit ke job render ulang. Bersama B memverifikasi pipeline sampai preview hasil.</td>
</tr>
<tr class="odd">
<td><strong>H-07</strong></td>
<td>Regression test Portal, OAuth, CRUD Project, Dashboard, dan retensi. Membantu verifikasi integrasi penuh bersama B/C.</td>
<td>Regression test ingest/ASR, kegagalan job, dan progres. Membantu pengujian pipeline lengkap sampai edit dan ekspor.</td>
<td>Menyelesaikan API Export Kit dan tombol unduh MP4/SRT. Memverifikasi edit -> render ulang satu klip -> ekspor tanpa merender ulang klip lain. Menuntaskan integrasi dan verifikasi deployment worker sebelum user testing.</td>
</tr>
<tr class="header">
<td><strong>H-08</strong></td>
<td>Mendampingi user testing untuk Portal, autentikasi, proyek, dan retensi; memperbaiki temuan pada fitur A.</td>
<td>Mendampingi user testing untuk upload/ASR dan progres; memperbaiki temuan pada fitur B.</td>
<td>Memimpin user testing bersama 5 trainer menggunakan 10 video pada alur yang telah terintegrasi. Mengukur hasil dan memperbaiki temuan kurasi, editor, render, dan ekspor.</td>
</tr>
<tr class="odd">
<td><strong>H-09</strong></td>
<td>Final regression test Portal, database, dan cron-job retensi; memastikan metadata tetap ada setelah media kedaluwarsa. Code freeze setelah pemeriksaan.</td>
<td>Final regression test Fitur Ingest &amp; ASR serta memastikan proses transkripsi dan antrean stabil sebelum code freeze.</td>
<td>Final regression test klip, render ulang, ekspor, dan safe-zone subtitle. Menyelesaikan metrik, slide, serta rekaman demo; code freeze setelah pemeriksaan.</td>
</tr>
</tbody>
</table>

*Catatan Milestone: Seluruh pekerjaan Sprint 1 (Hari 1-5) ditargetkan untuk merampungkan mesin modular secara mandiri dan tervalidasi. Penggabungan penuh (E2E Integration) dimulai sejak awal Sprint 2 (Hari 6).*

# 8. Definition of Ready (DoR) & Done (DoD) Berbasis Fitur

**8.1 Definition of Ready (DoR) - Fitur Vertikal**

Sebuah backlog fitur dianggap siap (Ready) untuk dimasukkan ke sprint jika memenuhi kriteria berikut:

> · Skema database pendukung fitur telah dirancang dan disetujui bersama oleh tim.
>
> · Kriteria penerimaan (Acceptance Criteria) didefinisikan secara kuantitatif (misal: durasi rendering \< 60 detik).
>
> · Dependensi eksternal (API Key, package Node.js/JavaScript, package FFmpeg) sudah terverifikasi dapat berjalan di lingkungan lokal.

**8.2 Definition of Done (DoD) - Fitur Vertikal**

Sebuah backlog fitur dianggap selesai (Done) secara vertikal apabila:

> · API endpoints backend dan komponen UI frontend untuk fitur tersebut terhubung penuh (tidak menggunakan data statis/mock).
>
> · Perubahan data tersimpan dengan benar di skema database (User, Project, atau Clips) dan tersinkronisasi.
>
> · Kode telah melewati pengujian manual menggunakan 3 sampel video webinar riil dari dataset uji tanpa crash.
>
> · Pull Request telah direview silang oleh setidaknya satu anggota tim lainnya dan disetujui masuk ke branch utama.
