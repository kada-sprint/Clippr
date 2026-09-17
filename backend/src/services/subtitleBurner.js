const ffmpeg = require('fluent-ffmpeg');
require('../utils/ffmpeg');
const fs = require('node:fs');
const path = require('node:path');

// --- Constants ---

const VIDEO_WIDTH = 1080;
const VIDEO_HEIGHT = 1920;

const SAFE_MARGINS = {
  top: 0.10,
  bottom: 0.175,
  side: 0.10,
};

const MARGIN_V = Math.round(VIDEO_HEIGHT * SAFE_MARGINS.bottom);
const MARGIN_L = Math.round(VIDEO_WIDTH * SAFE_MARGINS.side);
const MARGIN_R = Math.round(VIDEO_WIDTH * SAFE_MARGINS.side);

const FONT_NAME = 'Arial';
const FONT_SIZE = 52;
const OUTLINE_WIDTH = 2;

const PRIMARY_COLOR = '&H00FFFFFF';   // white
const OUTLINE_COLOR = '&H00000000';   // black
const HIGHLIGHT_COLOR = '&H0000FFFF'; // yellow

const STYLES = {
  clean: {
    fontName: FONT_NAME,
    fontSize: FONT_SIZE,
    primaryColour: PRIMARY_COLOR,
    outlineColour: OUTLINE_COLOR,
    outlineWidth: OUTLINE_WIDTH,
  },
  active_word_highlight: {
    fontName: FONT_NAME,
    fontSize: FONT_SIZE,
    primaryColour: PRIMARY_COLOR,
    outlineColour: OUTLINE_COLOR,
    outlineWidth: OUTLINE_WIDTH,
  },
};

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_WORDS_PER_LINE = 8;
const LINE_BREAK_GAP_SEC = 0.5;

// Detect ffmpeg binary: prefer env var, then ffmpeg-static (has libass), then system PATH
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
} else {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    if (ffmpegStatic) {
      ffmpeg.setFfmpegPath(ffmpegStatic);
    } else {
      try {
        const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
        if (ffmpegInstaller?.path) {
          ffmpeg.setFfmpegPath(ffmpegInstaller.path);
        }
      } catch {
        // Use system ffmpeg from PATH
      }
    }
  } catch {
    try {
      const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
      if (ffmpegInstaller?.path) {
        ffmpeg.setFfmpegPath(ffmpegInstaller.path);
      }
    } catch {
      // Use system ffmpeg from PATH
    }
  }
}

// --- Helpers ---

function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function groupWordsIntoLines(words) {
  if (!words.length) return [];

  const lines = [];
  let currentLine = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const prev = words[i - 1];
    const curr = words[i];
    const gap = curr.start_time - prev.end_time;

    const shouldBreak = gap > LINE_BREAK_GAP_SEC || currentLine.length >= MAX_WORDS_PER_LINE;

    if (shouldBreak) {
      lines.push(currentLine);
      currentLine = [curr];
    } else {
      currentLine.push(curr);
    }
  }

  lines.push(currentLine);
  return lines;
}

// --- Core functions ---

function buildAss(words, style = 'clean', marginV = MARGIN_V) {
  const styleDef = STYLES[style] || STYLES.clean;
  const lines = groupWordsIntoLines(words);

  let dialogueEvents = '';

  if (style === 'active_word_highlight') {
    for (const line of lines) {
      const lineStart = line[0].start_time;
      const lineEnd = line[line.length - 1].end_time;

      let karaokeContent = '';
      for (const w of line) {
        const durationCs = Math.round((w.end_time - w.start_time) * 100);
        karaokeContent += `{\\k${durationCs}}${w.word} `;
      }

      dialogueEvents += `Dialogue: 0,${formatAssTime(lineStart)},${formatAssTime(lineEnd)},Default,,0,0,0,,${karaokeContent}\n`;
    }
  } else {
    for (const line of lines) {
      const lineStart = line[0].start_time;
      const lineEnd = line[line.length - 1].end_time;
      const text = line.map((w) => w.word).join(' ');

      dialogueEvents += `Dialogue: 0,${formatAssTime(lineStart)},${formatAssTime(lineEnd)},Default,,0,0,0,,${text}\n`;
    }
  }

  const ass = `[Script Info]
Title: Cuplik Subtitles
ScriptType: v4.00+
PlayResX: ${VIDEO_WIDTH}
PlayResY: ${VIDEO_HEIGHT}
WrapStyle: 0

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,${styleDef.fontName},${styleDef.fontSize},${styleDef.primaryColour},${HIGHLIGHT_COLOR},${styleDef.outlineColour},&H80000000,0,0,0,0,100,100,0,0,1,${styleDef.outlineWidth},1,2,${MARGIN_L},${MARGIN_R},${marginV},1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
${dialogueEvents}`;

  return ass;
}

function generateSrt(words, outputPath) {
  try {
    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    let content = '';
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      content += `${i + 1}\n`;
      content += `${formatSrtTime(w.start_time)} --> ${formatSrtTime(w.end_time)}\n`;
      content += `${w.word}\n\n`;
    }

    fs.writeFileSync(outputPath, content, 'utf-8');
    return { success: true, outputPath, error: null };
  } catch (err) {
    return { success: false, outputPath: null, error: err.message };
  }
}

async function burnSubtitles(inputPath, words, style = 'clean', outputPath, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Validate input file exists
  try {
    await fs.promises.access(inputPath, fs.constants.R_OK);
  } catch {
    return {
      success: false,
      outputPath: null,
      duration: 0,
      error: `Input file not found: ${inputPath}`,
    };
  }

  if (!words || !words.length) {
    return {
      success: false,
      outputPath: null,
      duration: 0,
      error: 'No words provided for subtitle generation',
    };
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  await fs.promises.mkdir(outputDir, { recursive: true });

  // Write ASS to temp file
  const assContent = buildAss(words, style, options.marginV);
  const timestamp = Date.now();
  const assPath = path.join(outputDir, `_subtitles_${timestamp}.ass`);

  try {
    await fs.promises.writeFile(assPath, assContent, 'utf-8');
  } catch (err) {
    return {
      success: false,
      outputPath: null,
      duration: 0,
      error: `Failed to write ASS file: ${err.message}`,
    };
  }

  return new Promise((resolve) => {
    let stderrChunks = [];
    let timer;

    const proc = ffmpeg(inputPath);

    const filterPath = assPath.replaceAll('\\', '/').replaceAll(':', '\\:').replaceAll("'", "'\\''");
    proc.videoFilter(`ass=filename='${filterPath}'`);
    proc.audioCodec('copy');
    proc.videoCodec('libx264');
    proc.output(outputPath);

    proc.on('end', async () => {
      clearTimeout(timer);
      await cleanup();
      resolve({
        success: true,
        outputPath,
        duration: words[words.length - 1].end_time - words[0].start_time,
        error: null,
      });
    });

    proc.on('error', async (err) => {
      clearTimeout(timer);
      await cleanup();
      const stderr = stderrChunks.join('');
      console.error(JSON.stringify({ phase: 'subtitle-burn', error: err.message, stderr: stderr.slice(-2000) }));
      resolve({
        success: false,
        outputPath: null,
        duration: 0,
        error: stderr || err.message,
      });
    });

    proc.on('stderr', (line) => {
      stderrChunks.push(line + '\n');
    });

    function cleanup() {
      return fs.promises.unlink(assPath).catch(() => {});
    }

    timer = setTimeout(async () => {
      proc.kill('SIGKILL');
      await cleanup();
      resolve({
        success: false,
        outputPath: null,
        duration: 0,
        error: 'timeout',
      });
    }, timeoutMs);

    proc.outputOptions(['-preset', 'fast', '-threads', '2']);
    proc.run();
  });
}

module.exports = {
  burnSubtitles,
  generateSrt,
  buildAss,
  SAFE_MARGINS,
  STYLES,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
};
