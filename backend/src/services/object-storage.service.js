const fs = require('node:fs');
const files = require('node:fs/promises');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');

function validateObjectKey(key) {
  if (typeof key !== 'string' || !key || key.length > 1024 || key.startsWith('/') ||
      key.includes('\\') || key.split('/').some((part) => !part || part === '.' || part === '..') ||
      /[\u0000-\u001f\u007f]/.test(key)) {
    throw new TypeError('Object key R2 tidak valid.');
  }
  return key;
}

function readConfig(config = env) {
  const required = [
    'r2AccountId', 'r2AccessKeyId', 'r2SecretAccessKey', 'r2Bucket', 'r2Endpoint',
  ];
  if (required.some((name) => typeof config[name] !== 'string' || !config[name].trim())) {
    throw new Error('Konfigurasi Cloudflare R2 belum lengkap.');
  }
  let endpoint;
  try {
    endpoint = new URL(config.r2Endpoint);
  } catch {
    throw new Error('R2_ENDPOINT tidak valid.');
  }
  const expectedHost = `${config.r2AccountId}.r2.cloudflarestorage.com`;
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== expectedHost || endpoint.pathname !== '/') {
    throw new Error('R2_ENDPOINT harus menggunakan endpoint S3 akun Cloudflare yang sesuai.');
  }
  return { ...config, r2Endpoint: endpoint.origin };
}

function createObjectStorage({ config = env, client, signer = getSignedUrl } = {}) {
  const settings = readConfig(config);
  const s3 = client || new S3Client({
    region: 'auto',
    endpoint: settings.r2Endpoint,
    credentials: {
      accessKeyId: settings.r2AccessKeyId,
      secretAccessKey: settings.r2SecretAccessKey,
    },
  });
  const bucket = settings.r2Bucket;

  return {
    async head(key) {
      const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: validateObjectKey(key) }));
      return {
        contentLength: result.ContentLength,
        contentType: result.ContentType,
        etag: result.ETag,
      };
    },

    async createUploadUrl({ key, contentType, expiresIn = 900 }) {
      if (typeof contentType !== 'string' || !contentType) throw new TypeError('Content-Type wajib tersedia.');
      const command = new PutObjectCommand({ Bucket: bucket, Key: validateObjectKey(key), ContentType: contentType });
      return {
        url: await signer(s3, command, { expiresIn }),
        headers: { 'Content-Type': contentType },
      };
    },

    async createDownloadUrl({ key, expiresIn = 300, responseContentDisposition }) {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: validateObjectKey(key),
        ...(responseContentDisposition ? { ResponseContentDisposition: responseContentDisposition } : {}),
      });
      return signer(s3, command, { expiresIn });
    },

    async downloadToFile(key, targetPath) {
      if (typeof targetPath !== 'string' || !path.isAbsolute(targetPath)) {
        throw new TypeError('Target download harus berupa path absolut.');
      }
      await files.mkdir(path.dirname(targetPath), { recursive: true });
      const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: validateObjectKey(key) }));
      if (!result.Body) throw new Error('Object R2 tidak memiliki body.');
      await pipeline(result.Body, fs.createWriteStream(targetPath, { flags: 'wx' }));
      return targetPath;
    },

    async uploadFile({ key, filePath, contentType }) {
      if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
        throw new TypeError('Sumber upload harus berupa path absolut.');
      }
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: validateObjectKey(key),
        Body: fs.createReadStream(filePath),
        ContentType: contentType,
      }));
      return key;
    },

    async delete(key) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: validateObjectKey(key) }));
    },
  };
}

module.exports = { createObjectStorage, validateObjectKey, readConfig };
