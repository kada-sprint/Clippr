import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import './queue.css';

export default function QueuePage() {
  const location = useLocation();
  const project = location.state?.project;
  const [copied, setCopied] = useState(false);

  function handleCopySession() {
    if (!project?.id) return;
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isTranscribed = project?.status === 'TRANSCRIBED';

  const stages = [
    {
      title: 'Persiapan Video',
      icon: 'upload',
      description: 'Pemeriksaan berkas dan persiapan audio.',
      status: project ? 'Selesai' : 'Belum dimulai',
    },
    {
      title: 'Transkripsi Audio',
      icon: 'edit',
      description: 'Penyusunan transkrip dengan waktu per kata.',
      status: isTranscribed ? 'Selesai' : (project ? 'Memproses' : 'Belum dimulai'),
    },
    {
      title: 'Kurasi Konsep',
      icon: 'spark',
      description: 'Pemilihan potongan dengan materi ajar yang utuh.',
      status: isTranscribed ? 'Siap dikurasi' : 'Belum dimulai',
    },
    {
      title: 'Render Video 9:16',
      icon: 'video',
      description: 'Penyusunan layout vertikal dan subtitle.',
      status: 'Belum dimulai',
    },
  ];

  return (
    <section className="queue-page" aria-labelledby="queue-title">
      <header className="queue-heading">
        <span className="queue-badge">
          <span style={isTranscribed ? { background: '#86efac' } : undefined} />
          {isTranscribed ? 'TERTRANSKRIPSI' : (project ? project.status : 'MENUNGGU VIDEO')}
        </span>
        <h1 id="queue-title">Status Antrean Pemrosesan</h1>
        <p>Pantau tahapan webinar Anda menjadi klip edukasi vertikal, dalam satu tempat.</p>
      </header>

      <section className="queue-panel" aria-labelledby="queue-video-title">
        <div className="queue-video">
          <div className="queue-video-icon"><Icon name="video" size={27} /></div>
          <div className="queue-video-details">
            <h2 id="queue-video-title">
              {project ? (project.title || `Proyek: ${project.id}`) : 'Belum ada video dalam antrean'}
            </h2>
            <p>
              Target hasil: <span>3–5 klip</span><span aria-hidden="true"> · </span>25–75 detik per klip
              {project?.selectedLayout && (
                <> · Layout: <strong>{project.selectedLayout}</strong></>
              )}
            </p>
          </div>
          <div className="queue-session">
            <button
              type="button"
              className="button secondary"
              disabled={!project}
              onClick={handleCopySession}
              aria-describedby="queue-session-note"
            >
              <Icon name="layers" size={16} />
              {copied ? 'Tautan Disalin!' : 'Salin Tautan Sesi'}
            </button>
            <small id="queue-session-note">
              {project ? 'Tautan sesi aktif untuk kembali ke proyek ini.' : 'Tersedia setelah sesi pemrosesan dibuat.'}
            </small>
          </div>
        </div>

        <ol className="queue-stages" aria-label="Tahapan pemrosesan video">
          {stages.map((stage, index) => (
            <li className="queue-stage" key={stage.title}>
              <div className="queue-stage-top">
                <span className="queue-stage-icon"><Icon name={stage.icon} size={21} /></span>
                <span
                  className="queue-stage-status"
                  style={
                    stage.status === 'Selesai'
                      ? { background: '#14532d', color: '#86efac' }
                      : stage.status === 'Siap dikurasi'
                      ? { background: '#1e3a5f', color: '#93c5fd' }
                      : undefined
                  }
                >
                  {stage.status}
                </span>
              </div>
              <h3>{index + 1}. {stage.title}</h3>
              <p>{stage.description}</p>
            </li>
          ))}
        </ol>

        {project?.transcriptJson && Array.isArray(project.transcriptJson) && project.transcriptJson.length > 0 && (
          <div style={{ marginTop: '24px', padding: '16px', background: '#191f2b', border: '1px solid #283141', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 650, color: '#93c5fd', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="check" size={14} /> Hasil Ekstraksi & Transkripsi (Whisper)
              </span>
              <span style={{ fontSize: '10px', color: '#aab5c6' }}>{project.transcriptJson.length} kata terdeteksi</span>
            </div>
            <p style={{ fontSize: '12px', color: '#abb8c9', lineHeight: '1.7', maxHeight: '100px', overflowY: 'auto', margin: 0 }}>
              {project.transcriptJson.slice(0, 80).map((t) => t.word || t.text).join(' ')}
              {project.transcriptJson.length > 80 ? ' …' : ''}
            </p>
          </div>
        )}
      </section>

      <aside className="queue-info" aria-labelledby="queue-info-title">
        <span className="queue-info-icon"><Icon name="clock" size={23} /></span>
        <div className="queue-info-copy">
          <h2 id="queue-info-title">
            {project ? 'Transkripsi Berhasil Disimpan' : 'Antrean siap untuk langkah berikutnya'}
          </h2>
          <p>
            {project
              ? 'File video sumber telah disimpan, audio diekstrak, dan transkrip dengan word-level timestamp siap digunakan untuk kurasi klip.'
              : 'Pengiriman dan pemrosesan video telah siap. Anda dapat mengunggah rekaman webinar Anda di halaman unggah.'}
          </p>
        </div>
        <div className="queue-actions">
          <Link className="button secondary" to="/editor"><Icon name="edit" size={16} />Buka di Editor</Link>
          <Link className="button primary" to="/upload"><Icon name="plus" size={17} />Unggah Video Baru</Link>
        </div>
      </aside>
    </section>
  );
}
