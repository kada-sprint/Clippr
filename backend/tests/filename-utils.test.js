const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildExportBasename, sanitizeTitle } = require('../src/utils/filenameUtils');

describe('sanitizeTitle', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    assert.equal(sanitizeTitle('Hello World'), 'hello-world');
  });

  it('strips invalid filename characters', () => {
    assert.equal(sanitizeTitle('Video: Part 1/2?'), 'video-part-12');
  });

  it('preserves Indonesian characters', () => {
    assert.equal(sanitizeTitle('Cara Membuat Video'), 'cara-membuat-video');
  });

  it('truncates to 50 characters', () => {
    const long = 'a'.repeat(100);
    assert.equal(sanitizeTitle(long).length, 50);
  });

  it('returns empty string for null/undefined/non-string', () => {
    assert.equal(sanitizeTitle(null), '');
    assert.equal(sanitizeTitle(undefined), '');
    assert.equal(sanitizeTitle(123), '');
  });

  it('returns empty string for empty string', () => {
    assert.equal(sanitizeTitle(''), '');
  });
});

describe('buildExportBasename', () => {
  it('uses sanitized title', () => {
    const clip = { id: 'abc12345-6789', title: 'My Great Video' };
    assert.equal(buildExportBasename(clip), 'my-great-video');
  });

  it('falls back to clip-id when title is empty', () => {
    const clip = { id: 'abc12345-6789', title: '' };
    assert.equal(buildExportBasename(clip), 'clip-abc123');
  });

  it('falls back to clip-id when title is null', () => {
    const clip = { id: 'abc12345-6789', title: null };
    assert.equal(buildExportBasename(clip), 'clip-abc123');
  });

  it('uses project name in fallback when title is missing', () => {
    const clip = { id: 'abc12345-6789', title: '' };
    assert.equal(buildExportBasename(clip, 'MyProject'), 'myproject-clip-abc123');
  });

  it('appends clip id prefix when _duplicate flag is set', () => {
    const clip = { id: 'abc12345-6789', title: 'Same Title', _duplicate: true };
    assert.equal(buildExportBasename(clip), 'same-title-abc123');
  });

  it('handles Indonesian characters correctly', () => {
    const clip = { id: 'abc12345-6789', title: 'Cara Membuat Video Edisi Pendidikan' };
    assert.equal(buildExportBasename(clip), 'cara-membuat-video-edisi-pendidikan');
  });

  it('handles very long titles', () => {
    const clip = { id: 'abc12345-6789', title: 'a'.repeat(100) };
    assert.equal(buildExportBasename(clip).length, 50);
  });

  it('handles special characters in title', () => {
    const clip = { id: 'abc12345-6789', title: 'Tips & Tricks: "Best" Practice?' };
    assert.equal(buildExportBasename(clip), 'tips--tricks-best-practice');
  });
});
