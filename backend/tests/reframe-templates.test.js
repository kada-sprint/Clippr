const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { renderClip } = require('../src/services/reframeCommon');
const { getVideoMetadata } = require('../src/utils/ffprobeUtils');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT_DIR = path.join(__dirname, 'tmp');

// Sample test videos — 5–10 second clips for smoke testing.
// Replace these paths with real fixture files before running.
const SAMPLE_VIDEOS = {
  'slide-cam': path.join(FIXTURES_DIR, 'sample_slide_cam.mp4'),
  'talking-head': path.join(FIXTURES_DIR, 'sample_talking_head.mp4'),
  'slide-only': path.join(FIXTURES_DIR, 'sample_slide_only.mp4'),
};

const TEST_DURATION = 5; // seconds to render in smoke test
const DURATION_TOLERANCE = 0.1; // seconds — max acceptable drift from requested duration

// Collected metadata from per-template renders, used by cross-template consistency checks.
const renderedMetadata = {};

describe('renderClip smoke tests', () => {
  before(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  after(() => {
    // Clean up test outputs
    for (const file of fs.readdirSync(OUTPUT_DIR)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
    fs.rmdirSync(OUTPUT_DIR);
  });

  for (const [template, videoPath] of Object.entries(SAMPLE_VIDEOS)) {
    it(`${template}: renders successfully with correct duration`, async () => {
      if (!fs.existsSync(videoPath)) {
        console.log(`  SKIP: ${videoPath} not found — add fixture before running`);
        return;
      }

      const outputPath = path.join(OUTPUT_DIR, `${template}_output.mp4`);
      // Template C (blurred background) is computationally expensive — allow extra time
      const timeoutMs = template === 'slide-only' ? 120_000 : 60_000;
      const result = await renderClip(videoPath, 0, TEST_DURATION, outputPath, template, { timeoutMs });

      assert.equal(result.success, true, `Expected success, got error: ${result.error}`);
      assert.equal(result.outputPath, outputPath);
      assert.equal(result.duration, TEST_DURATION);
      assert.ok(fs.existsSync(outputPath), 'Output file should exist');

      // Collect metadata for cross-template consistency checks
      renderedMetadata[template] = await getVideoMetadata(outputPath);
    });
  }

  it('rejects unknown template', async () => {
    const result = await renderClip('/nonexistent.mp4', 0, 5, '/tmp/out.mp4', 'invalid-template');
    assert.equal(result.success, false);
    assert.match(result.error, /Unknown template/);
  });

  it('rejects missing template', async () => {
    const result = await renderClip('/nonexistent.mp4', 0, 5, '/tmp/out.mp4', undefined);
    assert.equal(result.success, false);
    assert.match(result.error, /Unknown template/);
  });

  it('rejects invalid time range', async () => {
    // Need a real file so input validation passes, but time range is invalid
    const dummyFile = path.join(OUTPUT_DIR, '_dummy.mp4');
    fs.writeFileSync(dummyFile, '');
    const result = await renderClip(dummyFile, 10, 5, '/tmp/out.mp4', 'slide-only');
    assert.equal(result.success, false);
    assert.match(result.error, /Invalid time range/);
    fs.unlinkSync(dummyFile);
  });

  it('rejects nonexistent input file', async () => {
    const result = await renderClip('/nonexistent.mp4', 0, 5, '/tmp/out.mp4', 'slide-only');
    assert.equal(result.success, false);
    assert.match(result.error, /Input file not found/);
  });
});

describe('cross-template consistency', () => {
  const templates = Object.keys(SAMPLE_VIDEOS);
  const rendered = templates.filter((t) => renderedMetadata[t]);

  // Skip entire block if no templates were rendered (all fixtures missing)
  it('all three templates produce spec-consistent output', () => {
    if (rendered.length < 3) {
      console.log('  SKIP: not all fixture videos present — cannot run consistency checks');
      return;
    }

    const meta = rendered.map((t) => ({ template: t, ...renderedMetadata[t] }));

    // 1. Identical resolution: 1080×1920
    for (const m of meta) {
      assert.equal(m.width, 1080, `${m.template}: width should be 1080, got ${m.width}`);
      assert.equal(m.height, 1920, `${m.template}: height should be 1920, got ${m.height}`);
    }

    // 2. Identical codec: h264
    const codecs = [...new Set(meta.map((m) => m.codec))];
    assert.equal(codecs.length, 1, `All templates should use h264 codec, got: ${codecs.join(', ')}`);
    assert.equal(codecs[0], 'h264', `Expected h264 codec, got ${codecs[0]}`);

    // 3. Identical container format
    const containers = [...new Set(meta.map((m) => m.container))];
    assert.equal(containers.length, 1, `All templates should produce same container, got: ${containers.join(', ')}`);

    // 4. Duration drift within tolerance
    for (const m of meta) {
      const drift = Math.abs(m.duration - TEST_DURATION);
      assert.ok(
        drift <= DURATION_TOLERANCE,
        `${m.template}: duration drift ${drift.toFixed(3)}s exceeds tolerance ${DURATION_TOLERANCE}s (got ${m.duration}s, expected ${TEST_DURATION}s)`
      );
    }
  });
});
