import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { formatTime } from './editor.example.js';
import ClipCard from './components/ClipCard.jsx';
import useClipPolling from './useClipPolling.js';
import { fetchTranscript, updateClip, renderClip } from './clips.api.js';
import './editor.css';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

const LAYOUT_LABELS = {
  'slide-cam': 'Slide + Pembicara',
  'talking-head': 'Wajah Penuh',
  'slide-only': 'Slide Saja',
};

const NUDGE_STEP = 0.5;
const MIN_DURATION = 25;
const MAX_DURATION = 75;

export default function EditorPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const projectId = params.get('projectId');
  const validProjectId = projectId && UUID_PATTERN.test(projectId) ? projectId : null;

  const { clips, setClips, loading, error } = useClipPolling(validProjectId);
  const [selectedId, setSelectedId] = useState(null);

  const [editedTitle, setEditedTitle] = useState('');
  const [editedStartTime, setEditedStartTime] = useState(0);
  const [editedEndTime, setEditedEndTime] = useState(0);
  const [editedWords, setEditedWords] = useState({});
  const [editedSubtitleStyle, setEditedSubtitleStyle] = useState('clean');
  const [editedHorizontalOffset, setEditedHorizontalOffset] = useState(0);

  const [transcript, setTranscript] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  const [saveLoading, setSaveLoading] = useState(false);
  const [renderLoading, setRenderLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSelectedId, setPendingSelectedId] = useState(null);

  const clip = clips.find((item) => item.id === selectedId);

  useEffect(() => {
    if (clips.length > 0 && !selectedId) {
      setSelectedId(clips[0].id);
    }
  }, [clips, selectedId]);

  const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  const videoSrc = clip?.subtitledVideoPath
    ? `${API_BASE}/api/media/${validProjectId}/${clip.id}/subtitled.mp4`
    : clip?.clipVideoPath
    ? `${API_BASE}/api/media/${validProjectId}/${clip.id}/vertical.mp4`
    : null;

  const originalValues = useMemo(() => {
    if (!clip) return null;
    return {
      title: clip.title || '',
      startTime: Number(clip.startTime),
      endTime: Number(clip.endTime),
      subtitleStyle: clip.subtitleStyle || 'clean',
      horizontalOffset: clip.horizontalOffset ?? 0,
    };
  }, [clip]);

  const isDirty = useMemo(() => {
    if (!originalValues) return false;
    return (
      editedTitle !== originalValues.title ||
      editedStartTime !== originalValues.startTime ||
      editedEndTime !== originalValues.endTime ||
      editedSubtitleStyle !== originalValues.subtitleStyle ||
      editedHorizontalOffset !== originalValues.horizontalOffset ||
      Object.keys(editedWords).length > 0
    );
  }, [editedTitle, editedStartTime, editedEndTime, editedSubtitleStyle, editedHorizontalOffset, editedWords, originalValues]);

  const duration = editedEndTime - editedStartTime;

  const canNudgeStartMinus = editedStartTime > 0 && editedEndTime - editedStartTime > MIN_DURATION;
  const canNudgeStartPlus = editedEndTime - editedStartTime > MIN_DURATION && editedEndTime - (editedStartTime + NUDGE_STEP) >= MIN_DURATION;
  const canNudgeEndMinus = editedEndTime - editedStartTime > MIN_DURATION && editedEndTime - NUDGE_STEP - editedStartTime >= MIN_DURATION;
  const canNudgeEndPlus = editedEndTime - editedStartTime < MAX_DURATION;

  useEffect(() => {
    if (!clip) {
      setTranscript(null);
      return;
    }

    setEditedTitle(clip.title || '');
    setEditedStartTime(Number(clip.startTime));
    setEditedEndTime(Number(clip.endTime));
    setEditedSubtitleStyle(clip.subtitleStyle || 'clean');
    setEditedHorizontalOffset(clip.horizontalOffset ?? 0);
    setEditedWords({});
    setSaveMessage(null);

    let cancelled = false;
    setTranscriptLoading(true);
    fetchTranscript(clip.id)
      .then((data) => {
        if (!cancelled) setTranscript(data.transcriptJson);
      })
      .catch(() => {
        if (!cancelled) setTranscript(null);
      })
      .finally(() => {
        if (!cancelled) setTranscriptLoading(false);
      });

    return () => { cancelled = true; };
  }, [clip?.id]);

  const handleSelectClip = useCallback((clipId) => {
    if (clipId === selectedId) return;
    if (isDirty) {
      setPendingSelectedId(clipId);
      setShowConfirmDialog(true);
    } else {
      setSelectedId(clipId);
    }
  }, [selectedId, isDirty]);

  const handleConfirmDiscard = useCallback(() => {
    setSelectedId(pendingSelectedId);
    setShowConfirmDialog(false);
    setPendingSelectedId(null);
  }, [pendingSelectedId]);

  const handleConfirmSave = useCallback(async () => {
    if (!clip) return;
    setSaveLoading(true);
    try {
      const words = transcript?.words?.map((w, i) =>
        editedWords[i] !== undefined ? { ...w, word: editedWords[i] } : w
      );
      await updateClip(clip.id, {
        title: editedTitle,
        startTime: editedStartTime,
        endTime: editedEndTime,
        subtitleStyle: editedSubtitleStyle,
        horizontalOffset: editedHorizontalOffset,
        transcriptJson: words ? { words } : undefined,
      });
      setSelectedId(pendingSelectedId);
      setShowConfirmDialog(false);
      setPendingSelectedId(null);
      setEditedWords({});
    } catch {
      // Error handled by toast or status
    } finally {
      setSaveLoading(false);
    }
  }, [clip, editedTitle, editedStartTime, editedEndTime, editedSubtitleStyle, editedHorizontalOffset, editedWords, transcript, pendingSelectedId]);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
    setPendingSelectedId(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!clip) return;
    setSaveLoading(true);
    setSaveMessage(null);
    try {
      const words = transcript?.words?.map((w, i) =>
        editedWords[i] !== undefined ? { ...w, word: editedWords[i] } : w
      );
      await updateClip(clip.id, {
        title: editedTitle,
        startTime: editedStartTime,
        endTime: editedEndTime,
        subtitleStyle: editedSubtitleStyle,
        horizontalOffset: editedHorizontalOffset,
        transcriptJson: words ? { words } : undefined,
      });
      setEditedWords({});
      setSaveMessage('Tersimpan');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage('Gagal menyimpan');
    } finally {
      setSaveLoading(false);
    }
  }, [clip, editedTitle, editedStartTime, editedEndTime, editedSubtitleStyle, editedHorizontalOffset, editedWords, transcript]);

  const handleRender = useCallback(async () => {
    if (!clip) return;
    setRenderLoading(true);
    try {
      const updated = await renderClip(clip.id);
      setClips((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    } catch {
      // Error handled by status polling
    } finally {
      setRenderLoading(false);
    }
  }, [clip, setClips]);

  const nudgeStart = (delta) => {
    const next = Math.max(0, editedStartTime + delta);
    if (next < editedEndTime - MIN_DURATION) {
      setEditedStartTime(Math.round(next * 10) / 10);
    }
  };

  const nudgeEnd = (delta) => {
    const next = editedEndTime + delta;
    if (next > editedStartTime + MIN_DURATION && next - editedStartTime <= MAX_DURATION) {
      setEditedEndTime(Math.round(next * 10) / 10);
    }
  };

  const handleWordEdit = (index, value) => {
    setEditedWords((prev) => {
      const next = { ...prev };
      if (value === transcript?.words?.[index]?.word) {
        delete next[index];
      } else {
        next[index] = value;
      }
      return next;
    });
  };

  const canRender = clip && !isDirty && clip.status !== 'rendering';

  return (
    <section className="editor-page" aria-labelledby="editor-title">
      <header className="editor-page-heading">
        <Link className="button secondary editor-back-link" to="/projects">
          <Icon name="arrow-left" size={16} />
          Kembali ke My Project
        </Link>
        <h1 id="editor-title">Review & Editor</h1>
        {!validProjectId && (
          <p>Buka proyek dari dashboard untuk melihat klip hasil kurasi.</p>
        )}
      </header>

      {showConfirmDialog && (
        <div className="editor-dialog-overlay" onClick={handleCancelConfirm}>
          <div className="editor-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Anda memiliki perubahan yang belum disimpan. Tinggalkan tanpa menyimpan?</p>
            <div className="editor-dialog-actions">
              <button className="button" onClick={handleCancelConfirm}>
                Batal
              </button>
              <button className="button" onClick={handleConfirmDiscard} disabled={saveLoading}>
                Buang & Pindah
              </button>
              <button className="button primary" onClick={handleConfirmSave} disabled={saveLoading}>
                Simpan & Pindah
              </button>
            </div>
          </div>
        </div>
      )}

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
              onClick={() => handleSelectClip(item.id)}
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
              <section className="editor-preview" aria-label="Pratinjau layout klip">
                <div className="editor-preview-heading">
                  <span className="editor-heading-left">
                    <span>9:16 · {LAYOUT_LABELS[clip.project?.selectedLayout] || 'Slide + Pembicara'}</span>
                    {clip.status === 'rendered' && (
                      <>
                        <a
                          href={`${API_BASE}/api/clips/${clip.id}/export/mp4`}
                          download
                          className="editor-export-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon name="download" size={12} /> MP4
                        </a>
                        <a
                          href={`${API_BASE}/api/clips/${clip.id}/export/srt`}
                          download
                          className="editor-export-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon name="download" size={12} /> SRT
                        </a>
                      </>
                    )}
                  </span>
                  <small>{clip.title}</small>
                </div>
                <div className="editor-canvas">
                  <span className="editor-canvas-label">CLIPPR</span>
                  {clip.status === 'rendering' && (
                    <div className="editor-canvas-processing">
                      <Icon name="clock" size={32} />
                      <span>Rendering…</span>
                    </div>
                  )}
                  {clip.status === 'rendered' && videoSrc && (
                    <video
                      key={`${clip.id}-${clip.status}`}
                      src={videoSrc}
                      controls
                      className="editor-video"
                    />
                  )}
                  {clip.status === 'error' && (
                    <div className="editor-canvas-error">
                      <Icon name="close" size={32} />
                      <span>Gagal merender</span>
                    </div>
                  )}
                  {(!clip.status || clip.status === 'pending' || clip.status === 'needs_review') && (
                    <div className="editor-canvas-placeholder">
                      <Icon name="video" size={32} />
                      <span>Belum ada video</span>
                    </div>
                  )}
                  <span className="editor-canvas-duration">{duration} detik</span>
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
                    <div>
                      <button onClick={() => nudgeStart(-NUDGE_STEP)} disabled={!canNudgeStartMinus}>−</button>
                      <output>{formatTime(editedStartTime)}</output>
                      <button className="nudge-plus" onClick={() => nudgeStart(NUDGE_STEP)} disabled={!canNudgeStartPlus}>+</button>
                    </div>
                  </div>
                  <div className="editor-time">
                    <h3>Waktu selesai</h3>
                    <div>
                      <button onClick={() => nudgeEnd(-NUDGE_STEP)} disabled={!canNudgeEndMinus}>−</button>
                      <output>{formatTime(editedEndTime)}</output>
                      <button className="nudge-plus" onClick={() => nudgeEnd(NUDGE_STEP)} disabled={!canNudgeEndPlus}>+</button>
                    </div>
                  </div>
                </div>
                <p className="editor-timing-note">
                  Durasi klip: <strong>{duration} detik</strong> · Batas 25–75 detik
                </p>

                <div className="editor-field">
                  <label htmlFor="clip-title">Judul</label>
                  <input
                    id="clip-title"
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                  />
                </div>

                <fieldset className="editor-subtitle-style">
                  <legend>Gaya Subtitle</legend>
                  <label>
                    <input
                      type="radio"
                      name="subtitle-style"
                      value="clean"
                      checked={editedSubtitleStyle === 'clean'}
                      onChange={() => setEditedSubtitleStyle('clean')}
                    />
                    Clean
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="subtitle-style"
                      value="active_word_highlight"
                      checked={editedSubtitleStyle === 'active_word_highlight'}
                      onChange={() => setEditedSubtitleStyle('active_word_highlight')}
                    />
                    Active Word Highlight
                  </label>
                </fieldset>

                {clip.project?.selectedLayout === 'talking-head' && (
                  <div className="editor-field">
                    <label htmlFor="clip-horizontal-offset">Posisi Horizontal</label>
                    <input
                      id="clip-horizontal-offset"
                      type="range"
                      min="-0.4"
                      max="0.4"
                      step="0.01"
                      value={editedHorizontalOffset}
                      onChange={(e) => setEditedHorizontalOffset(Number(e.target.value))}
                    />
                    <small>
                      {editedHorizontalOffset > 0
                        ? `${(editedHorizontalOffset * 100).toFixed(0)}% kanan`
                        : editedHorizontalOffset < 0
                        ? `${(Math.abs(editedHorizontalOffset) * 100).toFixed(0)}% kiri`
                        : 'Tengah'}
                    </small>
                  </div>
                )}

                {transcriptLoading && (
                  <p className="editor-timing-note">Memuat transkrip…</p>
                )}

                {!transcriptLoading && transcript?.words && (
                  <div className="editor-field">
                    <label>Subtitle (klik kata untuk edit)</label>
                    <div className="editor-word-list">
                      {transcript.words.map((w, i) => (
                        <div key={i} className="editor-word-item">
                          <span className="editor-word-timestamp">
                            {formatTime(w.start_time)} – {formatTime(w.end_time)}
                          </span>
                          <input
                            className="editor-word-input"
                            type="text"
                            value={editedWords[i] !== undefined ? editedWords[i] : w.word}
                            onChange={(e) => handleWordEdit(i, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="editor-panel-footer">
                  <span>
                    {isDirty && 'Perubahan belum disimpan'}
                    {saveMessage && !isDirty && saveMessage}
                  </span>
                  <div className="editor-render">
                    <button
                      className="button primary"
                      onClick={handleSave}
                      disabled={saveLoading}
                    >
                      {saveLoading ? 'Menyimpan…' : 'Simpan'}
                    </button>
                    <button
                      className="button primary"
                      onClick={handleRender}
                      disabled={!canRender || renderLoading}
                    >
                      {clip.status === 'rendering' ? 'Rendering…' : renderLoading ? 'Memulai…' : 'Render'}
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
