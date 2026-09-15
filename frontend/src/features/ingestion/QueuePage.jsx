import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { useProject } from '../projects/ProjectAccess.jsx';
import './queue.css';

export default function QueuePage() {
  const location = useLocation();
  const persistedProject = useProject();
  const project = persistedProject || location.state?.project;
  const [copied, setCopied] = useState(false);

  function handleCopySession() {
    if (!project?.id) return;
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const stageOrder = ['ingest', 'transcribe', 'analyze', 'render'];
  const currentStage = project?.processingStage === 'curate' ? 'analyze' : project?.processingStage;
  const isTranscribed = project?.status === 'TRANSCRIBED' || ['analyze', 'render'].includes(currentStage) || project?.clipCount > 0;
  function stageStatus(stage) {
    if (!project) return 'Belum dimulai';
    if (currentStage === stage && project.status === 'error') return 'Gagal';
    if (currentStage === stage && project.isBusy) return 'Memproses';
    if (stage === 'render') {
      if (project.status === 'idle' && !project.isBusy && project.clipCount > 0) return 'Selesai';
      return project.isBusy && project.clipCount > 0 ? 'Memproses' : 'Belum dimulai';
    }
    if (project.clipCount > 0 || stageOrder.indexOf(currentStage) > stageOrder.indexOf(stage)) return 'Selesai';
    return 'Belum dimulai';
  }

  const stages = [
    {
      title: 'Persiapan Video',
      icon: 'upload',
      description: 'Pemeriksaan berkas dan persiapan audio.',
      status: stageStatus('ingest'),
    },
    {
      title: 'Transkripsi Audio',
      icon: 'edit',
      description: 'Penyusunan transkrip dengan waktu per kata.',
      status: stageStatus('transcribe'),
    },
    {
      title: 'Kurasi Konsep',
      icon: 'spark',
      description: 'Pemilihan potongan dengan materi ajar yang utuh.',
      status: stageStatus('analyze'),
    },
    {
      title: 'Render Video 9:16',
      icon: 'video',
      description: 'Penyusunan layout vertikal dan subtitle.',
      status: stageStatus('render'),
    },
  ];

  if (project?.status === 'deleting') {
    return (
      <section className="queue-page">
        <header className="queue-heading"><h1>Penghapusan belum selesai</h1><p>Proyek ini sudah mulai dihapus. Sebagian media mungkin sudah terhapus. Kembali ke My Project untuk mencoba hapus kembali.</p></header>
        <Link className="button primary" to="/projects">Ke My Project</Link>
      </section>
    );
  }

  return (
    <section className="queue-page" aria-labelledby="queue-title">
      <header className="queue-heading">
        <span className="queue-badge">
          <span style={isTranscribed ? { background: '#86efac' } : undefined} />
          {project?.status === 'error' ? 'PEMROSESAN GAGAL' : project?.isBusy ? 'SEDANG DIPROSES' : project?.clipCount > 0 ? 'SIAP DITINJAU' : 'MENUNGGU VIDEO'}
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
                      : stage.status === 'Memproses'
                      ? { background: '#1e3a5f', color: '#93c5fd', animation: 'pulse 1.5s ease-in-out infinite' }
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
            {project?.status === 'error' ? 'Pemrosesan belum berhasil' : project?.isBusy ? 'Pemrosesan sedang berlangsung' : isTranscribed ? 'Klip siap ditinjau' : 'Antrean siap untuk langkah berikutnya'}
          </h2>
          <p>
            {project?.status === 'error' ? 'Periksa tahap yang gagal. Hasil klip yang tersedia tetap dapat dibuka di editor.' : project?.isBusy ? 'Status diperbarui otomatis. Anda dapat membuka proyek ini kembali melalui My Project.' : project?.clipCount > 0 ? 'Buka editor untuk meninjau hasil dan status render setiap klip.' : 'Belum ada hasil klip untuk proyek ini. Unggah video untuk memulai proyek baru.'}
          </p>
        </div>
        <div className="queue-actions">
          {project?.clipCount > 0 && <Link className="button secondary" to={`/editor?projectId=${project.id}`}><Icon name="edit" size={16} />Buka di Editor</Link>}
          <Link className="button primary" to="/upload"><Icon name="plus" size={17} />Unggah Video Baru</Link>
        </div>
      </aside>
    </section>
  );
}
