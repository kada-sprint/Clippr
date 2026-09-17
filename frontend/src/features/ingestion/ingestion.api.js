const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

function requestError(data, fallback, status) {
  return Object.assign(new Error(data?.error?.message || data?.message || fallback), {
    code: data?.error?.code || 'UPLOAD_FAILED', status,
  });
}

async function requestJson(path, options, fallback) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...options, credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new Error('Tidak dapat menghubungi server. Periksa koneksi lalu coba kembali.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('Respons server tidak dapat dibaca.'); }
  if (!response.ok) throw requestError(data, fallback, response.status);
  return data;
}

function uploadToSignedUrl({ file, url, headers, signal, onProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => {
      xhr.abort();
      finish(reject, signal.reason || new DOMException('Upload dibatalkan.', 'AbortError'));
    };
    xhr.open('PUT', url);
    for (const [name, value] of Object.entries(headers || {})) xhr.setRequestHeader(name, value);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) finish(resolve);
      else finish(reject, new Error('Penyimpanan video menolak upload. Silakan coba kembali.'));
    });
    xhr.addEventListener('error', () => finish(reject, new Error('Upload video ke penyimpanan terputus. Silakan coba kembali.')));
    xhr.addEventListener('abort', () => finish(reject, new DOMException('Upload dibatalkan.', 'AbortError')));
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    onProgress?.(0);
    xhr.send(file);
  });
}

export async function uploadVideoProject({ file, layout, vocabulary, signal, onProgress }) {
  if (!file) throw new Error('File video belum dipilih.');
  const timeout = AbortSignal.timeout(30 * 60 * 1000);
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const customVocabulary = Array.isArray(vocabulary) ? vocabulary.join(', ') : (vocabulary || '');
  const initiated = await requestJson('/projects/upload/initiate', {
    method: 'POST', signal: combinedSignal,
    body: JSON.stringify({
      file_name: file.name, file_size: file.size, mime_type: file.type,
      selected_layout: layout || 'SLIDE_CAM', custom_vocabulary: customVocabulary,
    }),
  }, 'Upload belum dapat dimulai.');
  await uploadToSignedUrl({
    file, url: initiated.upload.url, headers: initiated.upload.headers,
    signal: combinedSignal, onProgress,
  });
  onProgress?.(100);
  const completed = await requestJson(`/projects/${initiated.project.id}/source/complete`, {
    method: 'POST', signal: combinedSignal,
    body: JSON.stringify({ object_key: initiated.upload.objectKey }),
  }, 'Upload tersimpan, tetapi pemrosesan belum dapat dimulai. Silakan coba kembali.');
  return completed.project;
}

export { uploadToSignedUrl };
