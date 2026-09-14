const env = require('./src/config/env');
const { createApp } = require('./src/app');
const { disconnectPrisma } = require('./src/config/prisma');

if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
  throw new Error('PORT harus berada pada rentang 1-65535.');
}

const server = createApp().listen(env.port, '127.0.0.1', () => {
  console.log(`Cuplik API: http://localhost:${env.port}`);
});

// Sementara naikan TIMEOUT KE 30 MENIT (1.800.000 ms) buat test
server.timeout = 1800000;
server.keepAliveTimeout = 1800000;
server.on('error', () => {
  console.error('API gagal dijalankan. Periksa apakah port tersedia.');
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(async () => {
      await disconnectPrisma();
      process.exit(0);
    });
  });
}
