const path = require('node:path');
const fs = require('node:fs');
const AppError = require('../utils/app-error');
const clipModel = require('../models/clip.model');
const projectModel = require('../models/project.model');
const { generateSrt } = require('./srtGenerator');
const { buildExportBasename } = require('../utils/filenameUtils');
const env = require('../config/env');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ALLOWED_LAYOUTS = ['slide-cam', 'talking-head', 'slide-only'];
const ALLOWED_SUBTITLE_STYLES = ['clean', 'active_word_highlight'];
const MUTABLE_FIELDS = ['title', 'startTime', 'endTime', 'transcriptJson', 'subtitleStyle', 'horizontalOffset'];

function validateClipId(clipId) {
  if (typeof clipId !== 'string' || !UUID_PATTERN.test(clipId)) {
    throw new AppError(400, 'INVALID_CLIP_ID', 'ID klip tidak valid.');
  }
  return clipId;
}

function validateProjectId(projectId) {
  if (typeof projectId !== 'string' || !UUID_PATTERN.test(projectId)) {
    throw new AppError(400, 'INVALID_PROJECT_ID', 'ID proyek tidak valid.');
  }
  return projectId;
}

function sanitizePatch(patch) {
  const sanitized = {};
  for (const key of MUTABLE_FIELDS) {
    if (key in patch) {
      sanitized[key] = patch[key];
    }
  }
  return sanitized;
}

function createClipService({
  clipRepository = clipModel,
  projectRepository = projectModel,
} = {}) {
  return {
    async listClips(userId, projectId) {
      validateProjectId(projectId);
      try {
        const project = await projectRepository.findByIdForUser(projectId, userId);
        if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan.');
        return clipRepository.findManyByProjectId(projectId);
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Data klip belum tersedia.');
      }
    },

    async updateClip(userId, clipId, patch) {
      validateClipId(clipId);
      const sanitized = sanitizePatch(patch);
      if (Object.keys(sanitized).length === 0) {
        throw new AppError(400, 'NO_UPDATABLE_FIELDS', 'Tidak ada field yang dapat diperbarui.');
      }

      try {
        const clip = await clipRepository.findByIdWithOwnership(clipId, userId);
        if (!clip) throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');

        if (sanitized.subtitleStyle && !ALLOWED_SUBTITLE_STYLES.includes(sanitized.subtitleStyle)) {
          throw new AppError(400, 'INVALID_SUBTITLE_STYLE', 'Gaya subtitle tidak valid.');
        }

        if (sanitized.horizontalOffset !== undefined) {
          const val = Number(sanitized.horizontalOffset);
          if (Number.isNaN(val) || val < -0.4 || val > 0.4) {
            throw new AppError(400, 'INVALID_HORIZONTAL_OFFSET', 'Posisi horizontal harus antara -0.4 dan 0.4.');
          }
          sanitized.horizontalOffset = val;
        }

        if (sanitized.startTime !== undefined && sanitized.endTime !== undefined) {
          if (Number(sanitized.startTime) >= Number(sanitized.endTime)) {
            throw new AppError(400, 'INVALID_TIME_RANGE', 'Waktu mulai harus sebelum waktu selesai.');
          }
        }

        const updated = await clipRepository.updateIfInactive(clipId, userId, sanitized);
        return updated;
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Gagal memperbarui klip.');
      }
    },

    async getTranscript(userId, clipId) {
      validateClipId(clipId);
      try {
        const clip = await clipRepository.findByIdWithOwnership(clipId, userId);
        if (!clip) throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');
        return { id: clip.id, transcriptJson: clip.transcriptJson };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Data transkrip belum tersedia.');
      }
    },

    async renderClip(userId, clipId) {
      validateClipId(clipId);

      try {
        const clip = await clipRepository.claimRender(clipId, userId);
        const project = clip.project;

        const layout = project.selectedLayout || 'slide-cam';
        const clipDir = path.join(env.mediaRoot, 'uploads', project.id, clip.id);
        const verticalPath = path.join(clipDir, 'vertical.mp4').replaceAll('\\', '/');
        const subtitledPath = path.join(clipDir, 'subtitled.mp4').replaceAll('\\', '/');
        const srtPath = path.join(clipDir, 'subtitles.srt').replaceAll('\\', '/');

        setImmediate(async () => {
          try {
            const clipDuration = Number(clip.endTime) - Number(clip.startTime);
            const timeoutMs = layout === 'slide-only'
              ? Math.max(120_000, clipDuration * 2_000)
              : Math.max(60_000, clipDuration * 1_500);

            const reframeResult = await renderClip(
              env.resolveMediaPath(project.sourceVideoPath),
              Number(clip.startTime),
              Number(clip.endTime),
              verticalPath,
              layout,
              { horizontalOffset: clip.horizontalOffset ?? 0, timeoutMs },
            );

            if (!reframeResult.success) {
              console.error(`[Clip Render] Reframe failed for clip ${clipId}:`, reframeResult.error);
              await clipRepository.updateById(clipId, { status: 'error' });
              return;
            }

            const words = clip.transcriptJson?.words;
            if (words && words.length > 0) {
              const subtitleResult = await burnSubtitles(
                verticalPath,
                words,
                clip.subtitleStyle || 'clean',
                subtitledPath,
                { marginV: layout === 'slide-cam' ? 672 : undefined },
              );

              if (subtitleResult.success) {
                const srtResult = generateSrt(clip.transcriptJson, srtPath);
                await clipRepository.updateById(clipId, {
                  status: 'rendered',
                  clipVideoPath: verticalPath,
                  subtitledVideoPath: subtitledPath,
                  srtPath: srtResult.success ? srtPath : null,
                  renderedAt: new Date(),
                  exportExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                });
              } else {
                console.error(`[Clip Render] Subtitle burn failed for clip ${clipId}:`, subtitleResult.error);
                await clipRepository.updateById(clipId, { status: 'error' });
              }
            } else {
              await clipRepository.updateById(clipId, {
                status: 'rendered',
                clipVideoPath: verticalPath,
                subtitledVideoPath: null,
                renderedAt: new Date(),
                exportExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              });
            }
          } catch (err) {
            console.error(`[Clip Render] Unexpected error for clip ${clipId}:`, err.message || err);
            await clipRepository.updateById(clipId, { status: 'error' });
          }
        });

        return { id: clip.id, status: 'rendering' };
      } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(503, 'DATABASE_UNAVAILABLE', 'Gagal memulai render.');
      }
    },

    async exportMp4(userId, clipId) {
      validateClipId(clipId);
      const clip = await clipRepository.findByIdWithOwnership(clipId, userId);
      if (!clip) throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');

      if (clip.status !== 'rendered') {
        throw new AppError(409, 'CLIP_NOT_RENDERED', 'Klip belum siap untuk diunduh.');
      }

      const filePath = clip.subtitledVideoPath || clip.clipVideoPath;
      if (!filePath || !fs.existsSync(filePath)) {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Berkas video tidak ditemukan di disk.');
      }

      const basename = buildExportBasename(clip);
      return { filePath, basename };
    },

    async exportSrt(userId, clipId) {
      validateClipId(clipId);
      const clip = await clipRepository.findByIdWithOwnership(clipId, userId);
      if (!clip) throw new AppError(404, 'CLIP_NOT_FOUND', 'Klip tidak ditemukan.');

      let srtPath = clip.srtPath;

      if (!srtPath || !fs.existsSync(srtPath)) {
        if (clip.status !== 'rendered') {
          throw new AppError(409, 'CLIP_NOT_RENDERED', 'Klip belum siap untuk diunduh.');
        }

        const words = clip.transcriptJson?.words;
        if (!words || words.length === 0) {
          throw new AppError(409, 'NO_TRANSCRIPT', 'Tidak ada transkrip untuk diekspor.');
        }

        const project = clip.project;
        const clipDir = path.join(env.mediaRoot, 'uploads', project.id, clip.id);
        const generatedPath = path.join(clipDir, 'subtitles.srt').replaceAll('\\', '/');
        const result = generateSrt(clip.transcriptJson, generatedPath);
        if (!result.success) {
          throw new AppError(500, 'SRT_GENERATION_FAILED', 'Gagal membuat berkas SRT.');
        }

        srtPath = generatedPath;
        await clipRepository.updateById(clipId, { srtPath });
      }

      if (!fs.existsSync(srtPath)) {
        throw new AppError(404, 'FILE_NOT_FOUND', 'Berkas SRT tidak ditemukan di disk.');
      }

      const basename = buildExportBasename(clip);
      return { filePath: srtPath, basename };
    },
  };
}

module.exports = {
  createClipService,
};
