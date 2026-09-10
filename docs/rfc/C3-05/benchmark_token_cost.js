const fs = require('node:fs');
const path = require('node:path');
const { callChatCompletion } = require('../../../backend/src/services/llm-client');
const { buildPrompt } = require('../../../backend/src/services/curation.service');
const { createChunker } = require('../../../backend/src/services/chunker');

const EXCERPT_DIR = path.join(__dirname, '..', 'C3-03');
const REPORT_FILE = path.join(__dirname, 'benchmark_report.md');

const INPUT_PRICE_PER_1M = 0.20;
const OUTPUT_PRICE_PER_1M = 1.20;
const CHUNKS_FOR_45MIN = 9;

const chunker = createChunker({ chunkDurationSec: 300, contextPaddingSec: 30 });

function loadTranscript(filename) {
  const raw = fs.readFileSync(path.join(EXCERPT_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

async function benchmarkExcerpt(filename, label) {
  const transcript = loadTranscript(filename);
  const chunks = chunker(transcript);

  if (chunks.length === 0) {
    console.warn(`[${label}] No chunks produced — transcript too short`);
    return { label, inputTokens: 0, outputTokens: 0, latencyMs: 0, success: false };
  }

  const chunk = chunks[0];
  const prompt = buildPrompt(chunk);

  const start = Date.now();
  const result = await callChatCompletion(prompt);
  const latencyMs = Date.now() - start;

  const usage = result.usage || { inputTokens: 0, outputTokens: 0 };

  console.log(`[${label}] input=${usage.inputTokens} output=${usage.outputTokens} latency=${latencyMs}ms`);

  return {
    label,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    latencyMs,
    success: true,
  };
}

function writeReport(results) {
  const validResults = results.filter((r) => r.success);
  const avgInput = validResults.reduce((s, r) => s + r.inputTokens, 0) / validResults.length;
  const avgOutput = validResults.reduce((s, r) => s + r.outputTokens, 0) / validResults.length;
  const avgLatency = validResults.reduce((s, r) => s + r.latencyMs, 0) / validResults.length;

  const totalInputTokens = avgInput * CHUNKS_FOR_45MIN;
  const totalOutputTokens = avgOutput * CHUNKS_FOR_45MIN;
  const inputCost = (totalInputTokens / 1_000_000) * INPUT_PRICE_PER_1M;
  const outputCost = (totalOutputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;
  const totalCost = inputCost + outputCost;

  const lines = [
    '# Curation Token Cost Benchmark',
    '',
    `**Date:** ${new Date().toISOString().split('T')[0]}`,
    `**Model:** ${process.env.LLM_MODEL || 'gpt-5.6-luna'}`,
    `**Pricing:** $${INPUT_PRICE_PER_1M}/1M input, $${OUTPUT_PRICE_PER_1M}/1M output`,
    '',
    '## Per-Chunk Results',
    '',
    '| Excerpt | Input Tokens | Output Tokens | Latency (ms) |',
    '|---------|-------------|---------------|--------------|',
  ];

  for (const r of results) {
    if (r.success) {
      lines.push(`| ${r.label} | ${r.inputTokens} | ${r.outputTokens} | ${r.latencyMs} |`);
    } else {
      lines.push(`| ${r.label} | — | — | failed |`);
    }
  }

  lines.push('');
  lines.push('## 45-Minute Video Projection');
  lines.push('');
  lines.push(`- **Chunks:** ${CHUNKS_FOR_45MIN}`);
  lines.push(`- **Avg input tokens per chunk:** ${Math.round(avgInput)}`);
  lines.push(`- **Avg output tokens per chunk:** ${Math.round(avgOutput)}`);
  lines.push(`- **Avg latency per chunk:** ${Math.round(avgLatency)}ms`);
  lines.push(`- **Total estimated input tokens:** ${Math.round(totalInputTokens)}`);
  lines.push(`- **Total estimated output tokens:** ${Math.round(totalOutputTokens)}`);
  lines.push('');
  lines.push(`### Cost Breakdown`);
  lines.push('');
  lines.push(`| Component | Tokens | Cost |`);
  lines.push(`|-----------|--------|------|`);
  lines.push(`| Input | ${Math.round(totalInputTokens)} | $${inputCost.toFixed(4)} |`);
  lines.push(`| Output | ${Math.round(totalOutputTokens)} | $${outputCost.toFixed(4)} |`);
  lines.push(`| **Total** | | **$${totalCost.toFixed(4)}** |`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');

  if (totalCost < 0.10) {
    lines.push('- [x] **Within acceptable cost range** — less than $0.10 per video');
  } else if (totalCost < 0.50) {
    lines.push('- [x] **Acceptable** — under $0.50 per video, viable for MVP');
  } else {
    lines.push('- [ ] **At risk** — cost exceeds $0.50 per video, mitigation needed');
  }

  lines.push('');
  lines.push('## Caveats');
  lines.push('');
  lines.push('- Excerpts are ~40 seconds; real chunks are 5 minutes. Projection assumes linear token scaling.');
  lines.push('- Real multi-chunk testing needed for full RFC-C3-05 compliance.');
  lines.push('- Token counts may vary with transcript length due to prompt formatting.');

  const report = lines.join('\n');
  fs.writeFileSync(REPORT_FILE, report, 'utf-8');
  return report;
}

async function main() {
  console.log('Running token cost benchmark...\n');

  const excerpts = [
    { file: 'excerpt_1.json', label: 'Excerpt 1' },
    { file: 'excerpt_2.json', label: 'Excerpt 2' },
    { file: 'excerpt_3.json', label: 'Excerpt 3' },
  ];

  const results = [];
  for (const e of excerpts) {
    try {
      const result = await benchmarkExcerpt(e.file, e.label);
      results.push(result);
    } catch (err) {
      console.error(`[${e.label}] Error: ${err.message}`);
      results.push({ label: e.label, inputTokens: 0, outputTokens: 0, latencyMs: 0, success: false });
    }
  }

  console.log('\n--- Benchmark Report ---\n');
  const report = writeReport(results);
  console.log(report);
}

main().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
