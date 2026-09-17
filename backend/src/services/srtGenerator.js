const fs = require('node:fs');
const path = require('node:path');

const MAX_CHARS_PER_LINE = 42;
const MAX_LINES_PER_CUE = 2;
const MAX_CUE_DURATION_SEC = 7;
const MIN_GAP_FOR_BREAK_SEC = 0.3;

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return (
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0') + ',' +
    String(ms).padStart(3, '0')
  );
}

function isNaturalBreak(words, i) {
  if (i >= words.length - 1) return true;
  const gap = words[i + 1].start_time - words[i].end_time;
  return gap >= MIN_GAP_FOR_BREAK_SEC;
}

function groupWordsIntoCues(words) {
  const cues = [];
  let cueWords = [];
  let cueStartTime = null;
  let cueCharCount = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const wordText = w.word;
    const wordChars = wordText.length;

    if (cueWords.length === 0) {
      cueStartTime = w.start_time;
      cueWords.push(wordText);
      cueCharCount = wordChars;
      continue;
    }

    const wouldExceedChars = cueCharCount + 1 + wordChars > MAX_CHARS_PER_LINE * MAX_LINES_PER_CUE;
    const wouldExceedDuration = w.end_time - cueStartTime > MAX_CUE_DURATION_SEC;
    const atNaturalBreak = isNaturalBreak(words, i - 1);

    if (wouldExceedChars || wouldExceedDuration || (atNaturalBreak && cueWords.length >= 2)) {
      cues.push({
        startTime: cueStartTime,
        endTime: words[i - 1].end_time,
        text: cueWords.join(' '),
      });
      cueWords = [wordText];
      cueStartTime = w.start_time;
      cueCharCount = wordChars;
    } else {
      cueWords.push(wordText);
      cueCharCount += 1 + wordChars;
    }
  }

  if (cueWords.length > 0) {
    cues.push({
      startTime: cueStartTime,
      endTime: words[words.length - 1].end_time,
      text: cueWords.join(' '),
    });
  }

  return cues;
}

function generateSrt(transcriptJson, outputPath) {
  try {
    const words = transcriptJson?.words;
    if (!Array.isArray(words) || words.length === 0) {
      return { success: false, outputPath: null, error: 'No words in transcript' };
    }

    const cues = groupWordsIntoCues(words);
    let content = '';
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i];
      content += `${i + 1}\n`;
      content += `${formatSrtTime(cue.startTime)} --> ${formatSrtTime(cue.endTime)}\n`;
      content += `${cue.text}\n\n`;
    }

    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, content, 'utf-8');

    return { success: true, outputPath, cueCount: cues.length };
  } catch (err) {
    return { success: false, outputPath: null, error: err.message };
  }
}

module.exports = { generateSrt, groupWordsIntoCues, formatSrtTime };
