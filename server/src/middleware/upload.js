const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const AppError = require('../utils/AppError');

const createUpload = (subDirName) => {
  const dirPath = path.join(__dirname, `../../uploads/${subDirName}`);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, dirPath);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const randomName = crypto.randomBytes(16).toString('hex');
      cb(null, `${randomName}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (
      (file.mimetype && file.mimetype.startsWith('image/')) ||
      allowedMimes.includes(file.mimetype) ||
      allowedExts.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          400,
          'INVALID_FILE_TYPE',
          'Only JPEG, PNG, and WebP images under 5MB are allowed',
        ),
        false,
      );
    }
  };

  return multer({
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
    },
    fileFilter,
  });
};

const uploadProduct = createUpload('products');
const uploadStore = createUpload('stores');

// Default export is uploadProduct for backward compatibility
const upload = uploadProduct;
upload.product = uploadProduct;
upload.store = uploadStore;

module.exports = upload;
module.exports.uploadProduct = uploadProduct;
module.exports.uploadStore = uploadStore;
