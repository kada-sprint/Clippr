/**
 * Smoke test: real LLM call against GPT-5.6 Luna
 * 
 * Usage:
 *   cd backend && node scripts/smoke-test-llm.js
 * 
 * Requires LLM_API_KEY in backend/.env
 */

const { callChatCompletion } = require('../src/services/llm-client');
const { buildPrompt } = require('../src/services/curation.service');
const { createChunker } = require('../src/services/chunker');
const sampleTranscript = require('../../docs/rfc/C2-01/sample_transcript_mock.json');

async function main() {
  console.log('--- LLM Smoke Test ---\n');

  const chunker = createChunker({ chunkDurationSec: 300, contextPaddingSec: 30 });
  const chunks = chunker(sampleTranscript);

  console.log(`Transcript chunks: ${chunks.length}`);
  console.log(`First chunk words: ${chunks[0].transcriptSlice.length}\n`);

  const prompt = buildPrompt(chunks[0]);
  console.log(`Prompt length: ${prompt.length} chars`);
  console.log('Calling GPT-5.6 Luna...\n');

  try {
    const result = await callChatCompletion(prompt);

    console.log(`Latency: ${result.latencyMs}ms`);
    console.log(`Input tokens: ${result.usage.inputTokens}`);
    console.log(`Output tokens: ${result.usage.outputTokens}`);
    console.log(`Response length: ${result.text.length} chars`);
    console.log(`\nFirst 500 chars of response:\n${result.text.slice(0, 500)}\n`);

    const parsed = JSON.parse(result.text);
    console.log(`Segments returned: ${parsed.segments?.length ?? 'N/A'}`);

    if (parsed.segments?.length > 0) {
      for (const seg of parsed.segments) {
        console.log(`  - [${seg.start_time_seconds}s-${seg.end_time_seconds}s] score=${seg.concept_score} "${seg.suggested_title}"`);
      }
    }

    console.log('\n--- Smoke test passed ---');
  } catch (err) {
    console.error(`Error: ${err.code} — ${err.message}`);
    process.exit(1);
  }
}

main();
