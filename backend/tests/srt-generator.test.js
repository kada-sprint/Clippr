const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { generateSrt, groupWordsIntoCues, formatSrtTime } = require('../src/services/srtGenerator');

const OUTPUT_DIR = path.join(__dirname, 'tmp');

describe('formatSrtTime', () => {
  it('formats zero correctly', () => {
    assert.equal(formatSrtTime(0), '00:00:00,000');
  });

  it('formats minutes and seconds', () => {
    assert.equal(formatSrtTime(65.5), '00:01:05,500');
  });

  it('formats hours', () => {
    assert.equal(formatSrtTime(3661.123), '01:01:01,123');
  });
});

describe('groupWordsIntoCues', () => {
  const shortWords = [
    { word: 'Halo', start_time: 0.0, end_time: 0.4 },
    { word: 'semua', start_time: 0.5, end_time: 0.9 },
    { word: 'hari', start_time: 1.0, end_time: 1.3 },
    { word: 'ini', start_time: 1.4, end_time: 1.7 },
  ];

  it('groups short words into a single cue', () => {
    const cues = groupWordsIntoCues(shortWords);
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, 'Halo semua hari ini');
    assert.equal(cues[0].startTime, 0.0);
    assert.equal(cues[0].endTime, 1.7);
  });

  it('breaks at natural pauses', () => {
    const words = [
      { word: 'kita', start_time: 0.0, end_time: 0.3 },
      { word: 'belajar', start_time: 0.4, end_time: 0.8 },
      { word: 'tentang', start_time: 1.5, end_time: 1.9 },
      { word: 'video', start_time: 2.0, end_time: 2.4 },
    ];
    const cues = groupWordsIntoCues(words);
    assert.ok(cues.length >= 2, 'Should break at the 0.7s gap');
    assert.equal(cues[0].text, 'kita belajar');
    assert.equal(cues[1].text, 'tentang video');
  });

  it('handles single word', () => {
    const words = [{ word: 'Halo', start_time: 0.0, end_time: 0.4 }];
    const cues = groupWordsIntoCues(words);
    assert.equal(cues.length, 1);
    assert.equal(cues[0].text, 'Halo');
  });

  it('handles words without natural pauses', () => {
    const words = [];
    for (let i = 0; i < 20; i++) {
      words.push({ word: `word${i}`, start_time: i * 0.2, end_time: i * 0.2 + 0.15 });
    }
    const cues = groupWordsIntoCues(words);
    assert.ok(cues.length > 1, 'Should split by char count when no pauses');
    for (const cue of cues) {
      assert.ok(cue.text.length <= 84, `Cue text too long: ${cue.text.length}`);
    }
  });

  it('respects max cue duration', () => {
    const words = [];
    for (let i = 0; i < 40; i++) {
      words.push({ word: `word${i}`, start_time: i * 0.2, end_time: i * 0.2 + 0.18 });
    }
    const cues = groupWordsIntoCues(words);
    for (const cue of cues) {
      const duration = cue.endTime - cue.startTime;
      assert.ok(duration <= 7.5, `Cue duration too long: ${duration}`);
    }
  });
});

describe('generateSrt', () => {
  it('generates valid SRT file', () => {
    const outputPath = path.join(OUTPUT_DIR, 'test.srt');
    const transcript = {
      words: [
        { word: 'Halo', start_time: 0.0, end_time: 0.4 },
        { word: 'semua', start_time: 0.5, end_time: 0.9 },
      ],
    };
    const result = generateSrt(transcript, outputPath);
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(outputPath));

    const content = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(content.includes('1\n'));
    assert.ok(content.includes('00:00:00,000 --> 00:00:00,900'));
    assert.ok(content.includes('Halo semua'));
  });

  it('returns error for empty transcript', () => {
    const result = generateSrt({ words: [] }, '/tmp/empty.srt');
    assert.equal(result.success, false);
    assert.ok(result.error.includes('No words'));
  });

  it('returns error for null transcript', () => {
    const result = generateSrt(null, '/tmp/null.srt');
    assert.equal(result.success, false);
  });

  it('creates output directory if missing', () => {
    const outputPath = path.join(OUTPUT_DIR, 'nested', 'dir', 'test.srt');
    const transcript = {
      words: [{ word: 'test', start_time: 0.0, end_time: 0.5 }],
    };
    const result = generateSrt(transcript, outputPath);
    assert.equal(result.success, true);
    assert.ok(fs.existsSync(outputPath));
  });

  it('generates correct SRT for Indonesian text', () => {
    const outputPath = path.join(OUTPUT_DIR, 'indonesian.srt');
    const transcript = {
      words: [
        { word: 'Cara', start_time: 0.0, end_time: 0.3 },
        { word: 'membuat', start_time: 0.4, end_time: 0.8 },
        { word: 'video', start_time: 0.9, end_time: 1.3 },
        { word: 'edukasi', start_time: 2.0, end_time: 2.5 },
      ],
    };
    const result = generateSrt(transcript, outputPath);
    assert.equal(result.success, true);
    const content = fs.readFileSync(outputPath, 'utf-8');
    assert.ok(content.includes('Cara membuat video'));
    assert.ok(content.includes('edukasi'));
  });
});
