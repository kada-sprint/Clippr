const path = require('node:path');
const AppError = require('../utils/app-error');
const clipModel = require('../models/clip.model');
const projectModel = require('../models/project.model');

const MEDIA_ROOT = path.resolve(__dirname, '../../');
const ALLOWED_FILES = new Set(['vertical.mp4', 'subtitled.mp4']);

function createMediaService({
  clipRepository = clipModel,
  projectRepository = projectModel,
} = {}) {
  return {
    async resolveAndVerify(userId, projectId, clipId, filename) {
      if (!ALLOWED_FILES.has(filename)) {
        throw new AppError(400, 'INVALID_MEDIA_FILE', 'File media tidak valid.');
      }

      const clip = await clipRepository.findByIdWithOwnership(clipId, userId);
      if (!clip) throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');
      if (clip.project.id !== projectId) {
        throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');
      }

      const relativePath = filename === 'subtitled.mp4'
        ? clip.subtitledVideoPath
        : clip.clipVideoPath;

      if (!relativePath) {
        throw new AppError(404, 'MEDIA_NOT_READY', 'Video belum tersedia.');
      }

      const resolved = path.resolve(MEDIA_ROOT, relativePath);
      if (!resolved.startsWith(MEDIA_ROOT)) {
        throw new AppError(400, 'UNSAFE_MEDIA_PATH', 'Path media tidak valid.');
      }

      return resolved;
    },
  };
}

module.exports = { createMediaService, ALLOWED_FILES, MEDIA_ROOT };
