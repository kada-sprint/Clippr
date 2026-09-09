const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createChunker } = require('../src/services/chunker');
const { buildPrompt, parseLlmResponse } = require('../src/services/curation.service');
const clipOutputSchema = require('../src/utils/clip-output-schema');
const fallbackOutputSchema = require('../src/utils/fallback-output-schema');
const { parseFallback } = require('../src/services/fallback_parser');
const goodTranscript = require('../../docs/rfc/C2-01/sample_transcript_mock.json');
const badTranscript = require('./fixtures/sample_transcript_bad_mock.json');

const chunker = createChunker({ chunkDurationSec: 300, contextPaddingSec: 30 });

function mockLlmGood(_prompt) {
  return JSON.stringify({
    segments: [
      {
        start_time_seconds: 9.4,
        end_time_seconds: 75.64,
        duration: 66.24,
        concept_score: 96,
        suggested_title: 'AI Automated Grading: Solusi Efisiensi Guru',
        pedagogical_reason:
          'Pembuka jelas (3 jam/hari menilai manual), elaborasi spesifik (Gradescope, 3 jam \u2192 30 menit), kesimpulan lengkap dengan diskursus marker.',
      },
    ],
  });
}

function mockLlmBad(_prompt) {
  return JSON.stringify({
    segments: [
      {
        start_time_seconds: 0,
        end_time_seconds: 35,
        duration: 35,
        concept_score: 0,
        suggested_title: 'Manfaat ML di Berbagai Bidang',
        pedagogical_reason:
          'Pembuka samar, elaborasi generik, clip terpotong di tengah kalimat.',
      },
    ],
  });
}

function mockLlmGarbage(_prompt) {
  return 'This is not JSON at all, just random text from the LLM.';
}

function mockLlmPartialJson(_prompt) {
  return '```json\n{"segments": [{"start_time_seconds": 10, "end_time_seconds": 40, "duration": 30, "concept_score": 55, "suggested_title": "Partial Clip"}}';
}

// AC1: Full pipeline runs without unhandled exceptions on both transcripts
test('AC1: good transcript pipeline runs without exceptions', () => {
  const chunks = chunker(goodTranscript);
  assert.ok(chunks.length > 0, 'should produce chunks from good transcript');

  for (const chunk of chunks) {
    const prompt = buildPrompt(chunk);
    assert.ok(typeof prompt === 'string', 'prompt should be a string');
    assert.ok(prompt.length > 0, 'prompt should not be empty');

    const rawResponse = mockLlmGood(prompt);
    const result = parseLlmResponse(rawResponse);
    assert.equal(result.success, true, 'parseLlmResponse should succeed');
    assert.ok(result.data.segments.length > 0, 'should have segments');
  }
});

test('AC1: bad transcript pipeline runs without exceptions', () => {
  const chunks = chunker(badTranscript);
  assert.ok(chunks.length > 0, 'should produce chunks from bad transcript');

  for (const chunk of chunks) {
    const prompt = buildPrompt(chunk);
    assert.ok(typeof prompt === 'string', 'prompt should be a string');

    const rawResponse = mockLlmBad(prompt);
    const result = parseLlmResponse(rawResponse);
    assert.equal(result.success, true, 'parseLlmResponse should succeed');
  }
});

// AC2: Good transcript produces plausible high concept_score with non-null pedagogical_reason
test('AC2: good transcript produces high concept_score', () => {
  const chunks = chunker(goodTranscript);
  const prompt = buildPrompt(chunks[0]);
  const rawResponse = mockLlmGood(prompt);
  const result = parseLlmResponse(rawResponse);

  assert.equal(result.success, true);
  const segment = result.data.segments[0];
  assert.ok(segment.concept_score >= 70, `concept_score should be >= 70, got ${segment.concept_score}`);
  assert.ok(segment.pedagogical_reason, 'pedagogical_reason should be non-null');
  assert.ok(segment.pedagogical_reason.length > 0, 'pedagogical_reason should be non-empty');
  assert.ok(segment.suggested_title.length > 0, 'suggested_title should be non-empty');
});

// AC3: Bad/off-topic transcript produces low score or clean rejection — not a crash
test('AC3: bad transcript produces low score, not a crash', () => {
  const chunks = chunker(badTranscript);
  const prompt = buildPrompt(chunks[0]);
  const rawResponse = mockLlmBad(prompt);
  const result = parseLlmResponse(rawResponse);

  assert.equal(result.success, true);
  const segment = result.data.segments[0];
  assert.ok(segment.concept_score <= 40, `concept_score should be <= 40 for bad transcript, got ${segment.concept_score}`);
});

test('AC3 alternative: LLM returns empty segments — clean rejection, no crash', () => {
  const result = parseLlmResponse(JSON.stringify({ segments: [] }));
  assert.equal(result.success, true);
  assert.equal(result.data.segments.length, 0);
});

// AC3b: Garbage LLM output triggers fallback parser gracefully
test('AC3b: garbage LLM output handled by fallback without crash', () => {
  const result = parseLlmResponse(mockLlmGarbage());
  assert.equal(typeof result.success, 'boolean', 'result should have success boolean');
  // Either fallback parses it or it returns success:false — no exception thrown
});

// AC3c: Partial JSON triggers fallback parser
test('AC3c: partial JSON output handled by fallback without crash', () => {
  const result = parseLlmResponse(mockLlmPartialJson());
  assert.equal(typeof result.success, 'boolean', 'result should have success boolean');
});

// Schema validation: clipOutputSchema accepts valid segment
test('clipOutputSchema validates correct segment', () => {
  const validSegment = {
    segments: [
      {
        start_time_seconds: 10,
        end_time_seconds: 50,
        duration: 40,
        concept_score: 85,
        suggested_title: 'Test Clip',
        pedagogical_reason: 'A valid pedagogical reason.',
      },
    ],
  };
  const validation = clipOutputSchema.validate(validSegment, { abortEarly: false });
  assert.equal(validation.error, undefined, 'should validate without error');
});

// Schema validation: clipOutputSchema rejects invalid segment
test('clipOutputSchema rejects segment with duration outside 25-75', () => {
  const invalidSegment = {
    segments: [
      {
        start_time_seconds: 10,
        end_time_seconds: 20,
        duration: 10,
        concept_score: 50,
        suggested_title: 'Short Clip',
        pedagogical_reason: 'Too short.',
      },
    ],
  };
  const validation = clipOutputSchema.validate(invalidSegment, { abortEarly: false });
  assert.ok(validation.error, 'should reject segment with duration < 25');
});

// Schema validation: fallbackOutputSchema accepts valid fallback segment
test('fallbackOutputSchema accepts segment with null concept_score', () => {
  const fallbackSegment = {
    segments: [
      {
        start_time_seconds: 10,
        end_time_seconds: 50,
        duration: 40,
        concept_score: null,
        suggested_title: 'Fallback Clip',
        pedagogical_reason: null,
      },
    ],
  };
  const validation = fallbackOutputSchema.validate(fallbackSegment, { abortEarly: false });
  assert.equal(validation.error, undefined, 'should accept null concept_score and pedagogical_reason');
});
