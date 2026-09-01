const path = require('path');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('./apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.tiff',
  '.tif',
  '.webp',
  '.docx',
  '.doc',
  '.txt',
]);

const EXTENSION_MIME_MAP = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.tiff': ['image/tiff'],
  '.tif': ['image/tiff'],
  '.webp': ['image/webp'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  '.doc': ['application/msword'],
  '.txt': ['text/plain'],
};

/**
 * Inspect buffer header magic bytes to determine true binary file type
 */
function detectMagicNumber(buffer) {
  if (!buffer || buffer.length < 4) {
    return 'unknown';
  }

  // Executable Detection (Security Guard)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return 'executable_exe'; // DOS / PE Windows Executable
  }
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return 'executable_elf'; // Linux ELF Executable
  }

  // PDF: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }

  // JPEG: \xFF\xD8\xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: \x89PNG\r\n\x1a\n (0x89 0x50 0x4E 0x47)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }

  // TIFF: II*\x00 (0x49 0x49 0x2A 0x00) or MM\x00* (0x4D 0x4D 0x00 0x2A)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return 'tiff';
  }

  // WebP: RIFF at 0, WEBP at 8
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }

  // DOCX / ZIP: PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'docx';
  }

  // DOC (Old MS Word OLE CFB): \xD0\xCF\x11\xE0
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
    return 'doc';
  }

  // Plain Text: Check for absence of null bytes in first 512 bytes
  let isText = true;
  const sampleLength = Math.min(buffer.length, 512);
  for (let i = 0; i < sampleLength; i++) {
    if (buffer[i] === 0x00) {
      isText = false;
      break;
    }
  }
  if (isText) {
    return 'txt';
  }

  return 'unknown';
}

/**
 * Sanitize filename to prevent directory traversal and special character injection
 */
function sanitizeFilename(originalName) {
  if (!originalName || typeof originalName !== 'string') {
    return `document_${Date.now()}.pdf`;
  }

  // Extract base and ext
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext);

  // Replace all non-alphanumeric characters with underscores
  const cleanBase = base
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 80);

  return `${cleanBase || 'doc'}${ext}`;
}

/**
 * Generate a server-controlled, deterministic S3 key
 * Never uses raw client input directly
 */
function generateServerS3Key(caseNumber, sanitizedFilename) {
  const cleanCaseNum = caseNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const uniqueId = uuidv4();
  return `cases/${cleanCaseNum}/${uniqueId}-${sanitizedFilename}`;
}

/**
 * Complete security validation pipeline for uploaded file
 */
function validateUploadedFile(file) {
  if (!file || !file.buffer) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'No file uploaded or file buffer is empty', ERROR_CODES.INVALID_INPUT);
  }

  // 1. File Size Check
  if (file.size > MAX_FILE_SIZE_BYTES || file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 25 MB`,
      ERROR_CODES.FILE_TOO_LARGE
    );
  }

  if (file.buffer.length === 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Empty file byte stream rejected', ERROR_CODES.INVALID_INPUT);
  }

  // 2. Extension Whitelist Check
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `File extension '${ext}' is not permitted. Supported formats: PDF, PNG, JPG, TIFF, WebP, DOCX, TXT`,
      ERROR_CODES.INVALID_INPUT
    );
  }

  // 3. Binary Magic Number / Signature Verification
  const detectedType = detectMagicNumber(file.buffer);

  if (detectedType === 'executable_exe' || detectedType === 'executable_elf') {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'SECURITY ALERT: Executable binary detected. Upload rejected.',
      ERROR_CODES.INVALID_INPUT
    );
  }

  // Map extension to expected detected type
  const extToExpectedType = {
    '.pdf': 'pdf',
    '.jpg': 'jpeg',
    '.jpeg': 'jpeg',
    '.png': 'png',
    '.tiff': 'tiff',
    '.tif': 'tiff',
    '.webp': 'webp',
    '.docx': 'docx',
    '.doc': 'doc',
    '.txt': 'txt',
  };

  const expectedType = extToExpectedType[ext];
  if (expectedType && detectedType !== expectedType) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      `Binary signature mismatch: Claimed extension '${ext}' does not match detected file signature '${detectedType}'. File may be corrupted or disguised.`,
      ERROR_CODES.INVALID_INPUT
    );
  }

  // 4. Resolve Canonical MIME Type (Never blindly trust client MIME)
  const canonicalMime = EXTENSION_MIME_MAP[ext] ? EXTENSION_MIME_MAP[ext][0] : 'application/octet-stream';
  const sanitizedName = sanitizeFilename(file.originalname);

  return {
    sanitizedName,
    originalName: file.originalname,
    mimeType: canonicalMime,
    fileSize: file.buffer.length,
    extension: ext,
    detectedType,
  };
}

module.exports = {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_EXTENSIONS,
  detectMagicNumber,
  sanitizeFilename,
  generateServerS3Key,
  validateUploadedFile,
};
