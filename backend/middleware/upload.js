const fs = require("fs");
const path = require("path");
const multer = require("multer");

const moviesDirectory = path.join(__dirname, "..", "movies");
const thumbnailsDirectory = path.join(__dirname, "..", "thumbnails");

fs.mkdirSync(moviesDirectory, { recursive: true });
fs.mkdirSync(thumbnailsDirectory, { recursive: true });

function sanitizeBaseName(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.fieldname === "movie") {
      cb(null, moviesDirectory);
      return;
    }

    if (file.fieldname === "thumbnail") {
      cb(null, thumbnailsDirectory);
      return;
    }

    cb(new Error("Unexpected upload field."));
  },
  filename(req, file, cb) {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeBaseName = sanitizeBaseName(file.originalname) || file.fieldname;
    cb(null, `${Date.now()}-${safeBaseName}${extension}`);
  }
});

function fileFilter(req, file, cb) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "movie") {
    if (extension !== ".mp4") {
      cb(new Error("Movie uploads must be .mp4 files."));
      return;
    }

    cb(null, true);
    return;
  }

  if (file.fieldname === "thumbnail") {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Thumbnail uploads must be image files."));
      return;
    }

    cb(null, true);
    return;
  }

  cb(new Error("Unexpected upload field."));
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 2,
    fileSize: 500 * 1024 * 1024
  }
});

const adminUploadFields = upload.fields([
  { name: "movie", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 }
]);

const adminEditFields = upload.fields([{ name: "thumbnail", maxCount: 1 }]);

module.exports = {
  adminUploadFields,
  adminEditFields,
  moviesDirectory,
  thumbnailsDirectory
};
