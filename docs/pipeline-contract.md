# Kontrak pipeline Redis / BullMQ

Implementasi lokal pada branch `feature/docker`. Fondasi C; ingest/transkripsi B;
status, schema, dan retensi A. Review integrasi pemilik tetap diperlukan sebelum
penerapan ke lingkungan bersama. Dokumen ini tidak mengklaim pengujian webinar
lengkap atau scheduler retensi sudah aktif.

## Antrean dan penerimaan pekerjaan

- Queue `media`, prefix `QUEUE_PREFIX` (default `cuplik-local`). Jenis job `pipeline`
  dan `render-clip`; concurrency global dan per worker = 1.
- Payload `{ jobId, projectId, clipId? }`; `jobId` adalah UUID `ProcessingJob` dan
  juga BullMQ jobId. Tidak membawa bytes media atau kredensial.
- API menyimpan sumber/status dan catatan job secara atomik dengan lock proyek.
  Respons 202 berarti pekerjaan tercatat secara persisten, belum berarti selesai.
- Dispatcher di proses worker membaca job nonterminal saat startup dan setiap 5
  detik, lalu memasukkannya ke Redis. Redis terputus tidak membatalkan pekerjaan
  yang sudah tercatat. Job yang sudah ada tidak dikirim sebagai job baru.
- Worker memeriksa identitas payload serta relasi klip/proyek dari database.
  HTTP tetap memeriksa sesi dan ownership sebelum admission.

## Pipeline dan checkpoint

Urutan `ingest -> transcribe -> analyze -> render`. Validasi berkas dilakukan
sebelum penerimaan; ekstraksi audio, ASR, LLM, dan render berlangsung di worker.

- Status proyek `processing | idle | error`; `deleting` khusus penghapusan.
  Tahap `ingest | transcribe | analyze | render | null`. Proyek antre memakai
  `processing`, selesai memakai `idle`/null, gagal mempertahankan tahap gagal.
- Transkrip lengkap per kata disimpan bersama checkpoint `transcribe`.
  Chunk ASR gagal tidak boleh dilewati dan dianggap transkrip lengkap.
- Kurasi memilih 3-5 segmen valid berdurasi 25-75 detik setelah deduplikasi.
  Penyimpanan seluruh klip dan checkpoint `analyze` berlangsung satu transaksi.
  Kurasi tidak mengakhiri status proyek sebelum render selesai.
- Timestamp transkrip sumber relatif ke sumber. Transkrip klip direbasiskan
  terhadap awal klip. Gaya subtitle awal `clean`; render ulang membaca gaya/edit
  tersimpan pada klip. Layout tersimpan `slide-cam | talking-head | slide-only`.
- Pipeline merender klip berurutan. Saat pemulihan, lewati checkpoint yang sudah
  tersimpan dan klip berstatus `rendered`. Render ulang hanya membaca satu klip.

## Kegagalan dan percobaan ulang

- Catatan job berstatus `pending | running | completed | failed`, menyimpan
  checkpoint, attempts, attemptToken, errorCode, dan timestamp.
- Maksimal 3 percobaan job; backoff eksponensial mulai 5 detik untuk kegagalan
  sementara seperti koneksi/provider unavailable atau timeout. Retry internal
  service provider tetap berlaku; total panggilan provider dapat melebihi 3.
- Input tidak valid, sumber hilang, atau hasil kurasi tidak cukup gagal terminal.
- Setiap claim menghasilkan token percobaan baru. Penulisan hasil harus memegang
  lock proyek dan token aktif. Percobaan lama tidak dapat memperbarui metadata.
- File render memakai UUID percobaan pada nama file di direktori klip. Path hanya
  dipublikasikan setelah MP4 bersubtitle dan SRT berhasil dibuat. Percobaan ulang
  tidak menimpa file dari percobaan lain.
- Dispatcher menyelaraskan kegagalan terminal/stalled BullMQ yang belum tercatat
  pada database. Redis memakai AOF/noeviction dan volume persisten; jangan
  menghapus/flush antrean untuk pemulihan biasa.
- Operator dapat membuat job pengganti dari satu job gagal melalui
  `npm run job:retry -- <jobId>`. Checkpoint dipertahankan; tindakan ini menulis
  database target dan hanya boleh dijalankan pada lingkungan yang diotorisasi.

## Penguncian dan retensi

Job pending/running memblokir upload, edit, render ganda, dan penghapusan proyek
terkait. Admission, edit, dan deletion memakai lock baris proyek yang sama.
Catatan job terminal dihapus bersama penghapusan proyek oleh pemilik.

Sumber kedaluwarsa 24 jam sejak upload berhasil. Ekspor kedaluwarsa 24 jam sejak
render klip berhasil. Edit/polling/retry tidak memperpanjang retensi sumber;
render sukses hanya memperbarui retensi ekspor klip tersebut.

Scheduler retensi belum diaktifkan. Sebelum dihubungkan, repository cleanup wajib
mengambil lock proyek yang sama dan menolak job pending/running sepanjang unlink
serta pengosongan path. Metadata/transkrip harus tetap tersimpan. File sumber
hilang menghasilkan `SOURCE_MISSING`, tidak memulai ulang ASR secara otomatis.

## Operasional dan batas bukti

Lihat [panduan queue](queue-operations.md) untuk startup dan tes terisolasi.
Tidak ada migrasi otomatis saat API/worker startup. Worker membutuhkan migrasi
`processing_jobs` terlebih dahulu. Deployment harus dilakukan setelah pekerjaan
lama di proses API selesai; job lama tanpa catatan ProcessingJob tidak otomatis
diadopsi. Jangan menyalakan API lama dan worker baru untuk pekerjaan yang sama.
