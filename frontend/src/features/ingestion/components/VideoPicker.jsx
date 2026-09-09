import { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/Icon.jsx';

export default function VideoPicker() {
  const inputRef = useRef(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');

  function selectFiles(files) {
    if (!files.length) return;
    const selected = files[0];
    let message = '';
    if (files.length !== 1) message = 'Pilih satu video untuk setiap unggahan.';
    else if (!/\.(mp4|mov)$/i.test(selected.name) || (selected.type && !['video/mp4', 'video/quicktime', 'application/octet-stream'].includes(selected.type))) message = 'Gunakan video berformat MP4 atau MOV.';
    else if (selected.size === 0) message = 'File ini kosong. Silakan pilih rekaman lain.';
    else if (selected.size > 1_000_000_000) message = 'Ukuran video melebihi batas 1 GB.';
    setError(message);
    setMetadata(null);
    setFile(message ? null : selected);
  }

  useEffect(() => {
    if (!file) return;
    let active = true;
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const timeout = setTimeout(() => {
      if (active) setMetadata({ duration: null });
    }, 10000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      if (!active) return;
      clearTimeout(timeout);
      if (Number.isFinite(video.duration) && video.duration > 2700) {
        setFile(null);
        setMetadata(null);
        setError('Durasi video melebihi batas 45 menit. Pilih rekaman yang lebih pendek.');
        return;
      }
      setMetadata({ duration: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null });
    };
    video.onerror = () => {
      clearTimeout(timeout);
      if (active) setMetadata({ duration: null });
    };
    video.src = url;
    return () => {
      active = false;
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function removeFile() {
    setFile(null);
    setMetadata(null);
    setError('');
  }

  return (
    <section className="video-picker" aria-label="Pilih rekaman webinar">
      <input className="sr-only" type="file" ref={inputRef} accept=".mp4,.mov,video/mp4,video/quicktime" aria-label="Pilih file video" tabIndex={-1} onChange={(event) => { selectFiles(event.target.files); event.target.value = ''; }} />
      <div className={`video-dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
        onDragLeave={(event) => { event.preventDefault(); dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); selectFiles(event.dataTransfer.files); }}>
        <span className="video-upload-symbol"><Icon name={file ? 'video' : 'upload'} size={34} /><i><Icon name={file ? 'check' : 'plus'} size={13} /></i></span>
        {file ? (
          <>
            <h2 className="selected-video-name">{file.name}</h2>
            <p className="video-file-details">{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(file.size / 1_000_000)} MB <span>·</span> {metadata ? (metadata.duration ? `${Math.floor(metadata.duration / 60)} menit ${Math.floor(metadata.duration % 60)} detik` : 'Durasi belum terverifikasi') : 'Membaca durasi…'}</p>
            <div className="video-file-actions"><button type="button" className="button secondary" onClick={() => inputRef.current.click()}><Icon name="video" size={16} /> Ganti video</button><button type="button" className="video-remove" onClick={removeFile}><Icon name="close" size={15} /> Hapus pilihan</button></div>
            <p className="video-local-note" role="status">{metadata?.duration === null ? 'Browser belum dapat membaca durasi video ini. Pemeriksaan durasi masih diperlukan sebelum upload.' : 'File dipilih di perangkat Anda. Belum ada berkas yang diunggah.'}</p>
          </>
        ) : (
          <>
            <h2>{dragging ? 'Lepaskan video di sini' : 'Pilih file webinar dari komputer atau seret ke sini'}</h2>
            <p>Menerima format MP4, MOV <span>·</span> Maksimal 45 menit <span>·</span> Ukuran hingga 1 GB</p>
            <button type="button" className="button secondary video-browse" onClick={() => inputRef.current.click()}><Icon name="upload" size={17} /> Jelajahi File Komputer</button>
            <div className="video-file-hints"><span><Icon name="video" size={14} /> Satu rekaman webinar</span><span><Icon name="shield" size={14} /> Pemeriksaan awal di perangkat</span><span><Icon name="layers" size={14} /> Tiga pilihan layout</span></div>
          </>
        )}
      </div>
      {error && <p className="ingestion-error" role="alert">{error}</p>}
    </section>
  );
}
