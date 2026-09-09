const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export async function apiRequest(path, { signal, ...options } = {}) {
  let response;
  try {
    const timeout = AbortSignal.timeout(15000);
    response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw Object.assign(new Error('Tidak dapat menghubungi server. Periksa koneksi dan coba lagi.'), { code: 'NETWORK_ERROR' });
  }
  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    throw Object.assign(new Error('Respons server belum dapat dibaca. Coba lagi.'), { code: 'INVALID_RESPONSE' });
  }
  if (!response.ok) {
    throw Object.assign(new Error(data.error?.message || 'Permintaan gagal. Silakan coba lagi.'), {
      code: data.error?.code || 'REQUEST_FAILED', status: response.status,
    });
  }
  return data;
}
