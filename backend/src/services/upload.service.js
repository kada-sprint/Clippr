const path = require('node:path');
const crypto = require('node:crypto');
const AppError = require('../utils/app-error');
const uploadModel = require('../models/upload.model');
const projectModel = require('../models/project.model');
const { createObjectStorage } = require('./object-storage.service');
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
  projectRepository = projectModel,
  validateVideo = defaultValidateVideo,
  removeFile = defaultRemoveFile,
  objectStorage,
  objectStorageFactory = createObjectStorage,
} = {}) {
  function storage() {
    if (!objectStorage) objectStorage = objectStorageFactory();
    return objectStorage;
  }

  return {
    async initiate({ userId, body }) {
      if (!body || Array.isArray(body)) {
        throw new AppError(400, 'INVALID_UPLOAD_INITIATE', 'Data upload harus berupa objek JSON.');
      }
      const allowedKeys = ['file_name', 'file_size', 'mime_type', 'selected_layout', 'custom_vocabulary'];
      if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
        throw new AppError(400, 'INVALID_UPLOAD_INITIATE', 'Data upload berisi field yang tidak didukung.');
      }
      const extension = typeof body.file_name === 'string' ? path.extname(body.file_name).toLowerCase() : '';
      const expectedMime = { '.mp4': 'video/mp4', '.mov': 'video/quicktime' }[extension];
      if (!expectedMime || body.mime_type !== expectedMime) {
        throw new AppError(400, 'INVALID_FILE_TYPE', 'Format file tidak didukung. Hanya file .mp4 dan .mov yang diperbolehkan.');
      }
      if (!Number.isSafeInteger(body.file_size) || body.file_size < 1 || body.file_size > 1024 * 1024 * 1024) {
        throw new AppError(400, 'INVALID_FILE_SIZE', 'Ukuran file harus berada antara 1 byte dan 1GB.');
      }
      const selectedLayout = validateLayout(body.selected_layout);
      const customVocabulary = validateAndFormatVocabulary(body.custom_vocabulary);
      let project;
      try {
        project = await projectRepository.createForUser(userId);
        const setup = await projectRepository.updateSetupIfEmpty(project.id, userId, {
          selectedLayout,
          customVocabulary,
        });
        if (setup.state !== 'updated') throw new Error('Project setup failed');
        project = setup.project;
        const objectKey = `sources/${project.id}/${crypto.randomUUID()}${extension}`;
        const signed = await storage().createUploadUrl({ key: objectKey, contentType: expectedMime });
        return {
          project: toPublicProject(project),
          upload: {
            objectKey,
            url: signed.url,
            headers: signed.headers,
            expiresIn: 900,
          },
        };
      } catch (error) {
        if (project?.id && typeof projectRepository.deleteEmpty === 'function') {
          await projectRepository.deleteEmpty(project.id, userId).catch(() => {});
        }
        if (error instanceof AppError) throw error;
        throw new AppError(503, 'UPLOAD_STORAGE_UNAVAILABLE', 'Penyimpanan upload belum tersedia. Coba lagi.');
      }
    },

    async complete({ projectId, userId, body }) {
      validateProjectId(projectId);
      if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.object_key !== 'string') {
        throw new AppError(400, 'INVALID_UPLOAD_COMPLETE', 'Object key upload wajib tersedia.');
      }
      const objectKey = body.object_key;
      if (!objectKey.startsWith(`sources/${projectId}/`)) {
        throw new AppError(400, 'INVALID_UPLOAD_KEY', 'Object key upload tidak sesuai dengan proyek.');
      }
      const target = await repository.findUploadTarget(projectId, userId);
      if (!target) throw new AppError(404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan.');
      if (target.sourceVideoPath === objectKey) return toPublicProject(target);
      if (target.sourceVideoPath || target.status !== 'idle' || target.processingStage !== null) {
        throw new AppError(409, 'PROJECT_NOT_UPLOADABLE', 'Sumber hanya dapat ditambahkan pada proyek yang tidak sedang diproses.');
      }
      const extension = path.extname(objectKey).toLowerCase();
      const expectedMime = { '.mp4': 'video/mp4', '.mov': 'video/quicktime' }[extension];
      if (!expectedMime) throw new AppError(400, 'INVALID_FILE_TYPE', 'Format object upload tidak didukung.');
      let metadata;
      try {
        metadata = await storage().head(objectKey);
      } catch {
        throw new AppError(400, 'UPLOAD_NOT_FOUND', 'Upload belum tersedia atau belum selesai.');
      }
      if (!Number.isSafeInteger(metadata.contentLength) || metadata.contentLength < 1 ||
          metadata.contentLength > 1024 * 1024 * 1024 || metadata.contentType !== expectedMime) {
        throw new AppError(400, 'INVALID_UPLOADED_OBJECT', 'Ukuran atau tipe object upload tidak valid.');
      }
      const project = await repository.attachSource({
        id: projectId,
        userId,
        sourceVideoPath: objectKey,
        selectedLayout: target.selectedLayout,
        customVocabulary: target.customVocabulary,
      });
      if (!project) {
        const current = await repository.findUploadTarget(projectId, userId);
        if (current?.sourceVideoPath === objectKey) return toPublicProject(current);
        throw new AppError(409, 'PROJECT_NOT_UPLOADABLE', 'Sumber hanya dapat ditambahkan pada proyek yang tidak sedang diproses.');
      }
      return toPublicProject(project);
    },

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
      const project = await projectRepository.createForUser(userId);
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
