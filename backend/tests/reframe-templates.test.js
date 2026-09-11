const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { renderClip } = require('../src/services/reframeCommon');

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

      // Visual quality check: open the output file and verify manually
      // that slide content is legible, camera is visible (if applicable),
      // and there are no encoding artifacts.
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
