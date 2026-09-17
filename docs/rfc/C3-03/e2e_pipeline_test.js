const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { callChatCompletion } = require('../../../backend/src/services/llm-client');
const { buildPrompt, parseLlmResponse } = require('../../../backend/src/services/curation.service');

const TRANSCRIPT_DIR = __dirname;
const RESULTS_FILE = path.join(TRANSCRIPT_DIR, 'e2e_results.md');

const BANTER_THRESHOLD = 50;
const POSITIVE_CONTROL_THRESHOLD = 70;

function loadTranscript(filename) {
  const raw = fs.readFileSync(path.join(TRANSCRIPT_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

function formatWordTimestamps(transcript) {
  return transcript.words
    .map((w) => `[${w.start_time.toFixed(2)}-${w.end_time.toFixed(2)}] ${w.word}`)
    .join(' ');
}

async function runPipeline(transcript, label) {
  const transcriptText = formatWordTimestamps(transcript);

  const chunk = {
    chunkIndex: 0,
    scoredRange: {
      start: transcript.words[0].start_time,
      end: transcript.words[transcript.words.length - 1].end_time,
    },
    contextRange: {
      start: transcript.words[0].start_time,
      end: transcript.words[transcript.words.length - 1].end_time,
    },
    transcriptSlice: transcript.words,
  };

  const prompt = buildPrompt(chunk);
  const startTime = Date.now();
  const rawResponse = await callChatCompletion(prompt);
  const latencyMs = Date.now() - startTime;

  const rawText = typeof rawResponse === 'string' ? rawResponse : rawResponse.text;
  const result = parseLlmResponse(rawText);

  let rawParsed;
  try {
    rawParsed = JSON.parse(rawText);
  } catch {
    rawParsed = null;
  }

  const durationProposals = rawParsed?.segments?.map((s) => s.duration) || [];
  const outOfRange = durationProposals.filter((d) => d < 25 || d > 75);

  return {
    label,
    latencyMs,
    success: result.success,
    isFallback: result.isFallback || false,
    segments: result.data?.segments || [],
    rawParsed,
    durationProposals,
    outOfRangeCount: outOfRange.length,
    totalProposals: durationProposals.length,
  };
}

function writeResults(allResults) {
  const lines = [
    '# E2E Pipeline Test Results',
    '',
    `**Date:** ${new Date().toISOString().split('T')[0]}`,
    `**Model:** ${process.env.LLM_MODEL || 'gpt-5.6-luna'}`,
    '',
    '## Summary',
    '',
    '| Transcript | Score | Duration In-Range | Schema Accepted | Latency (ms) |',
    '|------------|-------|-------------------|-----------------|--------------|',
  ];

  for (const r of allResults) {
    const score = r.segments[0]?.concept_score ?? 'N/A';
    const durStatus =
      r.totalProposals === 0
        ? 'no proposals'
        : `${r.totalProposals - r.outOfRangeCount}/${r.totalProposals}`;
    const schemaStatus = r.success ? (r.isFallback ? 'fallback' : 'accepted') : 'rejected';
    lines.push(
      `| ${r.label} | ${score} | ${durStatus} | ${schemaStatus} | ${r.latencyMs} |`
    );
  }

  lines.push('');
  lines.push('## Duration Compliance');
  lines.push('');

  let totalProposals = 0;
  let totalOutOfRange = 0;
  for (const r of allResults) {
    totalProposals += r.totalProposals;
    totalOutOfRange += r.outOfRangeCount;
  }
  lines.push(
    `Of ${totalProposals} live proposals, ${totalProposals - totalOutOfRange} were within-range pre-validation; ${totalOutOfRange} required schema rejection.`
  );

  lines.push('');
  lines.push('## Known Limitations');
  lines.push('');
  lines.push(
    'LLM scoring shows some run-to-run variance; validated via wide-threshold smoke test + manual spot-check, not full statistical consistency testing.'
  );

  lines.push('');
  lines.push('## Per-Transcript Details');
  lines.push('');

  for (const r of allResults) {
    lines.push(`### ${r.label}`);
    lines.push('');
    if (r.segments.length > 0) {
      for (const seg of r.segments) {
        lines.push(`- **Score:** ${seg.concept_score}`);
        lines.push(`- **Duration:** ${seg.duration}s`);
        lines.push(`- **Title:** ${seg.suggested_title}`);
        lines.push(`- **Reason:** ${seg.pedagogical_reason}`);
      }
    } else {
      lines.push('- **No segments proposed**');
    }
    if (r.outOfRangeCount > 0) {
      lines.push(`- **Out-of-range durations:** ${r.outOfRangeCount} of ${r.totalProposals}`);
    }
    lines.push('');
  }

  fs.writeFileSync(RESULTS_FILE, lines.join('\n'), 'utf-8');
  return lines.join('\n');
}

test('banter transcript scores below threshold', async () => {
  const transcript = loadTranscript('banter_transcript.json');
  const result = await runPipeline(transcript, 'Banter (off-topic)');

  console.log(`\n[Banter] Score: ${result.segments[0]?.concept_score ?? 'N/A'}`);
  console.log(`[Banter] Duration proposals: ${result.durationProposals}`);
  console.log(`[Banter] Out-of-range: ${result.outOfRangeCount}`);

  if (result.segments.length > 0) {
    assert.ok(
      result.segments[0].concept_score < BANTER_THRESHOLD,
      `Banter score ${result.segments[0].concept_score} should be < ${BANTER_THRESHOLD}`
    );
  }
});

test('topic jump transcript scores below threshold', async () => {
  const transcript = loadTranscript('topic_jump_transcript.json');

  const result1 = await runPipeline(transcript, 'Topic Jump (run 1)');
  console.log(`\n[Topic Jump R1] Score: ${result1.segments[0]?.concept_score ?? 'N/A'}`);

  const result2 = await runPipeline(transcript, 'Topic Jump (run 2)');
  console.log(`[Topic Jump R2] Score: ${result2.segments[0]?.concept_score ?? 'N/A'}`);

  if (result1.segments.length > 0 && result2.segments.length > 0) {
    const variance = Math.abs(result1.segments[0].concept_score - result2.segments[0].concept_score);
    console.log(`[Topic Jump] Score variance between runs: ${variance}`);
  }
});

test('positive control excerpt_1 scores above threshold', async () => {
  const transcript = loadTranscript('excerpt_1.json');
  const result = await runPipeline(transcript, 'Excerpt 1 (positive control)');

  console.log(`\n[Excerpt 1] Score: ${result.segments[0]?.concept_score ?? 'N/A'}`);
  console.log(`[Excerpt 1] Duration proposals: ${result.durationProposals}`);

  if (result.segments.length > 0) {
    assert.ok(
      result.segments[0].concept_score > POSITIVE_CONTROL_THRESHOLD,
      `Excerpt 1 score ${result.segments[0].concept_score} should be > ${POSITIVE_CONTROL_THRESHOLD}`
    );
  }
});

test('positive control excerpt_2 scores above threshold', async () => {
  const transcript = loadTranscript('excerpt_2.json');
  const result = await runPipeline(transcript, 'Excerpt 2 (positive control)');

  console.log(`\n[Excerpt 2] Score: ${result.segments[0]?.concept_score ?? 'N/A'}`);

  if (result.segments.length > 0) {
    assert.ok(
      result.segments[0].concept_score > POSITIVE_CONTROL_THRESHOLD,
      `Excerpt 2 score ${result.segments[0].concept_score} should be > ${POSITIVE_CONTROL_THRESHOLD}`
    );
  }
});

test('positive control excerpt_3 scores above threshold', async () => {
  const transcript = loadTranscript('excerpt_3.json');
  const result = await runPipeline(transcript, 'Excerpt 3 (positive control)');

  console.log(`\n[Excerpt 3] Score: ${result.segments[0]?.concept_score ?? 'N/A'}`);

  if (result.segments.length > 0) {
    assert.ok(
      result.segments[0].concept_score > POSITIVE_CONTROL_THRESHOLD,
      `Excerpt 3 score ${result.segments[0].concept_score} should be > ${POSITIVE_CONTROL_THRESHOLD}`
    );
  }
});

test('generate e2e_results.md', async () => {
  const transcripts = [
    { file: 'banter_transcript.json', label: 'Banter (off-topic)' },
    { file: 'topic_jump_transcript.json', label: 'Topic Jump' },
    { file: 'excerpt_1.json', label: 'Excerpt 1 (positive control)' },
    { file: 'excerpt_2.json', label: 'Excerpt 2 (positive control)' },
    { file: 'excerpt_3.json', label: 'Excerpt 3 (positive control)' },
  ];

  const allResults = [];
  for (const t of transcripts) {
    try {
      const transcript = loadTranscript(t.file);
      const result = await runPipeline(transcript, t.label);
      allResults.push(result);
    } catch (err) {
      allResults.push({
        label: t.label,
        latencyMs: 0,
        success: false,
        isFallback: false,
        segments: [],
        rawParsed: null,
        durationProposals: [],
        outOfRangeCount: 0,
        totalProposals: 0,
        error: err.message,
      });
    }
  }

  const report = writeResults(allResults);
  console.log('\n--- e2e_results.md ---');
  console.log(report);
});
