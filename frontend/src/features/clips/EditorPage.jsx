import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { exampleClips, formatTime } from './editor.example.js';
import './editor.css';

export default function EditorPage() {
  const [clips, setClips] = useState(() => exampleClips.map(clip => ({ ...clip, style: 'clean' })));
  const [selectedId, setSelectedId] = useState(1);
  const clip = clips.find(item => item.id === selectedId);
  const original = exampleClips.find(item => item.id === selectedId);
  const duration = clip.end - clip.start;
  const changed = clip.title !== original.title || clip.subtitle !== original.subtitle || clip.start !== original.start || clip.end !== original.end || clip.style !== 'clean';
  function update(patch) {
    setClips(current => current.map(item => item.id === selectedId ? { ...item, ...patch } : item));
  }
  function canNudge(field, delta) {
    const start = clip.start + (field === 'start' ? delta : 0);
    const end = clip.end + (field === 'end' ? delta : 0);
    return start >= 0 && end <= 2400 && end - start >= 25 && end - start <= 75;
  }
  return (
    <section className="editor-page" aria-labelledby="editor-title">
      <header className="editor-page-heading">
        <span className="editor-tag">PRATINJAU UI · DATA CONTOH</span>
        <h1 id="editor-title">Review & Editor</h1>
        <p>Coba sunting tiga klip contoh. Perubahan hanya berlaku di halaman ini dan direset saat halaman dimuat ulang.</p>
        <div className="editor-export">
          <button className="button secondary" disabled><Icon name="download" />Unduh SRT</button>
          <button className="button primary" disabled><Icon name="download" />Unduh MP4 (1080×1920)</button>
          <small>Unduhan tersedia setelah integrasi pemrosesan video.</small>
        </div>
      </header>
      <div className="editor-grid">
        <aside className="editor-library" aria-label="Pilihan klip contoh">
          <div className="editor-library-heading"><h2><Icon name="spark" />Rekomendasi Klip</h2><span>3 contoh</span></div>
          {clips.map((item, index) => (
            <button key={item.id} className={`editor-clip ${item.id === selectedId ? 'is-selected' : ''}`} aria-pressed={item.id === selectedId} onClick={() => setSelectedId(item.id)}>
              <span className={`editor-thumbnail thumbnail-${index}`}><Icon name={index === 1 ? 'slide' : 'user'} size={30} /><small>{item.end - item.start} dtk</small></span>
              <span className="editor-clip-copy"><span className="editor-tag">KLIP CONTOH {index + 1}</span><strong>{index + 1}. {item.title || 'Tanpa judul'}</strong><span>{item.subtitle}</span></span>
              <span className="editor-clip-footer"><span>{formatTime(item.start)} → {formatTime(item.end)}</span><b>{item.id === selectedId ? 'Aktif di kanvas' : 'Pilih klip'}</b></span>
            </button>
          ))}
        </aside>
        <div className="editor-workspace">
          <section className="editor-preview" aria-label="Pratinjau layout klip">
            <div className="editor-preview-heading"><span>9:16 · Slide + Pembicara</span><small>Ilustrasi statis, bukan video</small></div>
            <div className="editor-canvas">
              <span className="editor-canvas-label">CLIPPR / MATERI CONTOH</span>
              <div className="editor-slide"><small>MEMAHAMI KECERDASAN ARTIFISIAL</small><h2>{clip.topic}</h2><div className="editor-diagram">{clip.terms.map(term => <span key={term}>{term}</span>)}</div><div className="editor-slide-lines"><i /><i /><i /></div></div>
              <div className="editor-presenter"><div><Icon name="user" size={66} /></div><span>Ilustrasi pembicara</span></div>
              <p className="editor-caption">{clip.subtitle ? clip.style === 'active_word_highlight' ? clip.subtitle.split(/(\s+)/).map((word, index) => index === 0 ? <mark key={index}>{word}</mark> : word) : clip.subtitle : 'Teks subtitle akan muncul di sini.'}</p>
              <span className="editor-canvas-duration">{duration} detik · Pratinjau layout</span>
            </div>
          </section>
          <section className="editor-panel" aria-labelledby="timing-heading">
            <h2 id="timing-heading"><Icon name="clock" />Penyesuaian Waktu Klip</h2>
            <div className="editor-time-grid">
              {['start', 'end'].map(field => <div className="editor-time" key={field}><h3>{field === 'start' ? 'Waktu mulai' : 'Waktu selesai'}</h3><div>{[-0.5, 0.5].map(delta => <button key={delta} className={delta > 0 ? 'nudge-plus' : ''} aria-label={`${field === 'start' ? 'Waktu mulai' : 'Waktu selesai'} ${delta > 0 ? 'tambah' : 'kurangi'} 0,5 detik`} disabled={!canNudge(field, delta)} onClick={() => { if (canNudge(field, delta)) update({ [field]: clip[field] + delta }); }}>{delta > 0 ? '+' : '−'}0,5s</button>)}<output>{formatTime(clip[field])}</output></div></div>)}
            </div>
            <p className="editor-timing-note" aria-live="polite">Durasi klip: <strong>{duration} detik</strong> · Batas 25–75 detik</p>
            <button className="editor-text-button" onClick={() => update({ start: original.start, end: original.end })}>Reset waktu ke contoh awal</button>
          </section>
          <section className="editor-panel" aria-labelledby="subtitle-heading">
            <h2 id="subtitle-heading"><Icon name="edit" />Koreksi Judul & Subtitle</h2>
            <label className="editor-field">Judul klip<input value={clip.title} maxLength={150} onChange={event => update({ title: event.target.value })} /></label>
            <fieldset className="editor-subtitle-style"><legend>Gaya subtitle</legend>{[{ value: 'clean', label: 'Bersih' }, { value: 'active_word_highlight', label: 'Sorotan Kata Aktif' }].map(style => <label key={style.value}><input type="radio" name="subtitle-style" value={style.value} checked={clip.style === style.value} onChange={() => update({ style: style.value })} />{style.label}</label>)}</fieldset>
            <label className="editor-field">Teks subtitle contoh<textarea rows={4} maxLength={500} value={clip.subtitle} onChange={event => update({ subtitle: event.target.value })} /><small>{clip.subtitle.length}/500 karakter · Pratinjau sorotan bersifat statis, belum tersinkron dengan audio.</small></label>
            <div className="editor-panel-footer"><button className="editor-text-button" onClick={() => update({ subtitle: original.subtitle })}>Reset teks subtitle</button><span>{changed ? 'Contoh telah diubah secara lokal' : 'Belum ada perubahan'}</span></div>
          </section>
          <div className="editor-render"><p>Perubahan belum disimpan ke server. Render ulang belum tersedia.</p><button className="button primary" disabled><Icon name="video" />Render Ulang Klip</button></div>
        </div>
      </div>
    </section>
  );
}
