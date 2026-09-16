const path = require('node:path');
const AppError = require('../utils/app-error');
const uploadModel = require('../models/upload.model');
const { validateVideo: defaultValidateVideo } = require('../utils/ffmpeg');
const { removeUploadedFile: defaultRemoveFile } = require('../middlewares/upload.middleware');
const { validateAndFormatVocabulary, validateLayout, validateProjectId } = require('./project.service');
const env = require('../config/env');

function toPublicProject(project) {
  return {
    id: project.id,
    status: project.status,
    processingStage: project.processingStage,
    selectedLayout: project.selectedLayout,
    customVocabulary: project.customVocabulary,
    hasSource: Boolean(project.sourceVideoPath),
    clipCount: project._count?.clips ?? 0,
    transcriptJson: project.transcriptJson,
    lastEditActivityAt: project.lastEditActivityAt,
    sourceExpiresAt: project.sourceExpiresAt,
    createdAt: project.createdAt,
  };
}

function createUploadService({
  repository = uploadModel,
  validateVideo = defaultValidateVideo,
  removeFile = defaultRemoveFile,
} = {}) {
  return {
    async uploadSource({ projectId, userId, file, selectedLayout, customVocabulary }) {
      let sourceAttached = false;
      try {
        validateProjectId(projectId);
        if (!file?.path) {
          throw new AppError(400, 'FILE_REQUIRED', 'File video wajib diunggah.');
        }
        const target = await repository.findUploadTarget(projectId, userId);
        if (!target) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan.');

        const layout = validateLayout(selectedLayout);
        const vocabulary = validateAndFormatVocabulary(customVocabulary);
        await validateVideo(file.path);
        const sourceVideoPath = path.relative(env.mediaRoot, file.path).replaceAll('\\', '/');
        const project = await repository.attachSource({
          id: projectId,
          userId,
          sourceVideoPath,
          selectedLayout: layout,
          customVocabulary: vocabulary,
        });
        if (!project) {
          throw new AppError(409, 'PROJECT_NOT_UPLOADABLE', 'Sumber hanya dapat ditambahkan pada proyek yang tidak sedang diproses.');
        }
        sourceAttached = true;

        return toPublicProject(project);
      } catch (error) {
        if (!sourceAttached && file?.path) await removeFile(file.path);
        throw error;
      }
    },

    async directUpload({ userId, file, selectedLayout, customVocabulary }) {
      const projectModel = require('../models/project.model');
      const project = await projectModel.createForUser(userId);
      return this.uploadSource({
        projectId: project.id,
        userId,
        file,
        selectedLayout,
        customVocabulary,
      });
    },
  };
}

module.exports = { createUploadService };
