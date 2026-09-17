const test = require('node:test');
const assert = require('node:assert/strict');
const { startWorkerRuntime } = require('../src/workers/worker-runtime');

test('worker runtime starts retention after the delay and closes timers and worker once', async () => {
  const calls = [];
  let delayed;
  let repeated;
  const close = await startWorkerRuntime({
    startMediaWorker: async () => async () => calls.push('worker-closed'),
    createRetention: () => ({ runOnce: async () => { calls.push('retention'); return []; } }),
    repository: {},
    mediaRoot: 'C:\\media',
    initialDelayMs: 10,
    intervalMs: 20,
    setTimeoutFn(callback, delay) {
      delayed = callback;
      calls.push(`delay:${delay}`);
      return 'timeout';
    },
    setIntervalFn(callback, delay) {
      repeated = callback;
      calls.push(`interval:${delay}`);
      return 'interval';
    },
    clearTimeoutFn: (timer) => calls.push(`clear-timeout:${timer}`),
    clearIntervalFn: (timer) => calls.push(`clear-interval:${timer}`),
  });

  assert.deepEqual(calls, ['delay:10']);
  delayed();
  await new Promise(setImmediate);
  assert.deepEqual(calls, ['delay:10', 'retention', 'interval:20']);
  await repeated();
  await close();
  await close();
  assert.deepEqual(calls, [
    'delay:10', 'retention', 'interval:20', 'retention',
    'clear-timeout:timeout', 'clear-interval:interval', 'worker-closed',
  ]);
});

test('worker runtime contains retention failures and keeps the scheduler alive', async () => {
  let delayed;
  let scheduled = false;
  const originalError = console.error;
  console.error = () => {};
  try {
    const close = await startWorkerRuntime({
      startMediaWorker: async () => async () => {},
      createRetention: () => ({ runOnce: async () => { throw new Error('test failure'); } }),
      repository: {},
      mediaRoot: 'C:\\media',
      setTimeoutFn(callback) { delayed = callback; return 'timeout'; },
      setIntervalFn() { scheduled = true; return 'interval'; },
      clearTimeoutFn() {},
      clearIntervalFn() {},
    });
    delayed();
    await new Promise(setImmediate);
    assert.equal(scheduled, true);
    await close();
  } finally {
    console.error = originalError;
  }
});
