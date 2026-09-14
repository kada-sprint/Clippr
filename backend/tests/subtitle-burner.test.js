const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { buildAss, generateSrt, burnSubtitles, STYLES, SAFE_MARGINS, VIDEO_WIDTH, VIDEO_HEIGHT } = require('../src/services/subtitleBurner');

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const OUTPUT_DIR = path.join(__dirname, 'tmp');
const SAMPLE_VIDEO = path.join(FIXTURES_DIR, 'sample_slide_cam.mp4');

// Clip-relative word fixtures — timestamps rebased to 0
const SAMPLE_WORDS = [
  { word: 'Halo', start_time: 0.0, end_time: 0.4 },
  { word: 'semua', start_time: 0.5, end_time: 0.9 },
  { word: 'hari', start_time: 1.0, end_time: 1.3 },
  { word: 'ini', start_time: 1.4, end_time: 1.7 },
  { word: 'kita', start_time: 1.8, end_time: 2.1 },
  { word: 'akan', start_time: 2.2, end_time: 2.5 },
  { word: 'belajar', start_time: 2.6, end_time: 3.1 },
  { word: 'tentang', start_time: 3.2, end_time: 3.6 },
  { word: 'video', start_time: 4.2, end_time: 4.7 },
  { word: 'editing', start_time: 4.8, end_time: 5.3 },
];

describe('buildAss', () => {
  it('produces valid ASS header with correct resolution', () => {
    const ass = buildAss(SAMPLE_WORDS, 'clean');
    assert.ok(ass.includes('PlayResX: 1080'));
    assert.ok(ass.includes('PlayResY: 1920'));
    assert.ok(ass.includes('ScriptType: v4.00+'));
    assert.ok(ass.includes('[V4+ Styles]'));
    assert.ok(ass.includes('[Events]'));
  });

  it('clean style: produces dialogue events with static text', () => {
    const ass = buildAss(SAMPLE_WORDS, 'clean');
    const lines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    assert.ok(lines.length > 0, 'Should have dialogue events');

    // Each dialogue line should contain the word text, no \k tags
    for (const line of lines) {
      assert.ok(!line.includes('\\k'), 'Clean style should not contain \\k tags');
    }
  });

  it('clean style: groups words into lines', () => {
    const ass = buildAss(SAMPLE_WORDS, 'clean');
    const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    // 10 words, max 8 per line → at least 2 dialogue lines
    assert.ok(dialogueLines.length >= 2, `Expected >= 2 dialogue lines, got ${dialogueLines.length}`);
  });

  it('active_word_highlight style: contains \\k karaoke tags', () => {
    const ass = buildAss(SAMPLE_WORDS, 'active_word_highlight');
    const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    assert.ok(dialogueLines.length > 0, 'Should have dialogue events');

    let hasKaraoke = false;
    for (const line of dialogueLines) {
      const matches = line.match(/\\k\d+/g);
      if (matches && matches.length > 0) {
        hasKaraoke = true;
      }
    }
    assert.ok(hasKaraoke, 'Highlight style should contain \\k tags');
  });

  it('active_word_highlight: \\k durations are positive integers', () => {
    const ass = buildAss(SAMPLE_WORDS, 'active_word_highlight');
    const karaokeMatches = [...ass.matchAll(/\\k(\d+)/g)];
    assert.ok(karaokeMatches.length > 0, 'Should have \\k tags');

    for (const match of karaokeMatches) {
      const durationCs = parseInt(match[1], 10);
      assert.ok(durationCs > 0, `\\k duration should be positive, got ${durationCs}`);
    }
  });

  it('handles word gap > 0.5s by starting new line', () => {
    const wordsWithGap = [
      { word: 'first', start_time: 0, end_time: 0.3 },
      { word: 'second', start_time: 2.0, end_time: 2.3 }, // > 0.5s gap
    ];
    const ass = buildAss(wordsWithGap, 'clean');
    const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    assert.equal(dialogueLines.length, 2, 'Gap should cause separate dialogue lines');
  });

  it('returns valid ASS with empty words array', () => {
    const ass = buildAss([], 'clean');
    assert.ok(ass.includes('[Events]'));
    const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    assert.equal(dialogueLines.length, 0, 'Empty words should produce no dialogue');
  });

  it('handles single word', () => {
    const ass = buildAss([{ word: 'Halo', start_time: 0, end_time: 0.5 }], 'clean');
    const dialogueLines = ass.split('\n').filter((l) => l.startsWith('Dialogue:'));
    assert.equal(dialogueLines.length, 1);
    assert.ok(dialogueLines[0].includes('Halo'));
  });

  it('defaults to clean style when no style specified', () => {
    const ass = buildAss(SAMPLE_WORDS);
    assert.ok(!ass.includes('\\k'), 'Default should be clean (no \\k tags)');
  });

  it('safe margins are applied in style definition', () => {
    const ass = buildAss(SAMPLE_WORDS, 'clean');
    const expectedMarginV = Math.round(VIDEO_HEIGHT * SAFE_MARGINS.bottom);
    const expectedMarginL = Math.round(VIDEO_WIDTH * SAFE_MARGINS.side);
    assert.ok(ass.includes(`${expectedMarginL},${expectedMarginL},${expectedMarginV}`),
      'Style should include computed margin values');
  });
});

describe('generateSrt', () => {
  before(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  after(() => {
    for (const file of fs.readdirSync(OUTPUT_DIR)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
    fs.rmdirSync(OUTPUT_DIR);
  });

  it('produces valid SRT format', () => {
    const srtPath = path.join(OUTPUT_DIR, 'test.srt');
    const result = generateSrt(SAMPLE_WORDS, srtPath);
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(srtPath));

    const content = fs.readFileSync(srtPath, 'utf-8');
    // Should start with sequence number "1"
    assert.ok(content.startsWith('1\n'));
    // Should contain SRT timestamp format
    assert.ok(content.includes('-->'));
  });

  it('one entry per word', () => {
    const srtPath = path.join(OUTPUT_DIR, 'count.srt');
    generateSrt(SAMPLE_WORDS, srtPath);
    const content = fs.readFileSync(srtPath, 'utf-8');
    const entries = content.trim().split('\n\n').filter(Boolean);
    assert.equal(entries.length, SAMPLE_WORDS.length);
  });

  it('timestamps are clip-relative (first word starts near 0)', () => {
    const srtPath = path.join(OUTPUT_DIR, 'relative.srt');
    generateSrt(SAMPLE_WORDS, srtPath);
    const content = fs.readFileSync(srtPath, 'utf-8');
    assert.ok(content.includes('00:00:00,000 --> 00:00:00,400'),
      'First entry should start at 00:00:00,000');
  });

  it('handles empty words array', () => {
    const srtPath = path.join(OUTPUT_DIR, 'empty.srt');
    const result = generateSrt([], srtPath);
    assert.equal(result.success, true);
    const content = fs.readFileSync(srtPath, 'utf-8');
    assert.equal(content, '');
  });

  it('returns error for invalid path', () => {
    const result = generateSrt(SAMPLE_WORDS, '/nonexistent/dir/file.srt');
    assert.equal(result.success, false);
    assert.ok(result.error);
  });
});

describe('burnSubtitles smoke tests', () => {
  before(() => {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  });

  after(() => {
    for (const file of fs.readdirSync(OUTPUT_DIR)) {
      fs.unlinkSync(path.join(OUTPUT_DIR, file));
    }
    fs.rmdirSync(OUTPUT_DIR);
  });

  it('burns clean subtitles onto video', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found — add fixture before running`);
      return;
    }

    const outputPath = path.join(OUTPUT_DIR, 'burn_clean.mp4');
    const result = await burnSubtitles(SAMPLE_VIDEO, SAMPLE_WORDS, 'clean', outputPath);

    assert.equal(result.success, true, `Expected success, got error: ${result.error}`);
    assert.equal(result.outputPath, outputPath);
    assert.ok(fs.existsSync(outputPath), 'Output file should exist');
    assert.ok(result.duration > 0, 'Duration should be positive');
  });

  it('burns highlight subtitles onto video', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found — add fixture before running`);
      return;
    }

    const outputPath = path.join(OUTPUT_DIR, 'burn_highlight.mp4');
    const result = await burnSubtitles(SAMPLE_VIDEO, SAMPLE_WORDS, 'active_word_highlight', outputPath);

    assert.equal(result.success, true, `Expected success, got error: ${result.error}`);
    assert.ok(fs.existsSync(outputPath), 'Output file should exist');
  });

  it('cleans up temp ASS file after successful burn', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found — add fixture before running`);
      return;
    }

    const outputPath = path.join(OUTPUT_DIR, 'burn_cleanup.mp4');
    await burnSubtitles(SAMPLE_VIDEO, SAMPLE_WORDS, 'clean', outputPath);

    const outputDir = path.dirname(outputPath);
    const tempFiles = fs.readdirSync(outputDir).filter((f) => f.startsWith('_subtitles_'));
    assert.equal(tempFiles.length, 0, 'Temp ASS files should be cleaned up');
  });

  it('rejects nonexistent input file', async () => {
    const result = await burnSubtitles('/nonexistent.mp4', SAMPLE_WORDS, 'clean', '/tmp/out.mp4');
    assert.equal(result.success, false);
    assert.match(result.error, /Input file not found/);
  });

  it('rejects empty words array', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found — add fixture before running`);
      return;
    }

    const result = await burnSubtitles(SAMPLE_VIDEO, [], 'clean', '/tmp/out.mp4');
    assert.equal(result.success, false);
    assert.match(result.error, /No words provided/);
  });

  it('defaults to clean style when no style specified', async () => {
    if (!fs.existsSync(SAMPLE_VIDEO)) {
      console.log(`  SKIP: ${SAMPLE_VIDEO} not found — add fixture before running`);
      return;
    }

    const outputPath = path.join(OUTPUT_DIR, 'burn_default.mp4');
    const result = await burnSubtitles(SAMPLE_VIDEO, SAMPLE_WORDS, undefined, outputPath);
    assert.equal(result.success, true, `Expected success, got error: ${result.error}`);
  });
});
