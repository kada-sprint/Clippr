import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { formatTime } from './editor.example.js';
import ClipCard from './components/ClipCard.jsx';
import useClipPolling from './useClipPolling.js';
import './editor.css';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EditorPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const projectId = params.get('projectId');
  const validProjectId = projectId && UUID_PATTERN.test(projectId) ? projectId : null;

  const { clips, loading, error } = useClipPolling(validProjectId);
  const [selectedId, setSelectedId] = useState(null);

  const clip = clips.find((item) => item.id === selectedId);
  const duration = clip ? Number(clip.endTime) - Number(clip.startTime) : 0;

  return (
    <section className="editor-page" aria-labelledby="editor-title">
      <header className="editor-page-heading">
        <h1 id="editor-title">Review & Editor</h1>
        {!validProjectId && (
          <p>Buka proyek dari dashboard untuk melihat klip hasil kurasi.</p>
        )}
      </header>
      <div className="editor-grid">
        <aside className="editor-library" aria-label="Daftar klip">
          <div className="editor-library-heading">
            <h2>
              <Icon name="spark" />
              Rekomendasi Klip
            </h2>
            <span>{clips.length} klip</span>
          </div>

          {loading && (
            <div className="editor-empty" role="status">
              <Icon name="clock" size={24} />
              <p>Memuat klip…</p>
            </div>
          )}

          {!loading && error && (
            <div className="editor-empty editor-empty--error" role="alert">
              <Icon name="close" size={24} />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && clips.length === 0 && (
            <div className="editor-empty">
              <Icon name="spark" size={24} />
              <p>Belum ada klip hasil kurasi.</p>
            </div>
          )}

          {!loading && !error && clips.map((item) => (
            <ClipCard
              key={item.id}
              clip={item}
              isSelected={item.id === selectedId}
              onClick={() => setSelectedId(item.id)}
            />
          ))}
        </aside>

        <div className="editor-workspace">
          {!clip && (
            <div className="editor-empty">
              <Icon name="video" size={24} />
              <p>Pilih klip dari daftar untuk melihat pratinjau.</p>
            </div>
          )}

          {clip && (
            <>
              <section
                className="editor-preview"
                aria-label="Pratinjau layout klip"
              >
                <div className="editor-preview-heading">
                  <span>9:16 · Slide + Pembicara</span>
                  <small>{clip.title}</small>
                </div>
                <div className="editor-canvas">
                  <span className="editor-canvas-label">
                    CLIPPR
                  </span>
                  <div className="editor-presenter">
                    <div>
                      <Icon name="user" size={66} />
                    </div>
                    <span>Ilustrasi pembicara</span>
                  </div>
                  <p className="editor-caption">
                    {clip.subtitle || 'Teks subtitle akan muncul di sini.'}
                  </p>
                  <span className="editor-canvas-duration">
                    {duration} detik
                  </span>
                </div>
              </section>
              <section className="editor-panel" aria-labelledby="timing-heading">
                <h2 id="timing-heading">
                  <Icon name="clock" />
                  Waktu Klip
                </h2>
                <div className="editor-time-grid">
                  <div className="editor-time">
                    <h3>Waktu mulai</h3>
                    <output>{formatTime(Number(clip.startTime))}</output>
                  </div>
                  <div className="editor-time">
                    <h3>Waktu selesai</h3>
                    <output>{formatTime(Number(clip.endTime))}</output>
                  </div>
                </div>
                <p className="editor-timing-note">
                  Durasi klip: <strong>{duration} detik</strong> · Batas 25–75 detik
                </p>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
