const AppError = require('../utils/app-error');
const { createProject: defaultCreateProject, findUserById: defaultFindUserById } = require('../models/project.model');
const { removeUploadedFile } = require('../middlewares/upload.middleware');

const ALLOWED_LAYOUTS = Object.freeze(['SLIDE_CAM', 'TALKING_HEAD', 'SLIDE_ONLY']);

/**
 * Memvalidasi dan menormalisasi custom vocabulary (string koma, maks 20 kata)
 * @param {string} [rawVocabulary]
 * @returns {string} String istilah yang sudah dibersihkan
 */
function validateAndFormatVocabulary(rawVocabulary) {
  if (!rawVocabulary || typeof rawVocabulary !== 'string') {
    return '';
  }

  const terms = rawVocabulary
    .split(',')
    .map((term) => term.trim())
    .filter((term) => term.length > 0);

  if (terms.length > 20) {
    throw new AppError(400, 'VOCABULARY_LIMIT_EXCEEDED', 'custom_vocabulary maksimal 20 kata.');
  }

  return terms.join(', ');
}

/**
 * Memvalidasi pilihan layout video
 * @param {string} layout
 */
function validateLayout(layout) {
  if (!layout || typeof layout !== 'string' || !ALLOWED_LAYOUTS.includes(layout)) {
    throw new AppError(
      400,
      'INVALID_LAYOUT',
      `selected_layout tidak valid. Pilihan yang didukung: ${ALLOWED_LAYOUTS.join(', ')}.`
    );
  }
  return layout;
}

/**
 * Factory function untuk membuat instance Project Service (mendukung dependency injection untuk unit testing)
 */
function createProjectService({
  createProject = defaultCreateProject,
  findUserById = defaultFindUserById,
} = {}) {
  return {
    async handleVideoUpload({ file, selectedLayout, customVocabulary, userId }) {
      // Jika terjadi error selama validasi atau penyimpanan data, file harus dihapus dari disk
      try {
        if (!file || !file.path) {
          throw new AppError(400, 'FILE_REQUIRED', 'File video wajib diunggah.');
        }

        // 1. Validasi layout
        const validatedLayout = validateLayout(selectedLayout);

        // 2. Validasi custom vocabulary (maks 20 kata)
        const formattedVocabulary = validateAndFormatVocabulary(customVocabulary);

        // 3. Validasi identitas pengguna
        if (!userId || typeof userId !== 'string' || !userId.trim()) {
          throw new AppError(401, 'UNAUTHENTICATED', 'Identitas pengguna diperlukan untuk membuat proyek.');
        }

        // 4. Pastikan pengguna terdaftar di database
        const user = await findUserById(userId);
        if (!user) {
          throw new AppError(404, 'USER_NOT_FOUND', 'Pengguna pemilik proyek tidak ditemukan di sistem.');
        }

        // 5. Simpan record proyek ke database dengan status awal 'INGESTED'
        // Path dinormalisasi agar konsisten di semua sistem operasi
        const normalizedVideoPath = file.path.replaceAll('\\', '/');

        const project = await createProject({
          userId: user.id,
          sourceVideoPath: normalizedVideoPath,
          selectedLayout: validatedLayout,
          customVocabulary: formattedVocabulary,
          status: 'INGESTED',
        });

        return project;
      } catch (error) {
        // Hapus file fisik temporer jika terjadi kegagalan agar tidak meninggalkan file sampah di disk
        if (file?.path) {
          await removeUploadedFile(file.path);
        }
        throw error;
      }
    },
  };
}

module.exports = {
  createProjectService,
  validateAndFormatVocabulary,
  validateLayout,
  ALLOWED_LAYOUTS,
};
