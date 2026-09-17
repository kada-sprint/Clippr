import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider.jsx";
import Navbar from "../../layouts/Navbar.jsx";
import Footer from "../../layouts/Footer.jsx";
import Icon from "../../components/Icon.jsx";
import WorkspaceDemo from "./components/WorkspaceDemo.jsx";
import ClipPreview from "./components/ClipPreview.jsx";
import "./landing.css";

const advantages = [
  ["spark", "Lebih sedikit kerja manual", "Dari webinar ke cuplikan", "yellow"],
  ["shield", "Konsep tetap utuh", "Tanpa kalimat terpotong", "green"],
  ["clock", "Retensi media 24 jam", "Penyimpanan terukur", "blue"],
  ["globe", "Bahasa Indonesia", "Dengan kamus istilah", "blue"],
];
const traditional = [
  [
    "Kalimat terpotong di tengah",
    "Potongan yang menarik perhatian sering kehilangan konteks dan penjelasan penting.",
  ],
  [
    "Mengejar reaksi sesaat",
    "Materi yang mendalam tidak selalu punya momen dramatis atau kalimat sensasional.",
  ],
  [
    "Materi visual terabaikan",
    "Diagram, slide, dan contoh kode sulit dipahami ketika bingkai hanya mengikuti wajah.",
  ],
];
const complete = [
  [
    "Struktur ajar tiga bagian",
    "Pembuka yang kontekstual, penjelasan yang jelas, dan kesimpulan yang bisa berdiri sendiri.",
  ],
  [
    "Pemilihan berdasarkan makna",
    "Dirancang untuk menemukan segmen yang menyampaikan satu konsep secara lengkap.",
  ],
  [
    "Slide dan pengajar tetap selaras",
    "Tiga pilihan layout menjaga materi dan pembicara hadir sesuai kebutuhan pembelajaran.",
  ],
];
const layouts = [
  [
    "Slide + Pembicara",
    "Paling populer",
    "Slide tetap menjadi fokus utama, dengan pembicara di bagian bawah untuk menjaga kedekatan dengan audiens.",
  ],
  [
    "Fokus Pembicara",
    "Kuliah & diskusi",
    "Tampilan vertikal yang berpusat pada pembicara. Cocok untuk penjelasan langsung dan cerita yang bermakna.",
  ],
  [
    "Presentasi Bersih",
    "Slide saja",
    "Ruang yang lega untuk diagram, kode, dan materi visual. Judul dan subtitle melengkapi penjelasan Anda.",
  ],
];
const features = [
  [
    "layers",
    "Kontrol waktu dengan presisi 0,5 detik",
    "Atur awal dan akhir cuplikan agar pembuka terasa pas dan kesimpulan benar-benar selesai.",
    "blue",
  ],
  [
    "edit",
    "Koreksi subtitle langsung di tempat",
    "Perbaiki ejaan dan istilah teknis pada teks subtitle, tanpa berpindah ke aplikasi lain.",
    "blue",
  ],
  [
    "clock",
    "Render ulang hanya klip yang berubah",
    "Sempurnakan satu cuplikan tanpa harus memproses ulang seluruh rekaman webinar.",
    "yellow",
  ],
  [
    "download",
    "Dua format, siap dibagikan",
    "Ekspor video MP4 vertikal dengan subtitle, beserta berkas SRT terpisah untuk kebutuhan Anda.",
    "green",
  ],
];
const steps = [
  [
    "Unggah & Pilih Layout",
    "Mulai dengan rekaman webinar Anda. Pilih bingkai yang paling sesuai dengan materi.",
    "MP4, MOV · Maks. 1 GB",
    "upload",
  ],
  [
    "Analisis Konsep",
    "Transkripsi dan kurasi membantu menemukan bagian yang punya alur penjelasan lengkap.",
    "3–5 cuplikan bermakna",
    "spark",
  ],
  [
    "Tinjau & Sempurnakan",
    "Koreksi subtitle, sesuaikan judul, dan geser batas waktu dengan langkah 0,5 detik.",
    "Kendali tetap di tangan Anda",
    "edit",
  ],
  [
    "Ekspor & Bagikan",
    "Siapkan cuplikan vertikal untuk Reels, Shorts, TikTok, atau materi pembelajaran Anda.",
    "Full HD + subtitle SRT",
    "download",
  ],
];
const audiences = [
  [
    "RA",
    "Trainer & fasilitator",
    "Bagikan kembali keahlian Anda",
    "Satu sesi pelatihan menyimpan banyak pelajaran. Jadikan setiap konsep sebagai cuplikan yang bisa dipelajari kembali oleh peserta.",
    "blue",
  ],
  [
    "NW",
    "Pendidik & mentor",
    "Buat materi lebih mudah dicerna",
    "Bantu peserta memahami topik secara bertahap melalui klip pendek yang tetap menyimpan konteks dan penjelasan utuh.",
    "yellow",
  ],
  [
    "BH",
    "Tim pelatihan",
    "Hidupkan arsip pengetahuan",
    "Ubah rekaman workshop dan webinar internal menjadi koleksi pembelajaran singkat yang mudah dibagikan kepada tim.",
    "green",
  ],
];
const faqs = [
  [
    "Video seperti apa yang bisa digunakan?",
    "Clippr dirancang untuk satu rekaman webinar, kelas, atau workshop berformat MP4/MOV, dengan durasi maksimal 45 menit dan ukuran maksimal 1 GB.",
  ],
  [
    "Apa yang dimaksud dengan konsep utuh?",
    "Setiap cuplikan dirancang memiliki pembuka kontekstual, penjelasan atau solusi, serta kesimpulan mandiri. Jadi, penonton dapat memahami satu gagasan tanpa harus menonton rekaman aslinya.",
  ],
  [
    "Apakah subtitle bisa diedit?",
    "Editor dirancang untuk koreksi judul dan subtitle, penyesuaian batas waktu per 0,5 detik, serta pilihan gaya subtitle bersih atau sorotan kata aktif. Anda bisa mencoba interaksi teks dan waktu pada demo di halaman ini.",
  ],
  [
    "Berapa lama video disimpan?",
    "Kebijakan Clippr menetapkan masa simpan video sumber 24 jam sejak upload berhasil dan hasil ekspor 24 jam sejak render berhasil. Edit atau unduhan tidak memperpanjang retensi. Metadata dan transkrip tetap tersimpan; render ulang setelah sumber kedaluwarsa memerlukan upload ulang sumber asli.",
  ],
];

function Portrait({ variant }) {
  return (
    <div className={`portrait portrait-${variant}`} aria-hidden="true">
      {variant === 0 && (
        <>
          <div className="mock-slide">
            <div className="slide-top">
              <span>CLIPPR</span>
              <i />
            </div>
            <div className="slide-lines">
              <b />
              <span />
              <span />
            </div>
            <code>def optimalkan_pemahaman():</code>
          </div>
          <div className="mock-speaker">
            <span className="speaker-avatar">
              <Icon name="user" size={23} />
            </span>
            <div>
              <i />
              <small>Pengetahuan bermakna</small>
            </div>
          </div>
        </>
      )}
      {variant === 1 && (
        <div className="talking-speaker">
          <span>
            <Icon name="user" size={34} />
          </span>
          <i />
          <div className="audio-wave">
            {[8, 16, 10, 23, 32, 19, 12, 26, 15, 8].map((height, index) => (
              <b key={index} style={{ height }} />
            ))}
          </div>
        </div>
      )}
      {variant === 2 && (
        <>
          <div className="presentation-title">MEMAHAMI KONSEP, SEUTUHNYA</div>
          <div className="presentation-slide">
            <b />
            <span />
            <span />
            <span />
            <i />
          </div>
        </>
      )}
      <div className="portrait-caption">
        {variant === 1
          ? "“Setiap ide layak untuk dipahami.”"
          : variant === 2
            ? "Satu penjelasan yang lengkap."
            : "Ilmu yang utuh, dalam satu cuplikan."}
      </div>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const openStart = () => navigate(user ? '/upload' : '/login');

  return (
    <>
      <a className="skip-link" href="#konten">
        Langsung ke konten
      </a>
      <Navbar onStart={openStart} />
      <main id="konten">
        <section className="hero" id="beranda">
          <div className="hero-glow" />
          <div className="container hero-content">
            <div className="pill">
              <Icon name="layers" size={13} />
              <span>KONSEP UTUH, DAMPAK LEBIH JAUH</span>
              <i /> Untuk pendidik & trainer
            </div>
            <h1>
              Webinar Panjang Jadi Cuplikan. <br />
              Singkat, Bermakna, <span>Tetap Utuh.</span>
            </h1>
            <p className="hero-description">
              Pengetahuan berharga tak seharusnya berhenti di rekaman panjang.
              <br className="desktop-break" /> Ubah webinar Anda menjadi klip
              edukatif yang menjaga konteks,
              <br className="desktop-break" /> penjelasan, dan kesimpulan dalam
              setiap cuplikan.
            </p>
            <div className="hero-actions">
              <button className="button primary" onClick={openStart}>
                Mulai Buat Cuplikan <Icon name="arrow" size={17} />
              </button>
              <a className="button secondary" href="#demo">
                <Icon name="play" size={16} className="yellow" /> Coba Demo
                Interaktif
              </a>
            </div>
            <div className="advantages">
              {advantages.map(([icon, title, description, color]) => (
                <div className="advantage" key={title}>
                  <span className={`icon-tile ${color}`}>
                    <Icon name={icon} size={18} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <span>{description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section concept-section" id="konsep">
          <div className="container">
            <div className="section-heading centered">
              <span className="eyebrow">PEMAHAMAN ADALAH PRIORITAS</span>
              <h2>
                Dibuat untuk Dipahami,
                <br />
                Bukan Sekadar Dilewati.
              </h2>
              <p>
                Konten edukasi butuh lebih dari potongan yang menarik perhatian.
                <br className="desktop-break" /> Clippr menjaga hal terpenting
                dari materi Anda: maknanya.
              </p>
            </div>
            <div className="comparison-grid">
              {[
                {
                  label: "POTONGAN KONVENSIONAL",
                  title: "Menarik sesaat, kehilangan konteks",
                  items: traditional,
                  positive: false,
                },
                {
                  label: "PENDEKATAN CLIPPR",
                  title: "Singkat, dengan konsep yang lengkap",
                  items: complete,
                  positive: true,
                },
              ].map(({ label, title, items, positive }) => (
                <article
                  key={label}
                  className={`comparison-card ${positive ? "positive" : "negative"}`}
                >
                  <div className="comparison-heading">
                    <div>
                      <span className="tiny">{label}</span>
                      <h3>{title}</h3>
                    </div>
                    <span className="comparison-icon">
                      <Icon name={positive ? "shield" : "close"} size={19} />
                    </span>
                  </div>
                  <ul>
                    {items.map(([name, detail]) => (
                      <li key={name}>
                        <Icon name={positive ? "check" : "close"} size={15} />
                        <div>
                          <h4>{name}</h4>
                          <p>{detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="comparison-result">
                    <Icon name={positive ? "check" : "close"} size={14} />
                    {positive
                      ? "Hasil: cuplikan mandiri yang memberi pemahaman."
                      : "Risiko: perhatian sesaat, pemahaman terlewat."}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section layout-section" id="layout">
          <div className="container">
            <div className="section-heading heading-with-badge">
              <div>
                <span className="eyebrow">FORMAT YANG MEMAHAMI MATERI</span>
                <h2>
                  Satu Kanvas 9:16.
                  <br />
                  Tiga Cara Bercerita.
                </h2>
                <p>
                  Layout yang dirancang untuk slide, diagram, dan pengajar.
                  <br className="desktop-break" /> Pilih yang paling pas untuk
                  pengetahuan Anda.
                </p>
              </div>
              <span className="pill export-pill">
                <i className="status-dot" /> Ekspor 1080 × 1920 · Reels, Shorts,
                TikTok
              </span>
            </div>
            <div className="layout-gallery">
              {layouts.map(([title, badge, detail], index) => (
                <article className="layout-card" key={title}>
                  <Portrait variant={index} />
                  <div className="layout-card-heading">
                    <h3>
                      {index + 1}. {title}
                    </h3>
                    <span>{badge}</span>
                  </div>
                  <p>{detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section review-section" id="fitur">
          <div className="container review-grid">
            <div>
              <div className="section-heading">
                <span className="eyebrow">TINJAU DENGAN TENANG</span>
                <h2>
                  Edit Langsung di Browser.
                  <br />
                  Tanpa Timeline yang Rumit.
                </h2>
                <p>
                  Sempurnakan cuplikan lewat editor ringan yang fokus pada hal
                  penting. Anda tetap memegang kendali atas hasilnya.
                </p>
              </div>
              <div className="feature-list">
                {features.map(([icon, title, detail, color]) => (
                  <div className="feature-item" key={title}>
                    <span className={`icon-tile ${color}`}>
                      <Icon name={icon} />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <ClipPreview />
          </div>
        </section>

        <section className="section steps-section" id="cara-kerja">
          <div className="container">
            <div className="section-heading centered">
              <span className="eyebrow">ALUR SEDERHANA, HASIL BERMAKNA</span>
              <h2>
                Dari Rekaman Webinar ke
                <br />
                Cuplikan dalam 4 Langkah.
              </h2>
              <p>
                Kurangi pekerjaan berulang. Luangkan lebih banyak waktu
                <br className="desktop-break" /> untuk menyampaikan hal yang
                Anda kuasai.
              </p>
            </div>
            <div className="steps-grid">
              {steps.map(([title, detail, footnote, icon], index) => (
                <article className="step-card" key={title}>
                  <span className="step-number">{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                  <span
                    className={`step-footnote ${index === 1 ? "green" : index === 2 ? "yellow" : ""}`}
                  >
                    <Icon name={icon} size={12} />
                    {footnote}
                  </span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section audience-section">
          <div className="container">
            <div className="section-heading centered">
              <span className="eyebrow">UNTUK MEREKA YANG BERBAGI ILMU</span>
              <h2>
                Pengetahuan Anda Berharga.
                <br />
                Beri Kesempatan untuk Menjangkau Lebih.
              </h2>
              <p>
                Dari ruang kelas hingga pelatihan perusahaan,
                <br className="desktop-break" /> setiap rekaman punya pelajaran
                yang layak dibagikan.
              </p>
            </div>
            <div className="audience-grid">
              {audiences.map(([initials, title, tagline, detail, color]) => (
                <article className="audience-card" key={title}>
                  <div className={`audience-decoration ${color}`}>
                    <Icon name="spark" size={18} />
                    <span>RUANG UNTUK BERBAGI</span>
                  </div>
                  <h3>{tagline}</h3>
                  <p>{detail}</p>
                  <div className="audience-person">
                    <span className={`audience-avatar ${color}`}>
                      {initials}
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <span>Dirancang untuk kebutuhan Anda</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section faq-section" id="faq">
          <div className="container faq-grid">
            <div className="section-heading">
              <span className="eyebrow">MENGENAL CLIPPR LEBIH DEKAT</span>
              <h2>
                Ada yang Ingin
                <br />
                Anda Ketahui?
              </h2>
              <p>Beberapa hal sebelum memulai.</p>
            </div>
            <div className="faq-list">
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    {question}
                    <Icon name="chevron" size={17} />
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="cta-section container">
          <div className="cta-panel">
            <span className="pill">
              <Icon name="layers" size={12} /> Arsip webinar Anda masih punya
              banyak cerita
            </span>
            <h2>
              Siap Menghidupkan Kembali
              <br />
              Pengetahuan dalam Rekaman Anda?
            </h2>
            <p>
              Mulai dari satu webinar. Temukan cuplikan bermakna
              <br className="desktop-break" /> yang membuat ilmu Anda terus
              berjalan.
            </p>
            <button className="button primary" onClick={openStart}>
              Mulai Buat Cuplikan <Icon name="arrow" size={16} />
            </button>
            <span className="cta-note">
              Konsep utuh · Tiga pilihan layout · MP4 & SRT
            </span>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
