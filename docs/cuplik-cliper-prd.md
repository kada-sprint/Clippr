# Product Requirement Document (PRD): Cuplik
**Solusi Repurposing Rekaman Webinar ke Klip Vertikal Edukatif Berbasis Konsep Utuh**

## 1. Document Control & Metadata

| Atribut | Keterangan |
| :--- | :--- |
| **Nama Produk** | Cuplik |
| **Versi Dokumen** | v1.0 (MVP Capstone Baseline) |
| **Status** | Ready for Sprint Execution / Review |
| **Durasi Pengerjaan** | 2 Minggu (14 Hari Kalender) |
| **Kapasitas Tim** | 2 Orang (Orang A: Pipeline & Backend, Orang B: Frontend & UX) |
| **Tanggal Terbit** | 4 September 2026 |
| **Target Pengguna** | Trainer independen, konsultan edukasi, tim marketing lembaga pelatihan di Indonesia |

---

## 2. Executive Summary & Product Vision

### 2.1 Ringkasan Eksekutif
Trainer dan lembaga pelatihan di Indonesia memiliki arsip rekaman webinar dan workshop internal berdurasi puluhan hingga ratusan jam yang tidak dimanfaatkan (*dormant content*). Masalah utamanya adalah tingginya *friction* kognitif dan teknis: memotong satu klip edukasi 45–60 detik membutuhkan 30–60 menit kerja manual (menonton ulang, potong, reframe, sinkronisasi subtitle).

**Cuplik** adalah platform otomatisasi *video repurposing* berbasis web yang mentransformasi 1 file rekaman webinar (30–60 menit) menjadi 3–5 klip vertikal (9:16) bersubtitle Bahasa Indonesia secara asinkron tanpa pengguna perlu membuka video editor tradisional.

### 2.2 Visi & Filosofi Produk: "Kelengkapan Konsep" vs "Viralitas"
Berbeda dari perkakas global seperti Opus.pro yang mengejar *viral triggers* (reaksi emosional, kalimat kontroversial, *clickbait hooks*), Cuplik mendefinisikan klip berkualitas berdasarkan **Kelengkapan Konsep Ajar (Concept Completeness)**:
*   **Punya Pembuka Kontekstual:** Pengajar memperkenalkan pertanyaan, premis, atau masalah.
*   **Punya Elaborasi/Solusi:** Penjelasan konsep inti, analogi, atau langkah konkret.
*   **Punya Kesimpulan Mandiri:** Klip tidak terpotong di tengah kalimat dan memiliki pemahaman utuh tanpa audiens perlu menonton 59 menit rekaman aslinya.

---

## 3. User Personas & Pain Points

### 3.1 Profil Pengguna
| Persona | Peran | Karakteristik & Kebutuhan | Prioritas |
| :--- | :--- | :--- | :--- |
| **Persona A: Mas Bagus** | Trainer Independen / Konsultan | Mengelola materi dan media sosial sendiri; tidak memiliki video editor; punya banyak rekaman kelas 1–2 jam di Google Drive. | **Primer (P0)** |
| **Persona B: Mbak Rini** | Marketing Lembaga Pelatihan | Punya target mingguan untuk mengunggah Shorts/Reels/TikTok dari rekaman kelas internal, tapi tim kecil dan bukan editor profesional. | **Sekunder (P1)** |
| **Out-of-Scope Persona** | Podcaster Multi-Speaker / Gamer | Butuh *speaker tracking* aktif antar 2–4 kamera per frame, efek visual animasi berlebih, dan deteksi reaksi instan. | **Bukan Target** |

### 3.2 Pain Points yang Divalidasi
*   **Analisis Waktu yang Terbuang:** Menonton ulang rekaman 60 menit untuk mencari 1 menit klip adalah pemborosan waktu yang membuat konten akhirnya ditinggalkan.
*   **Kegagalan Deteksi Wajah Otomatis pada Slide:** Rekaman webinar mayoritas berupa presentasi slide dengan wajah pengajar hanya di pojok webcam kecil (*picture-in-picture*). Algoritma *auto-crop* standar justru memperbesar slide secara keliru atau memotong materi visual utama.
*   **Akurasi Transkripsi Subtitle ID:** *Speech-to-text* umum sering salah menerjemahkan istilah serapan teknis atau konteks bahasa Indonesia sehari-hari, memaksa pengguna mengetik ulang dari awal.

---

## 4. Competitive Differentiation: Opus.pro vs. Cuplik

| Parameter Evaluasi | Opus.pro / AI Clipper Global | Cuplik (MVP) |
| :--- | :--- | :--- |
| **Target Konten** | Podcast kasual, *talking head*, gaming, vlog | Rekaman webinar formal, workshop berbasis slide, kelas edukasi |
| **Metrik Seleksi Klip** | *Virality Score* (reaksi, ekspresi, kalimat kejutan) | *Concept Completeness Score* (struktur ajar: tanya, jawab, solusi) |
| **Strategi Layout 9:16** | *Auto-reframe* dinamis per frame (sering gagal di slide) | 3 Template Layout Statis yang ditentukan oleh tipe rekaman di awal |
| **Spesialisasi Subtitle** | Subtitle global, timestamp berbasis kalimat/blok | Timestamp per kata Bahasa Indonesia + kamus istilah kustom |
| **Monetisasi & Model** | Berlangganan USD via kartu kredit internasional | Berorientasi lokal (Rupiah/lokal payment readiness pasca-MVP) |

---

## 5. End-to-End User Flow
1. **User Upload:**
   * File MP4/MOV (< 45 mnt, < 1 GB).
   * Pilih 1 dari 3 Layout Template.
   * (Opsional) Input kamus istilah teknis.
2. **Processing Queue:**
   * Pipeline Asinkron: Ingest -> ASR (word timestamp) -> LLM Curation -> FFmpeg Render.
   * UI: Progress bar per tahap (bisa tutup tab, akses lewat link).
3. **Curation Review & Light Editing:**
   * Tampil 3-5 kartu klip (Preview, Judul, Durasi, Skor Konsep, Alasan Pemilihan).
   * Koreksi: Geser start/end (step 0.5s), edit teks subtitle, ganti gaya font.
4. **Selective Re-render:**
   * Hanya klip yang diubah yang diproses ulang oleh worker (< 60 detik).
5. **Export:**
   * Download MP4 1080x1920 (Subtitle terbakar).
   * Download berkas .SRT terpisah.

---

## 6. Functional Requirements & System Modules

### 6.1 Modul 1: Ingestion & Pre-processing (P0)
*   **REQ-1.1:** Menerima input berkas tunggal format .mp4 atau .mov.
*   **REQ-1.2 Validation Rules:**
    *   Durasi maksimum: 45 menit.
    *   Ukuran berkas maksimum: 1.0 GB.
    *   Validasi resolusi minimum (misal: 720p).
*   **REQ-1.3 Audio Extraction:** Mengonversi track audio ke format .wav / .mp3 mono menggunakan ffmpeg untuk efisiensi transfer data ke engine ASR.

### 6.2 Modul 2: Speech-to-Text Engine (P0)
*   **REQ-2.1 Word-Level Timestamps:** ASR wajib mengeluarkan payload JSON yang memuat timestamp per kata (word, start_time, end_time, confidence). Timestamp tingkat kalimat **ditolak** karena tidak mendukung sinkronisasi subtitle modern.
*   **REQ-2.2 Custom Vocabulary Prompting:** Menyediakan kolom input teks sebelum proses di mana pengguna dapat memasukkan hingga 20 kata/istilah teknis (misal: "Scrum", "Kubernetes", "Prompt Engineering") sebagai context hint bagi model ASR.

### 6.3 Modul 3: LLM Concept-Based Segment Selection (P0)
*   **REQ-3.1 Input Format:** Transkrip terformat lengkap dengan penanda waktu interval dikirim ke LLM bersama prompt seleksi terstruktur.
*   **REQ-3.2 Scoring Heuristic:** LLM mengevaluasi teks dengan kriteria **Kelengkapan Konsep** (Pembuka kontekstual, Elaborasi/Solusi, Kesimpulan mandiri).
*   **REQ-3.3 Output Schema:** Mengembalikan struktur JSON terverifikasi:
    ```json
    {
      "segments": [
        {
          "clip_id": "clip_01",
          "start_time_seconds": 252.5,
          "end_time_seconds": 299.5,
          "duration": 47.0,
          "concept_score": 0.88,
          "suggested_title": "Bedanya Prompt yang Asal dan Benar",
          "pedagogical_reason": "Menjelaskan perbandingan langsung dengan analogi yang selesai."
        }
      ]
    }
    ```
*   **REQ-3.4 Boundary Constraints:** Durasi segmen wajib dibatasi antara **25 hingga 75 detik**.

### 6.4 Modul 4: Video Processing & 9:16 Reframe Engine (P0)
Alih-alih *speaker tracking per frame*, Cuplik menggunakan pendekatan template layout deterministik menggunakan ffmpeg:
*   **Template A (Slide + Pembicara - Default):**
    *   Canvas: 1080x1920 (9:16).
    *   Area Atas (70% layar): Slide presentasi di-crop/fit secara proporsional.
    *   Area Bawah (30% layar): Kotak kamera pengajar, diposisikan di atas subtitle.
*   **Template B (Wajah Penuh / Talking Head):**
    *   Crop terpusat 9:16 pada pembicara (menggunakan deteksi wajah statis di frame awal untuk penentuan koordinat tengah).
*   **Template C (Slide Saja):**
    *   Slide diletakkan di tengah secara proporsional dengan latar belakang *blurred/solid letterbox*, memberikan ruang vertikal luas di bagian atas untuk judul klip dan bagian bawah untuk subtitle.

### 6.5 Modul 5: Subtitle Burner (P0)
*   **REQ-5.1 Burning Subtitles:** Mengintegrasikan subtitle langsung ke frame video (*hardcoded*) via filter subtitles atau ass pada ffmpeg.
*   **REQ-5.2 Gaya Tampilan:**
    *   *Clean Style:* Teks putih, font sans-serif tebal (Inter/Montserrat), outline hitam.
    *   *Active Word Highlight Style:* Teks kuning menyala pada kata yang sedang diucapkan, warna abu-abu pada kata lainnya.

### 6.6 Modul 6: Lightweight Web Review Editor (P0)
*   **REQ-6.1 Nudge Adjustment:** Antarmuka penggeser titik mulai (*start*) dan akhir (*end*) dengan *granularity* 0.5 detik tanpa timeline multi-layer.
*   **REQ-6.2 In-Place Text Correction:** Pengguna dapat mengklik teks subtitle atau judul untuk mengubah kesalahan ejaan sebelum finalisasi.
*   **REQ-6.3 Delta Re-render:** Mengubah klip tertentu hanya memicu *rendering* ulang untuk klip yang bersangkutan (tidak me-render keseluruhan batch).

---

## 7. Scope Management: "Must-Have" vs "Out-of-Scope"

| IN-SCOPE (MVP 14 HARI) | OUT-OF-SCOPE (DILARANG) |
| :--- | :--- |
| • File tunggal MP4/MOV (maks 45 mnt / 1 GB) | • Auto-speaker tracking per-frame dinamis |
| • Transkripsi ASR Bahasa Indonesia per kata | • Prediksi algoritma viralitas medsos |
| • Kamus istilah kustom (pre-process input) | • Batch processing banyak video sekaligus |
| • Seleksi 3-5 klip kelengkapan konsep (LLM) | • Auto-posting langsung ke API TikTok/Reels |
| • 3 Template layout statis 9:16 via ffmpeg | • B-roll generator, animasi stiker, musik latar |
| • Burned-in Subtitle (Clean & Word-Highlight) | • Aspek rasio 1:1 (Square) atau 4:5 (Portrait) |
| • Editor ringan (nudge time + text edit) | • Manajemen tim kolaboratif / multi-user workspace |
| • Ekspor: MP4 1080x1920 + File terpisah .SRT | • Video editor timeline multi-track kompleks |

---

## 8. Non-Functional Requirements (NFR)
*   **NFR-1 (Processing Latency):** Total waktu pemrosesan untuk video 45 menit tidak boleh melebihi 1/3 durasi aslinya (< 15 menit).
*   **NFR-2 (Reliability & Queue Isolation):** Video rendering wajib berjalan di background worker terisolasi (misal: Redis Queue + Celery/BullMQ pada VPS) dan tidak boleh dijalankan di thread web-server utama atau fungsi serverless berbasis timeout (< 15 menit).
*   **NFR-3 (Data Privacy & Storage Retention):** Berkas video mentah dan hasil render klip dihapus otomatis dari media penyimpanan sementara dalam kurun waktu 24 jam demi efisiensi storage dan perlindungan privasi materi pelatihan klien.
*   **NFR-4 (UI Responsiveness):** Antarmuka status proses wajib memperbarui status tahapan (*Ingest*, *Transcribe*, *Analyze*, *Render*) secara real-time via WebSocket atau long-polling interval 5 detik.

---

## 9. Success Metrics & Validation Strategy

| Kategori Metrik | Indikator Kunci (KPI) | Target MVP | Metode Pengukuran |
| :--- | :--- | :--- | :--- |
| **Kualitas Output** | Klip Layak Posting (*Posting-Ready*) | Layak tayang dengan revisi cepat | 50 klip dari 10 webinar diuji oleh 5 trainer independen: *"Dapat diposting dengan koreksi < 5 menit"* (Ya/Tidak). |
| **Akurasi Teks** | Word Error Rate (WER) Subtitle ID | WER < 10% | Dihitung terhadap transkripsi acuan manual pada 5 sampel audio webinar durasi 3 menit. |
| **Efisiensi Waktu** | Waktu Intervensi Manusia (*Human Effort*) | Pangkas waktu manual hingga 80% | Waktu stopwatch dari klik 'Upload' hingga file klip terunduh. |
| **Performa Sistem** | Processing Speed Ratio | Rasio pemrosesan < 1/3 durasi asli | Total durasi pemrosesan backend terhadap durasi video riil. |
| **Penerimaan Pasar** | Repeat Usage Intent | Bersedia menggunakan kembali (> 80%) | Kuesioner pasca-tes: *"Apakah Anda akan memakai tool ini lagi untuk webinar minggu depan?"* |

---

## 10. 9-Day Sprint Roadmap
*   **Day 1:** [GERBANG KRITIS] Uji komparasi ASR ID & kunci model ASR.
*   **Day 2:** Pipeline ingest, audio extraction, & basic Frontend upload form.
*   **Day 3:** Integrate ASR & LLM Concept Selection engine.
*   **Day 4:** Frontend UI implementation (queue, progress bar, clip cards).
*   **Day 5:** Implement Rendering pipeline (ffmpeg layouts).
*   **Day 6:** Develop Web editor (boundary adjustments & inline subtitle editor).
*   **Day 7:** Full system integration, delta re-render logic, & error handling.
*   **Day 8:** User testing/feedback collection & critical bug fixing.
*   **Day 9:** Final polish, export feature (MP4+SRT), and Demo preparation.

---

## 11. Day-0 Action Items Checklist
*   [ ] Mengumpulkan 10 berkas rekaman webinar riil (minimal 3 talking-head, 5 slide + webcam, 2 slide dominan).
*   [ ] Mendaftarkan kredensial API untuk calon provider ASR dan LLM.
*   [ ] Menyepakati pagu anggaran pengeluaran API untuk fase pengembangan (misalnya 100 kali eksekusi pipeline).
*   [ ] Menandatangani komitmen pembatasan *scope* (daftar "Dilarang Dikerjakan" berlaku sebagai kontrak tim).
