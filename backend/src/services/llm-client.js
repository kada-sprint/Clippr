const OpenAI = require('openai');
const env = require('../config/env');
const AppError = require('../utils/app-error');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const TIMEOUT_MS = 35_000;
const RETRYABLE_STATUSES = new Set([429, 500, 503]);

function getClient() {
  if (!env.llmApiKey) {
    throw new AppError(
      503,
      'LLM_NOT_CONFIGURED',
      'API Key LLM belum dikonfigurasi. Harap isi LLM_API_KEY di file .env.'
    );
  }
  return new OpenAI({
    apiKey: env.llmApiKey,
    baseURL: env.llmApiBaseUrl || undefined,
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callChatCompletion(prompt) {
  const client = getClient();
  const model = env.llmModel;
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const start = Date.now();

    try {
      const response = await client.chat.completions.create(
        {
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          max_completion_tokens: 4096,
        },
        { signal: AbortSignal.timeout(TIMEOUT_MS) }
      );

      const latencyMs = Date.now() - start;
      const text = response.choices[0].message.content;
      const usage = {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      };

      return { text, usage, latencyMs };
    } catch (err) {
      lastError = err;
      const status = err?.status || err?.response?.status;

      if (status === 401 || status === 403) {
        throw new AppError(401, 'LLM_AUTH_FAILED', `Autentikasi LLM gagal: ${err.message}`);
      }

      if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
        if (attempt < MAX_RETRIES) {
          await delay(BASE_DELAY_MS * Math.pow(2, attempt));
          continue;
        }
        throw new AppError(504, 'LLM_TIMEOUT', `LLM timeout setelah ${MAX_RETRIES + 1} percobaan`);
      }

      if (RETRYABLE_STATUSES.has(status) && attempt < MAX_RETRIES) {
        const retryAfter = err.headers?.['retry-after'];
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        await delay(waitMs);
        continue;
      }

      throw new AppError(502, 'LLM_UNREACHABLE', `LLM tidak dapat diakses (${status || 'unknown'}): ${err.message}`);
    }
  }

  throw new AppError(502, 'LLM_UNREACHABLE', `LLM gagal setelah ${MAX_RETRIES + 1} percobaan: ${lastError?.message}`);
}

module.exports = { callChatCompletion };
