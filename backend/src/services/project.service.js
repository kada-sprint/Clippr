const AppError = require('../utils/app-error');
const projectModel = require('../models/project.model');

const ALLOWED_LAYOUTS = Object.freeze(['SLIDE_CAM', 'TALKING_HEAD', 'SLIDE_ONLY']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateProjectId(projectId) {
  if (typeof projectId !== 'string' || !UUID_PATTERN.test(projectId)) {
    throw new AppError(400, 'INVALID_PROJECT_ID', 'ID proyek tidak valid.');
  }
  return projectId;
}

function validateAndFormatVocabulary(rawVocabulary) {
  if (!rawVocabulary || typeof rawVocabulary !== 'string') return '';
  const terms = [];
  for (const value of rawVocabulary.split(',')) {
    const term = value.trim();
    if (!term) continue;
    const duplicate = terms.some(
      (item) => item.toLocaleLowerCase('id') === term.toLocaleLowerCase('id'),
    );
    if (!duplicate) terms.push(term);
  }
  if (terms.length > 20) {
    throw new AppError(400, 'VOCABULARY_LIMIT_EXCEEDED', 'Kamus istilah maksimal 20 istilah.');
  }
  return terms.join(', ');
}

const LAYOUT_MAP = Object.freeze({
  slide_speaker: 'SLIDE_CAM',
  speaker: 'TALKING_HEAD',
  slides: 'SLIDE_ONLY',
  SLIDE_CAM: 'SLIDE_CAM',
  TALKING_HEAD: 'TALKING_HEAD',
  SLIDE_ONLY: 'SLIDE_ONLY',
});

function validateLayout(layout) {
  if (typeof layout !== 'string') {
    throw new AppError(400, 'INVALID_LAYOUT', 'Layout yang dipilih tidak didukung.');
  }
  const normalized = LAYOUT_MAP[layout] || layout;
  if (!ALLOWED_LAYOUTS.includes(normalized)) {
    throw new AppError(400, 'INVALID_LAYOUT', 'Layout yang dipilih tidak didukung.');
  }
  return normalized;
}

function toSummary(project) {
  return {
    id: project.id,
    status: project.status,
    processingStage: project.processingStage,
    selectedLayout: project.selectedLayout,
    hasSource: Boolean(project.sourceVideoPath),
    clipCount: project._count?.clips ?? 0,
    createdAt: project.createdAt,
  };
}

function toDetail(project) {
  return {
    ...toSummary(project),
    customVocabulary: project.customVocabulary,
    lastEditActivityAt: project.lastEditActivityAt,
    sourceExpiresAt: project.sourceExpiresAt,
  };
}

function throwDatabaseError(error, message) {
  if (error instanceof AppError) throw error;
  throw new AppError(503, 'DATABASE_UNAVAILABLE', message);
}

function createProjectService({ projectRepository = projectModel } = {}) {
  return {
    async list(userId) {
      try {
        return (await projectRepository.listByUserId(userId)).map(toSummary);
      } catch (error) {
        throwDatabaseError(error, 'Data proyek belum tersedia.');
      }
    },

    async create(userId, body) {
      if (!body || Array.isArray(body) || Object.keys(body).length) {
        throw new AppError(400, 'INVALID_PROJECT_CREATE', 'Pembuatan proyek menggunakan objek JSON kosong.');
      }
      try {
        return toSummary(await projectRepository.createForUser(userId));
      } catch (error) {
        throwDatabaseError(error, 'Proyek belum dapat dibuat.');
      }
    },

    async get(userId, projectId) {
      validateProjectId(projectId);
      try {
        const project = await projectRepository.findByIdForUser(projectId, userId);
        if (!project) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan.');
        return toDetail(project);
      } catch (error) {
        throwDatabaseError(error, 'Data proyek belum tersedia.');
      }
    },

    async update(userId, projectId, body) {
      validateProjectId(projectId);
      if (!body || Array.isArray(body)) {
        throw new AppError(400, 'INVALID_PROJECT_UPDATE', 'Perubahan proyek harus berupa objek JSON.');
      }
      const keys = Object.keys(body);
      const allowedKeys = ['selectedLayout', 'customVocabulary'];
      if (!keys.length || keys.some((key) => !allowedKeys.includes(key))) {
        throw new AppError(400, 'INVALID_PROJECT_UPDATE', 'Hanya layout dan kamus istilah yang dapat diperbarui.');
      }
      const data = {};
      if (Object.hasOwn(body, 'selectedLayout')) {
        data.selectedLayout = validateLayout(body.selectedLayout);
      }
      if (Object.hasOwn(body, 'customVocabulary')) {
        if (typeof body.customVocabulary !== 'string') {
          throw new AppError(400, 'INVALID_VOCABULARY', 'Kamus istilah harus berupa teks dipisahkan koma.');
        }
        data.customVocabulary = validateAndFormatVocabulary(body.customVocabulary);
      }
      try {
        const result = await projectRepository.updateSetupIfEmpty(projectId, userId, data);
        if (result.state === 'missing') {
          throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan.');
        }
        if (result.state !== 'updated') {
          throw new AppError(409, 'PROJECT_NOT_EDITABLE', 'Proyek hanya dapat diubah sebelum sumber diunggah.');
        }
        return toDetail(result.project);
      } catch (error) {
        throwDatabaseError(error, 'Perubahan proyek belum dapat disimpan.');
      }
    },

    async remove(userId, projectId) {
      validateProjectId(projectId);
      try {
        const result = await projectRepository.deleteIfEmpty(projectId, userId);
        if (result.state === 'missing') {
          throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan.');
        }
        if (result.state !== 'deleted') {
          throw new AppError(409, 'PROJECT_NOT_EMPTY', 'Hanya proyek kosong yang dapat dihapus.');
        }
      } catch (error) {
        throwDatabaseError(error, 'Proyek belum dapat dihapus.');
      }
    },
  };
}

module.exports = {
  createProjectService,
  validateAndFormatVocabulary,
  validateLayout,
  validateProjectId,
  ALLOWED_LAYOUTS,
};
