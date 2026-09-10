# Draft kontrak pipeline H-01

Status: **belum disepakati A/B/C**. Dokumen ini tidak menyatakan queue/worker sudah tersedia. C mengimplementasikan fondasi pada H-02; B memiliki ingest/transcribe, C analyze/render, A schema/status/retensi. Gaya subtitle dan retensi 24 jam telah diselaraskan dengan keputusan terbaru pada PRD/FRD; integrasi pipeline tetap memerlukan review pemilik.

Pembagian modul setelah integrasi H-02: A memiliki `project.*` untuk CRUD, ownership,
dan pembacaan status. B memiliki `upload.*`; endpoint sumber menerima `projectId` melalui
`POST /projects/{id}/source` dan memperbarui proyek yang sudah dibuat A, bukan membuat
proyek baru. C memakai proyek yang sama untuk tahap analyze/render dan mengakhiri proses
dengan `idle`/null atau `error`/tahap gagal.

## Payload dan urutan

Usulan satu job pipeline `{ projectId }` membaca sumber, layout, kamus, dan pemilik dari database. Urutan: ingest -> transcribe -> analyze -> render. Job render ulang `{ projectId, clipId }` hanya merender satu klip menggunakan edit tersimpan dan tidak mengulang ASR/kurasi. Payload tidak membawa bytes media, password, atau token pengguna. Worker harus memverifikasi relasi klip/proyek sebelum bekerja.

Status proyek tetap `processing | idle | error`; `processingStage` adalah `ingest | transcribe | analyze | render | null`. Proyek antre memakai `processing` dan tahap berikut yang akan dijalankan. Proyek selesai memakai `idle`/null; kegagalan mempertahankan tahap terakhir dengan `error`. Status klip `pending | rendering | rendered | error`. Polling 5 detik selama pemrosesan aktif; persentase waktu tidak dibuat-buat.

Worker menyimpan transkrip sumber lengkap per kata sebelum kurasi. Timestamp sumber selalu relatif terhadap video sumber; ekspor subtitle mengonversinya menjadi relatif terhadap awal klip. Skor konsep dan alasan tersimpan bersama segmen. Service tahap tidak bergantung pada request/response Express.

## Gaya subtitle dan validasi (belum diimplementasikan pada pipeline)

Worker membaca `Clip.subtitleStyle` dari database untuk render/render ulang: `clean` (default) atau `active_word_highlight`. Field ini dipetakan ke kolom enum `subtitle_style`; perubahan pilihan hanya memengaruhi klip terkait.

Backend wajib memvalidasi maksimal 20 istilah kustom, transkrip per kata yang memuat `word`, `start_time`, `end_time`, `confidence`, 3–5 hasil kurasi masing-masing berdurasi 25–75 detik, serta pilihan layout/subtitle yang didukung. Tiga layout adalah Slide+Cam, Talking-Head, dan Slide Saja; nilai wire layout dikunci bersama B/C sebelum implementasi. Validasi ini belum tersedia hanya dengan menambahkan schema.

## Retensi dan koordinasi

- Upload sumber/upload ulang berhasil menetapkan aktivitas saat ini serta kedaluwarsa sumber +24 jam. Penyimpanan edit hanya memperbarui aktivitas edit; edit, polling, dan unduhan tidak memperpanjang retensi.
- Render berhasil menetapkan renderedAt dan kedaluwarsa ekspor +24 jam untuk MP4/SRT klip itu.
- Pembersihan retensi hanya menghapus media terkelola yang kedaluwarsa lalu mengosongkan path. Metadata dan transkrip tetap ada.
- Media dengan job antre/aktif tidak boleh dibersihkan. A/C perlu menyepakati mekanisme klaim media yang atomik sebelum scheduler berjalan, agar pemeriksaan job dan penghapusan tidak berlomba.
- Saat sumber hilang, render ulang ditolak dengan kode usulan `SOURCE_REUPLOAD_REQUIRED`; B mengembalikan sumber asli ke proyek yang sama.
- Semua preview/unduhan memerlukan autentikasi dan verifikasi pemilik; path filesystem tidak dikirim sebagai URL publik.

Scheduler dan logika retensi di atas belum diimplementasikan pada backend H-01; ini adalah kontrak untuk tahap berikutnya.

## Hal yang wajib dikunci bersama sebelum H-02/H-03

Nama queue, identitas job/idempotensi, retry dan timeout, perlindungan edit selama render, klaim media, serta bentuk transkrip/koreksi subtitle harus disepakati B/C dengan A. Usulan payload di atas bukan izin menjalankan pekerjaan paralel sebelum kontrak ini direview. Pemilihan provider/model ASR/LLM milik B/C.

Schema awal dan tambahan gaya subtitle melalui migrasi terpisah sudah diterapkan pada Aiven bersama setelah persetujuan tim; schema dan checksum migrasi telah diverifikasi. Kontrak pipeline tetap draft dan queue/worker belum diimplementasikan. Nama proyek belum ditambahkan pada H-01; usulan penambahannya untuk H-02 harus direview bersama pemilik sebelum migrasi lanjutan.
