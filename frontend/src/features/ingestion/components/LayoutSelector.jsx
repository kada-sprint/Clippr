import Icon from '../../../components/Icon.jsx';

const layouts = [
  { value: 'slide-cam', label: 'Slide + Pembicara', badge: 'REKOMENDASI EDUKASI', description: 'Materi presentasi di atas, kamera pembicara di bawah. Menjaga penjelasan dan visual tetap selaras.' },
  { value: 'talking-head', label: 'Wajah Penuh', badge: 'FOKUS PEMBICARA', description: 'Bingkai vertikal yang berpusat pada pembicara. Cocok untuk penjelasan langsung, diskusi, dan sesi tanya jawab.' },
  { value: 'slide-only', label: 'Slide Saja', badge: 'FOKUS MATERI VISUAL', description: 'Tampilkan slide secara proporsional dengan ruang untuk judul dan subtitle. Diagram dan materi tetap menjadi fokus.' },
];

export default function LayoutSelector({ value, onChange, subtitleStyle }) {
  const highlighted = subtitleStyle === 'active_word_highlight';
  return (
    <section className="ingestion-layouts" aria-labelledby="layout-choice-title">
      <div className="ingestion-section-title"><h2 id="layout-choice-title">Pilih Template Layout 9:16</h2><span>Format Reels · TikTok · Shorts</span></div>
      <p className="ingestion-description">Sesuaikan bingkai vertikal dengan cara Anda menyampaikan materi.</p>
      <div className="ingestion-layout-grid" role="radiogroup" aria-labelledby="layout-choice-title">
        {layouts.map((layout, index) => (
          <label className={`ingestion-layout-card ${value === layout.value ? 'is-selected' : ''}`} key={layout.value}>
            <input type="radio" name="video-layout" value={layout.value} checked={value === layout.value} onChange={() => onChange(layout.value)} />
            <div className="layout-card-top"><span>{layout.badge}</span><i><Icon name="check" size={12} /></i></div>
            <div className={`ingestion-portrait ingestion-portrait-${index} ${highlighted ? 'highlight-subtitle' : ''}`} aria-hidden="true">
              {index === 0 && <>
                <div className="ingestion-slide"><span>SLIDE KULIAH</span><div className="slide-lesson-lines"><b /><i /></div><small>Modul 04.2</small></div>
                <div className="ingestion-caption">“Kunci arsitektur <mark>transformer</mark> adalah…”</div>
                <div className="ingestion-speaker"><span><Icon name="user" size={24} /></span><small>Kamera pembicara</small></div>
              </>}
              {index === 1 && <>
                <span className="portrait-label">BINGKAI PEMBICARA</span><span className="speaker-focus-icon"><Icon name="user" size={35} /></span>
                <div className="speaker-wave"><i /><i /><i /><i /></div>
                <div className="ingestion-caption">“Mulai dari <mark>satu gagasan</mark> yang jelas.”</div>
              </>}
              {index === 2 && <>
                <div className="diagram-slide"><span>DIAGRAM ARSITEKTUR</span><div><i /><i /><i /></div><b /></div>
                <div className="ingestion-caption">“Perhatikan <mark>aliran data</mark> ini…”</div>
              </>}
            </div>
            <h3>Template {String.fromCharCode(65 + index)}: {layout.label}</h3>
            <p>{layout.description}</p>
          </label>
        ))}
      </div>
    </section>
  );
}
