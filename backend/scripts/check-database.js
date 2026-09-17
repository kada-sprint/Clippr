const { getPrisma, disconnectPrisma } = require('../src/config/prisma');

async function main() {
  // SELECT-only diagnostics: no schema, row, or migration changes.
  const rows = await getPrisma().$queryRaw`
    SELECT current_schema() AS schema,
      (SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()) AS tls,
      to_regclass('users') IS NOT NULL AS users,
      to_regclass('projects') IS NOT NULL AS projects,
      to_regclass('clips') IS NOT NULL AS clips
  `;
  const result = rows[0];
  if (!result.tls) throw new Error('TLS_REQUIRED');
  console.log(JSON.stringify({ connected: true, ...result }, null, 2));
  console.log('Read-only check selesai; keberadaan tabel belum membuktikan kecocokan schema.');
}

main().catch((error) => {
  const code = /^[A-Z][A-Z0-9_]{1,40}$/.test(error.code || '') ? error.code : 'DATABASE_CHECK_FAILED';
  console.error(`Koneksi belum terverifikasi (${code}). Periksa .env, CA, jaringan, dan akses database.`);
  process.exitCode = 1;
}).finally(disconnectPrisma);
