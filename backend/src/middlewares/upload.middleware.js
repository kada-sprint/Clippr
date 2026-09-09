const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const AppError = require('../utils/app-error');

// Konfigurasi folder penyimpanan lokal temporer
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/videos');

// Pastikan folder penyimpanan uploads/videos/ tersedia saat modul diinisialisasi
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Konfigurasi penyimpanan disk Multer
const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `video-${uniqueSuffix}${ext}`);
  },
});

// Filter file: Hanya ekstensi .mp4 dan .mov, serta MIME type video yang sesuai
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.mp4', '.mov'];
  const allowedMimeTypes = ['video/mp4', 'video/quicktime'];

  if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
    return cb(new AppError(400, 'INVALID_FILE_TYPE', 'Format file tidak didukung. Hanya file .mp4 dan .mov yang diperbolehkan.'));
  }

  cb(null, true);
}

// Inisialisasi Multer dengan limit 1GB dan batas 1 file
const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB dalam satuan bytes
    files: 1, // Maksimal 1 file saja
  },
  fileFilter,
});

/**
 * Middleware wrapper untuk menangani proses upload single file 'video_file'
 * serta memetakan error bawaan Multer ke format baku AppError (HTTP 400).
 */
function createUploadMiddleware() {
  return function uploadVideoMiddleware(req, res, next) {
    const singleUpload = upload.single('video_file');

    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new AppError(400, 'FILE_TOO_LARGE', 'Ukuran file melebihi batas maksimal 1GB.'));
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return next(new AppError(400, 'UNEXPECTED_FILE', 'Field file harus berupa "video_file" dan hanya menerima 1 file.'));
          }
          return next(new AppError(400, 'UPLOAD_ERROR', `Gagal memproses file: ${err.message}`));
        }
        return next(err);
      }

      // Validasi ketersediaan file video
      if (!req.file) {
        return next(new AppError(400, 'FILE_REQUIRED', 'File video wajib diunggah dengan field "video_file".'));
      }

      next();
    });
  };
}

/**
 * Helper untuk menghapus file fisik di disk jika terjadi kegagalan validasi lanjutan/database
 */
async function removeUploadedFile(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // Abaikan jika file memang belum ada atau sudah terhapus
  }
}

module.exports = {
  createUploadMiddleware,
  removeUploadedFile,
  UPLOAD_DIR,
};
