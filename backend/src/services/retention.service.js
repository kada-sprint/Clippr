const path = require('node:path');
const fs = require('node:fs/promises');

const extensions = { source: ['.mp4', '.mov'], mp4: ['.mp4'], srt: ['.srt'] };

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function unsafePath() {
  const error = new Error('Media berada di luar batas penyimpanan yang diizinkan.');
  error.code = 'UNSAFE_MEDIA_PATH';
  return error;
}

// Deliberately unwired: the repository must provide an exclusive claim shared
// with upload/render jobs. A status read alone cannot authorize deletion.
function createRetentionService({ repository, mediaRoot, files = fs, clock = () => new Date() }) {
  if (!repository || typeof repository.listExpired !== 'function' ||
      typeof repository.withCleanupClaim !== 'function' ||
      typeof mediaRoot !== 'string' || !path.isAbsolute(mediaRoot)) {
    throw new TypeError('Retensi memerlukan repository dengan klaim eksklusif dan mediaRoot absolut.');
  }
  const root = path.resolve(mediaRoot);

  async function removeMedia(media) {
    if (!extensions[media.kind]?.includes(path.extname(media.path || '').toLowerCase()) ||
        !path.isAbsolute(media.path) || !inside(root, path.resolve(media.path))) {
      throw unsafePath();
    }
    const realRoot = await files.realpath(root);
    // Validate the parent even for a missing file; never clear an external path.
    const realParent = await files.realpath(path.dirname(media.path));
    if (realParent !== realRoot && !inside(realRoot, realParent)) throw unsafePath();
    try {
      const stat = await files.lstat(media.path);
      if (!stat.isFile() || stat.isSymbolicLink()) throw unsafePath();
      if (!inside(realRoot, await files.realpath(media.path))) throw unsafePath();
      await files.unlink(media.path);
      return 'cleaned';
    } catch (error) {
      if (error.code === 'ENOENT') return 'missing';
      throw error;
    }
  }

  return {
    async runOnce() {
      const now = clock();
      if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
        throw new TypeError('Waktu retensi tidak valid.');
      }
      const results = [];
      for (const candidate of await repository.listExpired(now)) {
        const result = { id: candidate.id, kind: candidate.kind, status: 'deferred' };
        try {
          // Callback receives a fresh snapshot and a conditional path update.
          // Claim stays held through filesystem deletion AND clearPath.
          await repository.withCleanupClaim(candidate, now, async ({ media, clearPath }) => {
            if (typeof clearPath !== 'function') throw new TypeError('Pembaruan path wajib tersedia.');
            if (media.id !== candidate.id || media.kind !== candidate.kind ||
                !media.path || !(media.expiresAt instanceof Date) ||
                !Number.isFinite(media.expiresAt.getTime()) || media.expiresAt > now) return;
            const status = await removeMedia(media);
            await clearPath();
            result.status = status;
          });
        } catch (error) {
          result.status = 'failed';
          result.code = error.code === 'UNSAFE_MEDIA_PATH' ? error.code : 'RETENTION_FAILED';
        }
        results.push(result);
      }
      return results;
    },
  };
}

module.exports = { createRetentionService };
