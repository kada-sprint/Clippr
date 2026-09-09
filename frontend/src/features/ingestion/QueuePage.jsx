import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import './queue.css';

const stages = [
  { title: 'Persiapan Video', icon: 'upload', description: 'Pemeriksaan berkas dan persiapan audio.' },
  { title: 'Transkripsi Audio', icon: 'edit', description: 'Penyusunan transkrip dengan waktu per kata.' },
  { title: 'Kurasi Konsep', icon: 'spark', description: 'Pemilihan potongan dengan materi ajar yang utuh.' },
  { title: 'Render Video 9:16', icon: 'video', description: 'Penyusunan layout vertikal dan subtitle.' },
];

export default function QueuePage() {
  return (
    <section className="queue-page" aria-labelledby="queue-title">
      <header className="queue-heading">
        <span className="queue-badge"><span />MENUNGGU VIDEO</span>
        <h1 id="queue-title">Status Antrean Pemrosesan</h1>
        <p>Pantau tahapan webinar Anda menjadi klip edukasi vertikal, dalam satu tempat.</p>
      </header>

      <section className="queue-panel" aria-labelledby="queue-video-title">
        <div className="queue-video">
          <div className="queue-video-icon"><Icon name="video" size={27} /></div>
          <div className="queue-video-details">
            <h2 id="queue-video-title">Belum ada video dalam antrean</h2>
            <p>Target hasil: <span>3–5 klip</span><span aria-hidden="true"> · </span>25–75 detik per klip</p>
          </div>
          <div className="queue-session">
            <button className="button secondary" disabled aria-describedby="queue-session-note"><Icon name="layers" size={16} />Salin Tautan Sesi</button>
            <small id="queue-session-note">Tersedia setelah sesi pemrosesan dibuat.</small>
          </div>
        </div>

        <ol className="queue-stages" aria-label="Tahapan pemrosesan video">
          {stages.map((stage, index) => (
            <li className="queue-stage" key={stage.title}>
              <div className="queue-stage-top"><span className="queue-stage-icon"><Icon name={stage.icon} size={21} /></span><span className="queue-stage-status">Belum dimulai</span></div>
              <h3>{index + 1}. {stage.title}</h3>
              <p>{stage.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <aside className="queue-info" aria-labelledby="queue-info-title">
        <span className="queue-info-icon"><Icon name="clock" size={23} /></span>
        <div className="queue-info-copy">
          <h2 id="queue-info-title">Antrean siap untuk langkah berikutnya</h2>
          <p>Pengiriman dan pemrosesan video belum tersedia. Saat ini Anda dapat menyiapkan pilihan video, layout, dan subtitle di halaman unggah.</p>
        </div>
        <div className="queue-actions">
          <button className="button secondary" disabled title="Review dan klip tersimpan belum tersedia"><Icon name="layers" size={16} />Lihat Klip Tersimpan</button>
          <Link className="button primary" to="/upload"><Icon name="plus" size={17} />Unggah Video</Link>
        </div>
      </aside>
    </section>
  );
}
