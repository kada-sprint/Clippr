import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import VideoPicker from './components/VideoPicker.jsx';
import VocabularyInput from './components/VocabularyInput.jsx';
import LayoutSelector from './components/LayoutSelector.jsx';
import { uploadVideoProject } from './ingestion.api.js';
import './ingestion.css';

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [terms, setTerms] = useState([]);
  const [layout, setLayout] = useState('slide_speaker');
  const [subtitleStyle, setSubtitleStyle] = useState('clean');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    if (event) event.preventDefault();
    if (!file || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const project = await uploadVideoProject({
        file,
        layout,
        vocabulary: terms,
      });

      navigate('/queue', { state: { project } });
    } catch (error) {
      setErrorMessage(error.message || 'Gagal mengunggah dan memproses video.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="upload-page">
      <header className="upload-heading">
        <span className="upload-eyebrow"><Icon name="spark" size={14} /> DIMULAI DARI KELENGKAPAN KONSEP AJAR</span>
        <h1>Unggah Webinar Anda</h1>
        <p>Siapkan rekaman Anda untuk cuplikan edukasi vertikal 9:16 dengan konsep yang tetap utuh.</p>
        <div className="upload-highlights"><span>Pembuka yang kontekstual</span><i>·</i><span>Penjelasan yang lengkap</span><i>·</i><span>Kesimpulan mandiri</span></div>
      </header>
      <VideoPicker file={file} onFileChange={setFile} />
      <VocabularyInput value={terms} onChange={setTerms} />
      <LayoutSelector value={layout} onChange={setLayout} subtitleStyle={subtitleStyle} />
      <section className="upload-settings" aria-label="Pengaturan hasil cuplikan">
        <div className="subtitle-setting">
          <h2 id="subtitle-choice-title"><Icon name="edit" size={18} /> Gaya Subtitle</h2>
          <p>Pilih tampilan awal untuk pratinjau cuplikan Anda.</p>
          <div className="subtitle-options" role="radiogroup" aria-labelledby="subtitle-choice-title">
            {[['clean', 'Bersih'], ['active_word_highlight', 'Sorotan Kata Aktif']].map(([style, label]) => (
              <label className={subtitleStyle === style ? 'is-selected' : ''} key={style}>
                <input type="radio" name="subtitle-style" value={style} checked={subtitleStyle === style} onChange={() => setSubtitleStyle(style)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className={`subtitle-sample ${subtitleStyle === 'active_word_highlight' ? 'is-highlighted' : ''}`}>Satu konsep, <mark>satu pemahaman</mark> utuh.</div>
        </div>
        <div className="duration-setting">
          <h2><Icon name="clock" size={18} /> Durasi Tiap Klip</h2>
          <p>Ringkas, dengan penjelasan yang tetap lengkap.</p>
          <div className="duration-summary"><strong>25–75 <span>detik</span></strong><span className="clip-count">3–5 klip edukatif</span></div>
          <small>Setiap cuplikan menyampaikan satu konsep yang lengkap.</small>
        </div>
      </section>
      <div className="upload-submit">
        {errorMessage && (
          <p className="ingestion-error" role="alert" style={{ marginBottom: '18px' }}>
            {errorMessage}
          </p>
        )}
        <button
          type="button"
          className="button primary"
          disabled={!file || isSubmitting}
          onClick={handleSubmit}
          aria-describedby="upload-availability"
        >
          <Icon name={isSubmitting ? 'clock' : 'video'} size={19} />
          {isSubmitting ? 'Memproses Video & Transkripsi…' : 'Mulai Proses'} <span>3–5 KLIP</span>
        </button>
        <p id="upload-availability">
          {isSubmitting
            ? 'Sedang mengunggah, mengekstrak audio, dan mentranskripsi dengan STT Whisper. Mohon tunggu beberapa saat…'
            : (file
                ? `Video "${file.name}" siap diproses. Klik Mulai Proses untuk memulai ekstraksi dan transkripsi.`
                : 'Pilih file video MP4 atau MOV di atas untuk memulai pemrosesan.')}
        </p>
        <small>Pilihan hanya tersimpan selama halaman ini terbuka.</small>
      </div>
    </div>
  );
}
