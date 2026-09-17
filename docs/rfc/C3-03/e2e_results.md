# E2E Pipeline Test Results

**Date:** 2026-09-10
**Model:** gpt-5.6-luna

## Summary

| Transcript | Score | Duration In-Range | Schema Accepted | Latency (ms) |
|------------|-------|-------------------|-----------------|--------------|
| Banter (off-topic) | N/A | no proposals | accepted | 2043 |
| Topic Jump | 87 | 1/1 | accepted | 6913 |
| Excerpt 1 (positive control) | 98 | 1/1 | accepted | 5505 |
| Excerpt 2 (positive control) | 98 | 1/1 | accepted | 4675 |
| Excerpt 3 (positive control) | 98 | 1/1 | accepted | 5957 |

## Duration Compliance

Of 4 live proposals, 4 were within-range pre-validation; 0 required schema rejection.

## Known Limitations

LLM scoring shows some run-to-run variance; validated via wide-threshold smoke test + manual spot-check, not full statistical consistency testing.

## Per-Transcript Details

### Banter (off-topic)

- **No segments proposed**

### Topic Jump

- **Score:** 87
- **Duration:** 26.4s
- **Title:** Cara Mengatasi Overfitting dalam Machine Learning
- **Reason:** Segmen dibuka dengan pengingat topik, lalu menjelaskan regularisasi L1/L2, dropout, dan cross-validation secara konkret. Ditutup dengan rangkuman bahwa overfitting adalah masalah umum serta ucapan penutup yang lengkap.

### Excerpt 1 (positive control)

- **Score:** 98
- **Duration:** 39.72s
- **Title:** AI Menghemat Waktu Guru dalam Menilai Pekerjaan Siswa
- **Reason:** Segmen memperkenalkan masalah penilaian manual, menjelaskan solusi AI melalui automated grading dan Gradescope, memberi dampak konkret, lalu ditutup dengan kesimpulan bahwa AI membantu guru fokus pada aktivitas mengajar.

### Excerpt 2 (positive control)

- **Score:** 98
- **Duration:** 32.2s
- **Title:** Gradescope Menghemat Waktu Guru dalam Menilai Esai
- **Reason:** Clip menjelaskan masalah penilaian manual, solusi Gradescope berbasis machine learning, dampaknya dari tiga jam menjadi 30 menit, lalu ditutup dengan kesimpulan jelas tentang penghematan waktu dan energi guru.

### Excerpt 3 (positive control)

- **Score:** 98
- **Duration:** 44.24s
- **Title:** Bagaimana AI Membantu Guru Memberikan Feedback Personal?
- **Reason:** Dibuka dengan tantangan feedback personal di kelas besar, lalu menjelaskan analisis kesalahan, adaptive learning, dan peran guru. Ditutup dengan penanda “Jadi intinya”, manfaat, serta ucapan terima kasih.
