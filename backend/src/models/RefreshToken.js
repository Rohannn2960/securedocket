const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    replacedByTokenHash: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: '0s' }, // MongoDB TTL index to automatically purge expired tokens
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    ipAddress: {
      type: String,
      default: 'unknown',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

refreshTokenSchema.index({ userId: 1, familyId: 1, isRevoked: 1 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
