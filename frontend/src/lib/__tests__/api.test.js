import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest } from '../api.js';

describe('apiRequest', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('sends request with credentials and JSON headers', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    });

    const result = await apiRequest('/projects');

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/projects');
    expect(opts.credentials).toBe('include');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(result).toEqual({ data: 'ok' });
  });

  it('uses default base URL when env var is not set', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await apiRequest('/health');

    const [url] = fetch.mock.calls[0];
    expect(url).toContain('/api/health');
  });

  it('returns null for 204 responses', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => { throw new Error('no body'); },
    });

    const result = await apiRequest('/delete', { method: 'DELETE' });
    expect(result).toBeNull();
  });

  it('throws NETWORK_ERROR on fetch failure', async () => {
    globalThis.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiRequest('/missing')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('throws error with status and code from server response', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: 'NOT_FOUND', message: 'Not found' } }),
    });

    await expect(apiRequest('/nope')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
      message: 'Not found',
    });
  });

  it('uses fallback message when server error has no message', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: {} }),
    });

    await expect(apiRequest('/fail')).rejects.toMatchObject({
      message: 'Permintaan gagal. Silakan coba lagi.',
    });
  });

  it('throws INVALID_RESPONSE when JSON parsing fails', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });

    await expect(apiRequest('/bad')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });

  it('throws NETWORK_ERROR when fetch rejects and signal is not aborted', async () => {
    const controller = new AbortController();
    globalThis.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(apiRequest('/slow', { signal: controller.signal })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });
});
