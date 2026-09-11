const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

/**
 * Mengunggah file video, pilihan layout, dan kamus istilah ke backend Cuplik
 * @param {Object} params
 * @param {File} params.file - File video (.mp4/.mov, maks 1GB)
 * @param {string} params.layout - Layout pilihan (misal: 'slide_speaker' atau 'SLIDE_CAM')
 * @param {string[]|string} params.vocabulary - Daftar istilah teknis (maksimal 20 kata)
 * @param {AbortSignal} [params.signal] - Signal untuk membatalkan request
 * @returns {Promise<Object>} Data proyek hasil proses dari backend
 */
export async function uploadVideoProject({ file, layout, vocabulary, signal }) {
  if (!file) {
    throw new Error('File video belum dipilih.');
  }

  const formData = new FormData();
  formData.append('video_file', file);
  formData.append('selected_layout', layout || 'slide_speaker');

  const formattedVocab = Array.isArray(vocabulary)
    ? vocabulary.join(', ')
    : (vocabulary || '');
  formData.append('custom_vocabulary', formattedVocab);

  // Batas waktu timeout 5 menit untuk mengakomodasi upload video + FFmpeg + STT Whisper
  const timeout = AbortSignal.timeout(300000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/projects/upload`, {
      method: 'POST',
      credentials: 'include', // Mengirim cookie sesi login aktif (clippr_session)
      body: formData,         // Browser secara otomatis menyetel Content-Type & multipart boundary
      signal: combinedSignal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error.name === 'TimeoutError' || combinedSignal.aborted) {
      throw new Error('Proses upload dan transkripsi memakan waktu terlalu lama. Silakan coba video yang lebih singkat.');
    }
    throw new Error('Tidak dapat menghubungi server. Periksa koneksi backend Anda dan coba lagi.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Respons server tidak dapat dibaca.');
  }

  if (!response.ok) {
    const message = data.error?.message || data.message || 'Gagal mengunggah dan memproses video.';
    const err = new Error(message);
    err.code = data.error?.code || 'UPLOAD_FAILED';
    err.status = response.status;
    throw err;
  }

  return data.project || data;
}