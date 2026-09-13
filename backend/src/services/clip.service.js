const AppError = require('../utils/app-error');
const clipModel = require('../models/clip.model');
const projectModel = require('../models/project.model');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateProjectId(projectId) {
  if (typeof projectId !== 'string' || !UUID_PATTERN.test(projectId)) {
    throw new AppError(400, 'INVALID_PROJECT_ID', 'ID proyek tidak valid.');
  }
  return projectId;
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
  };
}

module.exports = {
  createClipService,
};
