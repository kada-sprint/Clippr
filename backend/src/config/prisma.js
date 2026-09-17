require('./env');
const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const AppError = require('../utils/app-error');

let prisma;

function databaseUrl() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!['postgresql:', 'postgres:'].includes(url.protocol) ||
        !url.hostname || url.hostname === 'HOST' ||
        url.searchParams.get('sslmode') !== 'require' ||
        url.searchParams.get('sslaccept') !== 'strict') {
      throw new Error('Invalid database configuration');
    }
    const certificate = url.searchParams.get('sslcert');
    if (!certificate) throw new Error('Missing certificate');
    const certificatePath = path.resolve(__dirname, '../../prisma', certificate);
    fs.accessSync(certificatePath, fs.constants.R_OK);
    url.searchParams.set('sslcert', certificatePath.replaceAll('\\', '/'));
    return url.toString();
  } catch {
    throw new AppError(503, 'DATABASE_NOT_CONFIGURED',
      'Periksa DATABASE_URL, sslmode=require, sslaccept=strict, dan sertifikat CA lokal.');
  }
}

function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl() } } });
  }
  return prisma;
}

async function disconnectPrisma() {
  if (prisma) await prisma.$disconnect();
}

module.exports = { getPrisma, disconnectPrisma, databaseUrl };
