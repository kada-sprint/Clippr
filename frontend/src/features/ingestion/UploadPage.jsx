import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import VideoPicker from './components/VideoPicker.jsx';
import VocabularyInput from './components/VocabularyInput.jsx';
import LayoutSelector from './components/LayoutSelector.jsx';
import './ingestion.css';

export default function UploadPage() {
  const [layout, setLayout] = useState('slide-cam');
  const [subtitleStyle, setSubtitleStyle] = useState('clean');

  return (
    <div className="upload-page">
      <header className="upload-heading">
        <span className="upload-eyebrow"><Icon name="spark" size={14} /> DIMULAI DARI KELENGKAPAN KONSEP AJAR</span>
        <h1>Unggah Webinar Anda</h1>
        <p>Siapkan rekaman Anda untuk cuplikan edukasi vertikal 9:16 dengan konsep yang tetap utuh.</p>
        <div className="upload-highlights"><span>Pembuka yang kontekstual</span><i>·</i><span>Penjelasan yang lengkap</span><i>·</i><span>Kesimpulan mandiri</span></div>
      </header>
      <VideoPicker />
      <VocabularyInput />
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
        <button type="button" className="button primary" disabled aria-describedby="upload-availability"><Icon name="video" size={19} /> Mulai Proses <span>3–5 KLIP</span></button>
        <p id="upload-availability">Pengiriman video belum tersedia. Anda bisa menyiapkan pilihan file dan tampilan terlebih dahulu.</p>
        <small>Pilihan hanya tersimpan selama halaman ini terbuka.</small>
      </div>
    </div>
  );
}
