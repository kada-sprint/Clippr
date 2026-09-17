import { useState } from 'react';
import Icon from '../../../components/Icon.jsx';

const options = [
  { icon: 'video', title: 'Slide + Pembicara', detail: 'Slide tetap terbaca, pembicara tetap hadir.', tag: 'REKOMENDASI' },
  { icon: 'user', title: 'Fokus Pembicara', detail: 'Bingkai vertikal yang berpusat pada pengajar.' },
  { icon: 'slide', title: 'Slide Saja', detail: 'Ruang penuh untuk diagram dan materi presentasi.' },
];

export default function WorkspaceDemo({ onStart }) {
  const [layout, setLayout] = useState(0);
  const [terms, setTerms] = useState(['Design Thinking', 'Customer Journey', 'Kubernetes', 'Microservices']);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('');

  function addTerm(event) {
    event.preventDefault();
    const term = input.trim();
    if (!term) return;
    if (terms.some((item) => item.toLowerCase() === term.toLowerCase())) return setMessage('Istilah ini sudah ada.');
    if (terms.length >= 20) return setMessage('Maksimal 20 istilah kustom.');
    setTerms([...terms, term]);
    setInput('');
    setMessage('Istilah ditambahkan ke demo.');
  }

  return <div className="workspace" id="demo">
    <div className="workspace-bar"><div><span className="app-icon"><Icon name="layers" size={15} /></span><strong>Sesi baru: Berbagi Pengetahuan</strong><span className="demo-label">DEMO INTERAKTIF</span></div><ol className="pipeline"><li className="active">Unggah</li><li>Analisis</li><li>Tinjau</li><li>Ekspor</li></ol></div>
    <div className="workspace-grid">
      <div className="workspace-left">
        <section className="demo-panel"><h3><span className="step-dot">1</span> Pilih Rekaman Webinar</h3><p>Satu rekaman, banyak kesempatan untuk berbagi ilmu.</p><button className="upload-zone" onClick={onStart}><span className="upload-icon"><Icon name="upload" size={23} /></span><strong>Mulai dari rekaman Anda</strong><span>Masuk untuk mengunggah video webinar</span><small>MP4 / MOV · Maks. 45 menit · Maks. 1 GB</small></button></section>
        <section className="demo-panel layout-picker"><div className="panel-heading"><h3><span className="step-dot">2</span> Pilih Bingkai Presentasi</h3><span className="tiny yellow">9:16 VERTIKAL</span></div><p>Sesuaikan tampilan dengan cara Anda menyampaikan materi.</p><div className="layout-options" role="group" aria-label="Pilihan layout demo">{options.map((option, index) => <button key={option.title} aria-pressed={layout === index} className={`layout-option ${layout === index ? 'selected' : ''}`} onClick={() => setLayout(index)}><span className={`layout-mini layout-mini-${index}`}><Icon name={option.icon} size={17} /></span><span><strong>{option.title} {option.tag && <em>{option.tag}</em>}</strong><small>{option.detail}</small></span><span className="radio-mark">{layout === index && <Icon name="check" size={10} />}</span></button>)}</div></section>
      </div>
      <div className="workspace-right">
        <div className="demo-panel insight"><Icon name="spark" size={20} /><div><h3>Fokus pada Isi, Bukan Sensasi</h3><p>Clippr dirancang untuk menemukan konsep lengkap: dari pertanyaan, penjelasan, hingga kesimpulan yang bisa dipahami secara mandiri.</p></div></div>
        <section className="demo-panel dictionary"><h3><span className="step-dot">3</span> Kamus Istilah Anda</h3><p>Bantu transkripsi mengenali istilah khusus yang digunakan dalam materi.</p><form onSubmit={addTerm}><label className="sr-only" htmlFor="custom-term">Istilah kustom untuk demo</label><input id="custom-term" value={input} maxLength={80} onChange={(event) => setInput(event.target.value)} placeholder="Contoh: Sprint Review" /><button className="add-term" aria-label="Tambahkan istilah" disabled={terms.length >= 20}><Icon name="plus" size={17} /></button></form><div className="term-tags">{terms.map((term) => <button key={term} onClick={() => { setTerms(terms.filter((item) => item !== term)); setMessage('Istilah dihapus dari demo.'); }} aria-label={`Hapus istilah ${term}`}>{term}<Icon name="close" size={10} /></button>)}</div><div className="term-count">{terms.length}/20 istilah kustom</div><span className="sr-only" role="status">{message}</span>
          <dl className="output-specs"><div><dt><Icon name="spark" size={13} /> Hasil kurasi</dt><dd>3–5 klip edukatif</dd></div><div><dt><Icon name="clock" size={13} /> Durasi per klip</dt><dd>25–75 detik</dd></div><div><dt><Icon name="video" size={13} /> Resolusi ekspor</dt><dd>1080 × 1920 Full HD</dd></div></dl><button className="button primary full" onClick={onStart}>Mulai Buat Cuplikan <Icon name="arrow" size={15} /></button><p className="demo-footnote"><Icon name="shield" size={11} /> Pratinjau antarmuka · Tidak mengunggah berkas</p>
        </section>
      </div>
    </div>
  </div>;
}
