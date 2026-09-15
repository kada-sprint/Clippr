import Icon from '../../../components/Icon.jsx';
import { formatTime } from '../editor.example.js';

const STATUS_CONFIG = {
  pending: { label: 'Menunggu', className: 'clip-status--pending' },
  needs_review: { label: 'Perlu Review', className: 'clip-status--needs-review' },
  rendering: { label: 'Rendering', className: 'clip-status--rendering' },
  rendered: { label: 'Selesai', className: 'clip-status--rendered' },
  error: { label: 'Gagal', className: 'clip-status--error' },
};

export default function ClipCard({ clip, isSelected, onClick }) {
  const status = STATUS_CONFIG[clip.status] || STATUS_CONFIG.pending;
  const duration = Math.round((Number(clip.endTime) - Number(clip.startTime)) * 10) / 10;
  const videoSrc = clip.subtitledVideoPath || clip.clipVideoPath;

  return (
    <button
      className={`editor-clip ${isSelected ? 'is-selected' : ''}`}
      aria-pressed={isSelected}
      onClick={onClick}
    >
      <span className="editor-thumbnail">
        {videoSrc ? (
          <video src={videoSrc} muted preload="metadata" />
        ) : (
          <Icon name="video" size={30} />
        )}
        <small>{duration} dtk</small>
      </span>
      <span className="editor-clip-copy">
        <span className={`clip-status-badge ${status.className}`}>
          {status.label}
        </span>
        <strong>{clip.title || 'Tanpa judul'}</strong>
        <span>{clip.subtitle || ''}</span>
      </span>
      <span className="editor-clip-footer">
        <span>
          {formatTime(Number(clip.startTime))} → {formatTime(Number(clip.endTime))}
        </span>
        <b>
          {isSelected ? 'Aktif di kanvas' : 'Pilih klip'}
        </b>
      </span>
    </button>
  );
}
