const AppError = require('../utils/app-error');
const uploadModel = require('../models/upload.model');
const { extractAudio: defaultExtractAudio } = require('../utils/ffmpeg');
const { transcribeAudio: defaultTranscribeAudio } = require('./stt.service');
const { removeUploadedFile: defaultRemoveFile } = require('../middlewares/upload.middleware');
const { validateAndFormatVocabulary, validateLayout, validateProjectId } = require('./project.service');

function toPublicProject(project) {
  return {
    id: project.id,
    status: project.status,
    processingStage: project.processingStage,
    selectedLayout: project.selectedLayout,
    customVocabulary: project.customVocabulary,
    hasSource: Boolean(project.sourceVideoPath),
    clipCount: project._count?.clips ?? 0,
    lastEditActivityAt: project.lastEditActivityAt,
    sourceExpiresAt: project.sourceExpiresAt,
    createdAt: project.createdAt,
  };
}

function createUploadService({
  repository = uploadModel,
  extractAudio = defaultExtractAudio,
  transcribeAudio = defaultTranscribeAudio,
  removeFile = defaultRemoveFile,
} = {}) {
  return {
    async uploadSource({ projectId, userId, file, selectedLayout, customVocabulary }) {
      validateProjectId(projectId);
      let audioPath = null;
      let sourceAttached = false;
      let processingStage = 'ingest';
      try {
        if (!file?.path) {
          throw new AppError(400, 'FILE_REQUIRED', 'File video wajib diunggah.');
        }
        const target = await repository.findUploadTarget(projectId, userId);
        if (!target) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan.');

        const layout = validateLayout(selectedLayout);
        const vocabulary = validateAndFormatVocabulary(customVocabulary);
        const sourceVideoPath = file.path.replaceAll('\\', '/');
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

        audioPath = await extractAudio(file.path);
        processingStage = 'transcribe';
        await repository.markTranscribing(projectId, userId);
        const transcriptJson = await transcribeAudio(audioPath, vocabulary);
        const transcribed = await repository.saveTranscript(projectId, userId, transcriptJson);
        return toPublicProject(transcribed);
      } catch (error) {
        if (sourceAttached) {
          try {
            await repository.markFailed(projectId, userId, processingStage);
          } catch {
            // Preserve the original processing failure.
          }
        } else if (file?.path) {
          await removeFile(file.path);
        }
        throw error;
      } finally {
        if (audioPath) await removeFile(audioPath);
      }
    },
  };
}

module.exports = { createUploadService };
