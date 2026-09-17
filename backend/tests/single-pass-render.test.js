const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const SAMPLE_VIDEO = path.join(FIXTURES_DIR, 'sample_slide_cam.mp4');
const OUTPUT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cuplik-single-pass-'));

const { renderMedia } = require('../src/services/render.service');

const SAMPLE_WORDS = [
  { word: 'Halo', start_time: 0.0, end_time: 0.4, confidence: 1 },
  { word: 'semua', start_time: 0.5, end_time: 0.9, confidence: 1 },
  { word: 'hari', start_time: 1.0, end_time: 1.3, confidence: 1 },
  { word: 'ini', start_time: 1.4, end_time: 1.7, confidence: 1 },
  { word: 'kita', start_time: 1.8, end_time: 2.1, confidence: 1 },
  { word: 'akan', start_time: 2.2, end_time: 2.5, confidence: 1 },
  { word: 'belajar', start_time: 2.6, end_time: 3.1, confidence: 1 },
  { word: 'tentang', start_time: 3.2, end_time: 3.6, confidence: 1 },
];

// Duration must be 25-75 seconds to pass renderMedia validation
const CLIP_START = 0;
const CLIP_END = 30;

describe('single-pass render', () => {
  before(() => { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); });
  after(() => {
    for (const f of fs.readdirSync(OUTPUT_DIR)) fs.unlinkSync(path.join(OUTPUT_DIR, f));
    fs.rmdirSync(OUTPUT_DIR);
  });

  it('produces subtitled output with clipVideoPath null', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found`);
      return;
    }

    const project = {
      id: 'test-project',
      selectedLayout: 'slide-cam',
      sourceVideoPath: SAMPLE_VIDEO,
    };
    const clip = {
      id: 'test-clip',
      startTime: CLIP_START,
      endTime: CLIP_END,
      subtitleStyle: 'clean',
      transcriptJson: { words: SAMPLE_WORDS },
    };

    const result = await renderMedia(project, clip, 'test-token', {
      outputDirectory: OUTPUT_DIR,
      sourceVideoPath: SAMPLE_VIDEO,
    });

    assert.equal(result.status, 'rendered');
    assert.equal(result.clipVideoPath, null);
    assert.ok(result.subtitledVideoPath, 'subtitledVideoPath should be set');
    assert.ok(fs.existsSync(result.subtitledVideoPath), 'output file should exist');
    assert.ok(result.srtPath, 'srtPath should be set');
    assert.ok(fs.existsSync(result.srtPath), 'SRT file should exist');
  });

  it('cleans up temp ASS file after render', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found`);
      return;
    }

    const project = {
      id: 'test-project',
      selectedLayout: 'slide-cam',
      sourceVideoPath: SAMPLE_VIDEO,
    };
    const clip = {
      id: 'test-clip-cleanup',
      startTime: CLIP_START,
      endTime: CLIP_END,
      subtitleStyle: 'clean',
      transcriptJson: { words: SAMPLE_WORDS },
    };

    await renderMedia(project, clip, 'cleanup-token', {
      outputDirectory: OUTPUT_DIR,
      sourceVideoPath: SAMPLE_VIDEO,
    });

    const tempFiles = fs.readdirSync(OUTPUT_DIR).filter((f) => f.startsWith('_subtitles_'));
    assert.equal(tempFiles.length, 0, 'temp ASS files should be cleaned up');
  });

  it('renders all 3 templates with subtitles', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found`);
      return;
    }

    for (const layout of ['slide-cam', 'talking-head', 'slide-only']) {
      const project = {
        id: 'test-project',
        selectedLayout: layout,
        sourceVideoPath: SAMPLE_VIDEO,
      };
      const clip = {
        id: `test-clip-${layout}`,
        startTime: CLIP_START,
        endTime: CLIP_END,
        subtitleStyle: 'clean',
        transcriptJson: { words: SAMPLE_WORDS },
      };

      const result = await renderMedia(project, clip, `test-${layout}`, {
        outputDirectory: OUTPUT_DIR,
        sourceVideoPath: SAMPLE_VIDEO,
      });

      assert.equal(result.status, 'rendered', `${layout} should render`);
      assert.equal(result.clipVideoPath, null, `${layout} clipVideoPath should be null`);
      assert.ok(result.subtitledVideoPath, `${layout} subtitledVideoPath should be set`);
    }
  });
});
