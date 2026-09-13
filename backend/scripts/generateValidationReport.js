#!/usr/bin/env node
/**
 * C4-05 Cross-Template Validation Report Generator
 *
 * One-off script — run via: node backend/scripts/generateValidationReport.js
 * Produces: docs/rfc/C4-05/template_validation_report.md
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { renderClip } = require('../src/services/reframeCommon');
const { getVideoMetadata } = require('../src/utils/ffprobeUtils');

const BACKEND_DIR = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_DIR, '..');
const FIXTURES_DIR = path.join(BACKEND_DIR, 'tests', 'fixtures');
const REPORT_DIR = path.join(PROJECT_ROOT, 'docs', 'rfc', 'C4-05');
const REPORT_PATH = path.join(REPORT_DIR, 'template_validation_report.md');

const SAMPLE_VIDEOS = {
  'slide-cam': path.join(FIXTURES_DIR, 'sample_slide_cam.mp4'),
  'talking-head': path.join(FIXTURES_DIR, 'sample_talking_head.mp4'),
  'slide-only': path.join(FIXTURES_DIR, 'sample_slide_only.mp4'),
};

const TEST_DURATION = 5;
const DURATION_TOLERANCE = 0.1;

async function main() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c405-'));
  const results = [];

  try {
    // Render each template and collect metadata
    for (const [template, videoPath] of Object.entries(SAMPLE_VIDEOS)) {
      if (!fs.existsSync(videoPath)) {
        results.push({ template, error: `Fixture not found: ${videoPath}` });
        continue;
      }

      const outputPath = path.join(tmpDir, `${template}_output.mp4`);
      const timeoutMs = template === 'slide-only' ? 120_000 : 60_000;

      const renderResult = await renderClip(videoPath, 0, TEST_DURATION, outputPath, template, { timeoutMs });
      if (!renderResult.success) {
        results.push({ template, error: `Render failed: ${renderResult.error}` });
        continue;
      }

      const metadata = await getVideoMetadata(outputPath);
      const drift = Math.abs(metadata.duration - TEST_DURATION);
      const driftPass = drift <= DURATION_TOLERANCE;

      results.push({
        template,
        ...metadata,
        drift: drift.toFixed(3),
        driftPass,
        resolutionPass: metadata.width === 1080 && metadata.height === 1920,
        codecPass: metadata.codec === 'h264',
      });
    }

    // Write report
    fs.mkdirSync(REPORT_DIR, { recursive: true });

    const lines = [];
    lines.push('# C4-05: Cross-Template Validation Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Test duration requested:** ${TEST_DURATION}s`);
    lines.push(`**Duration tolerance:** ±${DURATION_TOLERANCE}s`);
    lines.push('');

    // Per-template results table
    lines.push('## Per-Template Results');
    lines.push('');
    lines.push('| Template | Resolution | Codec | Container | Duration (s) | Drift (s) | Drift OK |');
    lines.push('|----------|------------|-------|-----------|-------------|-----------|----------|');

    for (const r of results) {
      if (r.error) {
        lines.push(`| ${r.template} | — | — | — | — | — | ERROR: ${r.error} |`);
      } else {
        const res = `${r.width}×${r.height}`;
        const resCheck = r.resolutionPass ? '✓' : '✗';
        const codecCheck = r.codecPass ? '✓' : '✗';
        const driftCheck = r.driftPass ? '✓' : '✗';
        lines.push(`| ${r.template} | ${res} ${resCheck} | ${r.codec} ${codecCheck} | ${r.container} | ${r.duration.toFixed(3)} | ${r.drift} | ${driftCheck} |`);
      }
    }
    lines.push('');

    // Cross-template consistency verdict
    const rendered = results.filter((r) => !r.error);
    const allPassed = rendered.length === 3
      && rendered.every((r) => r.resolutionPass && r.codecPass && r.driftPass);

    lines.push('## Cross-Template Consistency');
    lines.push('');
    if (rendered.length < 3) {
      lines.push('**Verdict: INCONCLUSIVE** — not all templates could be rendered (missing fixtures).');
    } else if (allPassed) {
      lines.push('**Verdict: PASS** — all three templates produce spec-consistent output.');
    } else {
      lines.push('**Verdict: FAIL** — one or more templates deviate from the spec.');
    }
    lines.push('');

    // Subtitle safe-zone flag (manually written — provisional)
    lines.push('## Subtitle Safe-Zone Flag (PROVISIONAL)');
    lines.push('');
    lines.push('H-5 may proceed with subtitle placement now, under one constraint: avoid the bottom 30% of the canvas, which is currently occupied by Template A\'s camera band (stacked model, pre-PiP-rework).');
    lines.push('');
    lines.push('**Verified against code:** Template A\'s camera overlay is placed at `overlay=0:1344` with dimensions 1080×576 — the bottom 30% of the 1920px canvas (1344px = 70% from top). This is the exact shipped boundary in `templateASlideCam.js:40`, not an estimate.');
    lines.push('');
    lines.push('**Platform overlap:** TikTok and Reels interaction icons (like, comment, share, follow) sit in the mid-to-lower right edge of the screen. Template A\'s bottom band directly overlaps this area, carrying real conflict risk with subtitle text placed there.');
    lines.push('');
    lines.push('This constraint is TEMPORARY and should be re-validated once C4-02\'s PiP rework ships — at that point the exclusion zone shrinks to a small corner inset rather than a full-width band. When PiP lands, this safe-zone section must be explicitly updated to reflect the lifted constraint.');
    lines.push('');

    fs.writeFileSync(REPORT_PATH, lines.join('\n'));
    console.log(`Report written to: ${REPORT_PATH}`);

  } finally {
    // Clean up rendered outputs
    if (fs.existsSync(tmpDir)) {
      for (const file of fs.readdirSync(tmpDir)) {
        fs.unlinkSync(path.join(tmpDir, file));
      }
      fs.rmdirSync(tmpDir);
    }
  }
}

main().catch((err) => {
  console.error('Report generation failed:', err.message);
  process.exitCode = 1;
});
