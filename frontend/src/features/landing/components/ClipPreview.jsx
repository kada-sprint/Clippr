import { useState } from 'react';

export default function ClipPreview() {
  const [start, setStart] = useState(12);
  const [subtitle, setSubtitle] = useState('Tiga prinsip utama membangun microservices yang tangguh.');
  const [saved, setSaved] = useState(false);
  const duration = (46.5 - start).toFixed(1);
  return <div className="clip-editor">
    <div className="editor-heading"><strong><i className="status-dot blue" /> Pratinjau Klip #02</strong><span className="score">Contoh editor</span></div>
    <div className="editor-screen"><div className="screen-meta"><span>00:{start.toFixed(1).padStart(4, '0')} — 00:46.5</span><span>▣ 1080 × 1920</span></div><div className="subtitle-box"><label htmlFor="demo-subtitle">KLIK TEKS UNTUK MENGEDIT SUBTITLE</label><textarea id="demo-subtitle" maxLength={160} value={subtitle} onChange={(event) => { setSubtitle(event.target.value); setSaved(false); }} aria-label="Subtitle contoh klip" spellCheck="false" /><span className="subtitle-hint">Satu konsep. Satu pemahaman utuh.</span></div><div className="video-progress"><span /></div></div>
    <div className="editor-controls"><span className="eyebrow">SESUAIKAN BATAS WAKTU</span><div className="time-controls"><div><span>WAKTU MULAI</span><strong>00:{start.toFixed(1).padStart(4, '0')}</strong></div><button onClick={() => { setStart(Math.max(0, start - 0.5)); setSaved(false); }} disabled={start === 0} aria-label="Mundurkan waktu mulai 0,5 detik">−0,5 dtk</button><button onClick={() => { setStart(Math.min(21.5, start + 0.5)); setSaved(false); }} disabled={start === 21.5} aria-label="Majukan waktu mulai 0,5 detik">+0,5 dtk</button></div><div className="editor-save"><span><i className="status-dot" /> Durasi: {duration.replace('.', ',')} detik</span><button className="button primary mini" onClick={() => setSaved(true)} disabled={!subtitle.trim()}>Terapkan</button></div><p className="editor-message" role="status">{saved ? 'Perubahan diterapkan pada demo ini.' : 'Coba edit teks dan geser waktu per 0,5 detik.'}</p></div>
  </div>;
}
