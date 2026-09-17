const path = require('node:path');
const fs = require('node:fs/promises');
const AppError = require('../utils/app-error');
const env = require('../config/env');
const { createObjectStorage, validateObjectKey } = require('./object-storage.service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const temporarySubtitle = /^_subtitles_\d+\.ass$/;
const attemptOutput = /^(vertical|subtitled|subtitles)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp4|srt)$/i;

function createProjectMediaCleanup({ mediaRoot = env.mediaRoot, files = fs, objectStorage,
  objectStorageFactory = createObjectStorage } = {}) {
  const root = path.resolve(mediaRoot);
  function storage() {
    if (!objectStorage) objectStorage = objectStorageFactory();
    return objectStorage;
  }
  function unsafe() {
    return new AppError(503, 'UNSAFE_MEDIA_PATH', 'Lokasi media tidak aman untuk dihapus. Hubungi pengelola.');
  }

  // Check every ancestor, including for missing files, to reject junctions/symlinks.
  async function inspect(target, directory = false) {
    const relative = path.relative(root, target);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw unsafe();
    let current = root;
    const parts = relative.split(path.sep);
    for (let i = 0; i < parts.length; i += 1) {
      current = path.join(current, parts[i]);
      let stat;
      try { stat = await files.lstat(current); }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      if (stat.isSymbolicLink()) throw unsafe();
      const isDirectory = i < parts.length - 1 || directory;
      if (isDirectory ? !stat.isDirectory() : !stat.isFile()) throw unsafe();
    }
    return true;
  }

  return async function removeProjectMedia(project) {
    try {
      if (!UUID.test(project.id)) throw unsafe();
      const targets = new Set();
      const objectKeys = new Set();
      if (project.sourceVideoPath) {
        if (project.sourceVideoPath.startsWith('sources/')) {
          try { validateObjectKey(project.sourceVideoPath); } catch { throw unsafe(); }
          if (!project.sourceVideoPath.startsWith(`sources/${project.id}/`) ||
              !['.mp4', '.mov'].includes(path.posix.extname(project.sourceVideoPath).toLowerCase())) throw unsafe();
          objectKeys.add(project.sourceVideoPath);
        } else {
        const source = path.resolve(root, project.sourceVideoPath);
        if (path.dirname(source) !== path.join(root, 'uploads', 'videos') ||
            !['.mp4', '.mov'].includes(path.extname(source).toLowerCase())) throw unsafe();
        targets.add(source);
        }
      }
      for (const clip of project.clips) {
        if (!UUID.test(clip.id)) throw unsafe();
        const clipRoot = path.join(root, 'uploads', project.id, clip.id);
        const legacyClipRoot = path.join(root, project.id, clip.id);
        for (const storedPath of [clip.clipVideoPath, clip.subtitledVideoPath, clip.srtPath]) {
          if (!storedPath) continue;
          if (storedPath.startsWith('exports/')) {
            try { validateObjectKey(storedPath); } catch { throw unsafe(); }
            const allowed = new Set([
              `exports/${project.id}/${clip.id}/vertical.mp4`,
              `exports/${project.id}/${clip.id}/subtitled.mp4`,
              `exports/${project.id}/${clip.id}/subtitles.srt`,
            ]);
            if (!allowed.has(storedPath)) throw unsafe();
            objectKeys.add(storedPath);
            continue;
          }
          const target = path.resolve(root, storedPath);
          const dir = path.dirname(target);
          if ((dir !== clipRoot && dir !== legacyClipRoot) || !['.mp4', '.srt'].includes(path.extname(target).toLowerCase())) throw unsafe();
          targets.add(target);
        }
        // Failed renders may leave outputs before their paths reach the database.
        for (const cRoot of [clipRoot, legacyClipRoot]) {
          targets.add(path.join(cRoot, 'vertical.mp4'));
          targets.add(path.join(cRoot, 'subtitled.mp4'));
          if (await inspect(cRoot, true)) {
            for (const name of await files.readdir(cRoot)) {
              if (temporarySubtitle.test(name) || attemptOutput.test(name)) targets.add(path.join(cRoot, name));
            }
          }
        }
      }
      // Validate the entire set before the first unlink; never delete directories.
      for (const target of targets) await inspect(target);
      for (const key of objectKeys) await storage().delete(key);
      for (const target of targets) {
        if (!await inspect(target)) continue;
        try { await files.unlink(target); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(503, 'PROJECT_CLEANUP_FAILED', 'Penghapusan belum selesai. Sebagian media mungkin sudah terhapus; data proyek dipertahankan. Silakan coba lagi.');
    }
  };
}

module.exports = { createProjectMediaCleanup };
