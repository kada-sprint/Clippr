import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadVideoProject, uploadToSignedUrl } from '../ingestion.api.js';

class FakeXhr {
  static instances = [];
  constructor() {
    this.listeners = {};
    this.upload = { addEventListener: (name, callback) => { this.uploadProgress = callback; } };
    this.headers = {};
    FakeXhr.instances.push(this);
  }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  send(file) { this.file = file; }
  abort() { this.listeners.abort?.(); }
  succeed() {
    this.status = 200;
    this.uploadProgress?.({ lengthComputable: true, loaded: 10, total: 10 });
    this.listeners.load?.();
  }
}

afterEach(() => { vi.unstubAllGlobals(); FakeXhr.instances = []; });

describe('direct R2 upload', () => {
  it('PUTs the exact file and signed headers while reporting progress', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const file = new File(['video'], 'lesson.mp4', { type: 'video/mp4' });
    const progress = [];
    const pending = uploadToSignedUrl({
      file, url: 'https://signed.example/upload', headers: { 'Content-Type': 'video/mp4' },
      onProgress: (value) => progress.push(value),
    });
    const xhr = FakeXhr.instances[0];
    expect(xhr.method).toBe('PUT');
    expect(xhr.file).toBe(file);
    expect(xhr.headers).toEqual({ 'Content-Type': 'video/mp4' });
    xhr.succeed();
    await pending;
    expect(progress).toEqual([0, 100]);
  });

  it('calls initiate, uploads to R2, then completes the same project', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        project: { id: 'project-id' },
        upload: { objectKey: 'sources/project-id/upload.mp4', url: 'https://signed.example/upload', headers: { 'Content-Type': 'video/mp4' } },
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        project: { id: 'project-id', status: 'processing', processingStage: 'ingest' },
      }), { status: 202, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['video'], 'lesson.mp4', { type: 'video/mp4' });
    const pending = uploadVideoProject({ file, layout: 'SLIDE_CAM', vocabulary: ['Prisma'] });
    await vi.waitFor(() => expect(FakeXhr.instances).toHaveLength(1));
    FakeXhr.instances[0].succeed();
    const project = await pending;
    expect(project.processingStage).toBe('ingest');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/projects/upload/initiate');
    expect(fetchMock.mock.calls[1][0]).toContain('/api/projects/project-id/source/complete');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ object_key: 'sources/project-id/upload.mp4' });
  });
});
