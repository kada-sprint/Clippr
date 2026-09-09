const { getPrisma } = require('../config/prisma');

/**
 * Menyimpan data proyek baru ke database PostgreSQL via Prisma
 * @param {Object} params
 * @param {string} params.userId - ID pengguna pemilik proyek
 * @param {string} params.sourceVideoPath - Path lokasi penyimpanan file video sumber
 * @param {string} params.selectedLayout - Pilihan layout video ('SLIDE_CAM' | 'TALKING_HEAD' | 'SLIDE_ONLY')
 * @param {string} [params.customVocabulary] - Daftar istilah kustom yang telah dinormalisasi
 * @param {string} [params.status='INGESTED'] - Status awal proyek
 * @returns {Promise<Object>} Data proyek yang baru dibuat
 */
async function createProject({
  userId,
  sourceVideoPath,
  selectedLayout,
  customVocabulary = '',
  status = 'INGESTED',
}) {
  const prisma = getPrisma();
  const now = new Date();
  // Sesuai FRD Bab 4: Video sumber kedaluwarsa 24 jam setelah upload berhasil
  const sourceExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  return prisma.project.create({
    data: {
      userId,
      sourceVideoPath,
      selectedLayout,
      customVocabulary,
      status,
      processingStage: 'ingest',
      lastEditActivityAt: now,
      sourceExpiresAt,
    },
    select: {
      id: true,
      userId: true,
      sourceVideoPath: true,
      selectedLayout: true,
      customVocabulary: true,
      status: true,
      processingStage: true,
      lastEditActivityAt: true,
      sourceExpiresAt: true,
      createdAt: true,
    },
  });
}

/**
 * Memperbarui status proyek dan menyimpan path audio hasil ekstraksi
 * @param {Object} params
 * @param {string} params.id - UUID proyek
 * @param {string} params.audioPath - Path file audio yang berhasil diekstrak
 * @param {string} [params.status='AUDIO_EXTRACTED'] - Status baru proyek
 */
async function updateProjectAudio({ id, audioPath, status = 'AUDIO_EXTRACTED' }) {
  const prisma = getPrisma();
  return prisma.project.update({
    where: { id },
    data: {
      status,
      processingStage: 'audio_extracted',
      transcriptJson: { audioPath },
      lastEditActivityAt: new Date(),
    },
    select: {
      id: true,
      userId: true,
      sourceVideoPath: true,
      selectedLayout: true,
      customVocabulary: true,
      status: true,
      processingStage: true,
      transcriptJson: true,
      lastEditActivityAt: true,
      sourceExpiresAt: true,
      createdAt: true,
    },
  });
}

/**
 * Mencari proyek berdasarkan ID
 * @param {string} id - UUID proyek
 */
async function findProjectById(id) {
  return getPrisma().project.findUnique({
    where: { id },
  });
}

/**
 * Memeriksa apakah pengguna tertentu ada di tabel users
 * @param {string} userId - ID Pengguna
 */
async function findUserById(userId) {
  return getPrisma().user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  });
}

module.exports = {
  createProject,
  updateProjectAudio,
  findProjectById,
  findUserById,
};
