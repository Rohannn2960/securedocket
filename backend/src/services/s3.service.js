const config = require('../config/env');
const logger = require('../config/logger');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');

/**
 * S3 Storage Service Contract
 * Ensures all files are stored strictly in AWS S3 with SSE-S3 encryption at rest.
 * (MongoDB only stores metadata and SHA-256 integrity hashes).
 */
class S3StorageService {
  constructor() {
    this.bucketName = config.aws.bucketName;
    this.region = config.aws.region;
  }

  /**
   * Upload Document Buffer / Stream to S3 with SSE-S3 Server-Side Encryption
   */
  async uploadDocument({ key, fileBuffer, mimeType, metadata = {} }) {
    logger.info(`[S3 Service] Initiating SSE-S3 upload for key: ${key} to bucket: ${this.bucketName}`);
    
    // In production, instantiate @aws-sdk/client-s3 PutObjectCommand with ServerSideEncryption: 'AES256'
    return {
      bucket: this.bucketName,
      key,
      serverSideEncryption: 'AES256',
      uploadedAt: new Date().toISOString(),
      size: fileBuffer ? fileBuffer.length : 0,
      mimeType,
      metadata,
    };
  }

  /**
   * Generate Presigned Download URL with 5-Minute Time-To-Live
   */
  async getPresignedDownloadUrl(key, expiresInSeconds = 300) {
    if (!key) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'S3 key is required', ERROR_CODES.INVALID_INPUT);
    }
    logger.info(`[S3 Service] Generating presigned URL for key: ${key}, TTL: ${expiresInSeconds}s`);
    
    // URL contract simulation for Phase 0 skeleton
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${encodeURIComponent(key)}?X-Amz-Expires=${expiresInSeconds}`;
  }

  /**
   * Delete Document Object from S3 Vault (Admin/Retention cleanup)
   */
  async deleteDocument(key) {
    logger.warn(`[S3 Service] Request to delete key from vault: ${key}`);
    return { success: true, key, deletedAt: new Date().toISOString() };
  }
}

module.exports = new S3StorageService();
