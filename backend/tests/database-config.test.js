const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseUrl } = require('../src/config/prisma');

test('database configuration rejects missing credentials and weakened TLS before connecting', (t) => {
  const original = process.env.DATABASE_URL;
  t.after(() => {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  });
  for (const url of [
    '',
    'postgresql://user:password@localhost/db?sslmode=disable',
    'postgresql://user:password@localhost/db?sslmode=require&sslaccept=accept_invalid_certs',
    'postgresql://user:password@localhost/db?sslmode=require&sslaccept=strict',
    'postgresql://user:password@localhost/db?sslmode=require&sslaccept=strict&sslcert=missing-certificate.pem',
  ]) {
    process.env.DATABASE_URL = url;
    assert.throws(databaseUrl, { status: 503, code: 'DATABASE_NOT_CONFIGURED' });
  }
});
