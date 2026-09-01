const multer = require('multer');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const { MAX_FILE_SIZE_BYTES } = require('../utils/fileValidator');

// In-Memory Storage: Never persist raw unvalidated files to local disk
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES, // 25 MB max
    files: 1, // Single file upload per request
  },
});

/**
 * Express middleware wrapper to catch Multer-specific errors cleanly
 */
function handleSingleUpload(fieldName = 'file') {
  const uploadSingle = upload.single(fieldName);

  return (req, res, next) => {
    uploadSingle(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(
            new ApiError(
              HTTP_STATUS.BAD_REQUEST,
              `Uploaded file exceeds maximum limit of 25 MB`,
              ERROR_CODES.FILE_TOO_LARGE
            )
          );
        }
        return next(
          new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            `Upload error: ${err.message}`,
            ERROR_CODES.INVALID_INPUT
          )
        );
      } else if (err) {
        return next(err);
      }

      if (!req.file) {
        return next(
          new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'No file received in multipart/form-data payload under field "file"',
            ERROR_CODES.INVALID_INPUT
          )
        );
      }

      next();
    });
  };
}

module.exports = {
  upload,
  handleSingleUpload,
};
