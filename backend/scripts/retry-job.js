require('../src/config/env');
const jobs = require('../src/models/processing-job.model');
const { disconnectPrisma } = require('../src/config/prisma');

async function main() {
  const id = process.argv[2];
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) {
    throw new Error('Gunakan: npm run job:retry -- <UUID job gagal>');
  }
  const next = await jobs.retry(id);
  if (!next) throw new Error('Job tidak ditemukan.');
  console.log(`Job pengganti tercatat: ${next.id}`);
}
main().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; }).finally(disconnectPrisma);
