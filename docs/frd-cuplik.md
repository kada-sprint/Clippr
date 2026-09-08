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

# 2. Visi Produk & Filosofi "Concept Completeness"

Cuplik lahir untuk memecahkan masalah friction kognitif dan teknis tinggi yang dihadapi oleh trainer independen di Indonesia. Menonton ulang materi webinar 60 menit hanya untuk mengekstrak 1 menit klip vertikal berkualitas menghabiskan waktu produktif hingga 1 jam penuh. Melalui model otomasi berbasis kecerdasan buatan, Cuplik memangkas durasi ini menjadi kurang dari sepertiga durasi video asli.

Berbeda dari kompetitor global (seperti Opus.pro) yang menggunakan metrik viralitas instan (viral triggers, ekspresi ekstrim, clickbait), Cuplik menetapkan keunggulan bersaing melalui metrik **Kelengkapan Konsep Ajar (Concept Completeness Score)**. Klip hasil kurasi Cuplik harus memiliki struktur ajar mandiri yang terdiri dari:

- **Pembuka Kontekstual:** Pengajar mendefinisikan masalah, premis dasar, atau melontarkan pertanyaan kunci.

- **Elaborasi / Solusi:** Penjelasan rinci mengenai konsep utama, visualisasi slide, analogi cerdas, atau demonstrasi konkret.

- **Kesimpulan Mandiri:** Klip diselesaikan dengan kesimpulan utuh, tidak terpotong di tengah kalimat, sehingga bernilai edukatif tinggi tanpa memaksa audiens menonton sisa webinar.

# 3. Pembagian Kerja Berbasis Fitur (Feature Slicing Model)

Untuk mengoptimalkan kapasitas tim 3 orang dalam tenggat waktu 9 hari yang sangat ketat, tim menolak pembagian tradisional berbasis peran statis (misal: satu orang hanya backend, satu orang hanya frontend). Sebaliknya, setiap anggota tim memegang tanggung jawab penuh secara vertikal (**Full-Stack Feature Ownership**) atas fitur spesifik dari hulu ke hilir (mendesain database, menulis API, memproses logika server, hingga menyusun komponen UI).

Keuntungan utama model ini adalah meminimalkan hambatan komunikasi API, mengeliminasi merge-conflict berlebih pada Git, dan mempercepat debugging karena satu orang menguasai siklus hidup penuh dari fitur yang ia buat.

<table>
<colgroup>
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
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
<td>1. Database schema (PostgreSQL/SQLite) untuk tabel Users, Projects, Clips.<br />
2. Alur integrasi Google OAuth 2.0 Backend Token Verification.<br />
3. API Endpoints: CRUD Project metadata.<br />
4. Cron-job pembersihan berkas &amp; retensi data.</td>
<td>1. Integrasi Google OAuth 2.0 SDK Klien.<br />
2. Halaman Login minimalis.<br />
3. UI Dashboard Proyek (daftar draf video aktif, status pengerjaan asinkron, opsi hapus/edit proyek).</td>
</tr>
<tr class="even">
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
5. API Export Kit (Video MP4 9:16 + Berkas .SRT).</td>
<td>1. UI Tampilan Kartu Klip Hasil Kurasi (preview video, usulan judul, concept score).<br />
2. UI Web Editor Ringan (nudge slider interval 0.5s).<br />
3. UI In-Place Subtitle Text Correction (inline text editor).<br />
4. Tombol Ekspor MP4 &amp; SRT.</td>
</tr>
</tbody>
</table>

# 4. Spesifikasi Skema Database Relasional

Untuk mendukung kebutuhan login dan penyimpanan proyek draf video secara persisten, Cuplik mengimplementasikan sistem database relasional dengan skema terpusat sebagai berikut:

<table>
<colgroup>
<col style="width: 33%" />
<col style="width: 33%" />
<col style="width: 33%" />
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
<tr class="even">
<td><strong>projects</strong></td>
<td>• id (PK - UUID)<br />
• user_id (FK -&gt; users.id)<br />
• source_video_path (TEXT)<br />
• selected_layout (VARCHAR)<br />
• custom_vocabulary (TEXT)<br />
• status (VARCHAR: processing/idle/error)<br />
• created_at (TIMESTAMP)</td>
<td>Menampung metadata satu berkas video webinar yang diunggah pengguna. Terhubung langsung ke data user pemroses.</td>
</tr>
<tr class="odd">
<td><strong>clips</strong></td>
<td>• id (PK - UUID)<br />
• project_id (FK -&gt; projects.id)<br />
• title (VARCHAR)<br />
• start_time (DECIMAL)<br />
• end_time (DECIMAL)<br />
• transcript_json (JSONB - Word Level)<br />
• concept_score (DECIMAL)<br />
• pedagogical_reason (TEXT)<br />
• clip_video_path (TEXT)<br />
• srt_path (TEXT)<br />
• status (VARCHAR: pending/rendered/error)</td>
<td>Menyimpan segmen-segmen klip rekomendasi LLM. Menyimpan metadata penyuntingan subtitle kata demi kata dan timestamp kustom pasca-edit.</td>
</tr>
</tbody>
</table>

# 5. Persyaratan Non-Fungsional (NFR) & Kebijakan Data

**NFR-1: Processing Latency.** Total waktu pemrosesan video berdurasi 45 menit tidak boleh melebihi 1/3 durasi aslinya (\< 15 menit). Hal ini menjamin pengguna tidak menunggu terlalu lama pada antrean asinkron.

**NFR-2: Queue Isolation & Reliability.** Video rendering dan tugas berat FFmpeg wajib berjalan di background worker terisolasi (Redis Queue + Celery/BullMQ pada VPS) dan dilarang keras berjalan di thread server web utama atau fungsi serverless berbasis timeout.

**NFR-3: Kebijakan Retensi Berjenjang (Pembaruan v2.0).** Mengingat keterbatasan penyimpanan VPS, berkas video mentah berukuran besar (.mp4/.mov) akan dihapus otomatis secara permanen jika tidak ada aktivitas penyuntingan dalam waktu 7 hari kalender. File ekspor klip vertikal hasil render dihapus dalam 3 hari. Namun, seluruh entri database (skema draf, transkrip JSON, judul kustom, metadata edit) akan disimpan secara permanen. Jika pengguna ingin merender ulang klip setelah 7 hari, sistem akan meminta pengguna mengunggah kembali video sumber asli ke proyek bersangkutan.

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
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
<col style="width: 25%" />
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
<td>Setup Database relasional (PostgreSQL/SQLite) dengan tabel Users, Projects, Clips. Konfigurasi awal Google OAuth 2.0 backend flow.</td>
<td>Inisiasi repositori git &amp; folder proyek frontend. Mengintegrasikan Google Sign-In SDK pada tampilan web. [Bersama Orang C mengevaluasi WER ASR ID]</td>
<td>Pembuatan skrip benchmarking ASR otomatis. Mengumpulkan dataset webinar riil bersama 5 penguji untuk diujikan pada Day-1 Gate.</td>
</tr>
<tr class="even">
<td><strong>H-02</strong></td>
<td>Menulis REST API endpoints untuk Dashboard Proyek (CRUD Project Metadata &amp; status polling endpoint).</td>
<td>Pembuatan UI Dashboard Proyek (tampilan kartu draf video aktif, tombol 'Buat Cuplikan Baru', status proyek).</td>
<td>Merancang prompt LLM Concept-Based Selection. Menulis skema validator JSON dan regex-fallback parser.</td>
</tr>
<tr class="odd">
<td><strong>H-03</strong></td>
<td>Menulis API Upload Video yang mendukung multipart form-data beserta validasi strict (mp4/mov, &lt;1GB, &lt;45 mnt).</td>
<td>Pembuatan UI Form Pengunggahan Video dengan fungsionalitas drag-and-drop, input kamus kustom, &amp; selector 3 layout.</td>
<td>Menghubungkan prompt LLM ke API provider (OpenAI/Anthropic) dan memvalidasi payload hasil keluaran segmen.</td>
</tr>
<tr class="even">
<td><strong>H-04</strong></td>
<td>Implementasi modul pemrosesan audio backend (FFmpeg ekstrasi WAV/MP3 mono 16 kHz) untuk kompresi file sebelum STT.</td>
<td>Integrasi client-side upload form ke API Upload backend. Menangani visual feedback upload progress.</td>
<td>Menulis modul rendering video vertikal FFmpeg untuk 3 Layout Template (Template A: Slide+Cam, B: Talking-head, C: Slide Saja).</td>
</tr>
<tr class="odd">
<td><strong>H-05</strong></td>
<td>Integrasi API ASR (Word-level timestamps) ke workflow backend. Menyatukan data transkrip hasil upload.</td>
<td>Pembuatan UI Halaman Antrean Status Proses (tahap Ingest, Transcribe, Curation, Rendering) dengan visual polling 5 detik.</td>
<td>Menulis filter graph subtitle burner (ASS) di server untuk mengaplikasikan gaya Clean &amp; Active Word Highlight secara sinkron.</td>
</tr>
<tr class="even">
<td><strong>H-06</strong></td>
<td>Menghubungkan Google OAuth JWT Token secara E2E di backend untuk melindungi rute API database proyek dan klip.</td>
<td>Pembangunan UI Kartu Klip Hasil Kurasi (video preview player, usulan judul, skor konsep, pedagogical reason, status render).</td>
<td>Desain dan implementasi komponen Web Editor Ringan (stepper nudge boundary 0.5s &amp; in-place text editor subtitle).</td>
</tr>
<tr class="odd">
<td><strong>H-07</strong></td>
<td>Menulis API Delta Re-render parsial untuk memproses ulang segmen tunggal yang mengalami perubahan waktu/teks.</td>
<td>Menghubungkan interaksi editor (nudge &amp; inline edit) ke API Delta Re-render backend untuk merender ulang klip terpilih.</td>
<td>Membangun API Export Kit (pembuatan nama file yang rapi, tombol pengunduhan MP4 9:16 &amp; ekspor berkas teks .SRT terpisah).</td>
</tr>
<tr class="even">
<td><strong>H-08</strong></td>
<td>Menyiapkan Redis Queue &amp; background workers (Celery/BullMQ) pada VPS dedicated. Mengoptimalkan performa beban rendering.</td>
<td>Menyambungkan visual export kit pada frontend. Melakukan final testing integrasi web dashboard penuh.</td>
<td>Memimpin dan memfasilitasi user testing bersama 5 trainer independen menggunakan 10 video untuk mengumpulkan metrik pengujian.</td>
</tr>
<tr class="odd">
<td><strong>H-09</strong></td>
<td>Implementasi cron-job pembersihan berkas temporer (retensi video mentah 7 hari, hasil ekspor 3 hari). Hard code freeze.</td>
<td>Melakukan review visual safe-zone subtitle (bebas area tombol TikTok/Reels) dan perekaman video demo cadangan (3 menit).</td>
<td>Menyusun grafik metrik keberhasilan (WER, stopwatch efisiensi waktu, kuesioner repeat usage) dan menyelesaikan slide presentasi.</td>
</tr>
</tbody>
</table>

*Catatan Milestone: Seluruh pekerjaan Sprint 1 (Hari 1-5) ditargetkan untuk merampungkan mesin modular secara mandiri dan tervalidasi. Penggabungan penuh (E2E Integration) dimulai sejak awal Sprint 2 (Hari 6).*

# 8. Definition of Ready (DoR) & Done (DoD) Berbasis Fitur

**8.1 Definition of Ready (DoR) - Fitur Vertikal**

Sebuah backlog fitur dianggap siap (Ready) untuk dimasukkan ke sprint jika memenuhi kriteria berikut:

- Skema database pendukung fitur telah dirancang dan disetujui bersama oleh tim.

- Kriteria penerimaan (Acceptance Criteria) didefinisikan secara kuantitatif (misal: durasi rendering \< 60 detik).

- Dependensi eksternal (API Key, library Python, package FFmpeg) sudah terverifikasi dapat berjalan di lingkungan lokal.

**8.2 Definition of Done (DoD) - Fitur Vertikal**

Sebuah backlog fitur dianggap selesai (Done) secara vertikal apabila:

- API endpoints backend dan komponen UI frontend untuk fitur tersebut terhubung penuh (tidak menggunakan data statis/mock).

- Perubahan data tersimpan dengan benar di skema database (User, Project, atau Clips) dan tersinkronisasi.

- Kode telah melewati pengujian manual menggunakan 3 sampel video webinar riil dari dataset uji tanpa crash.

- Pull Request telah direview silang oleh setidaknya satu anggota tim lainnya dan disetujui masuk ke branch utama.
