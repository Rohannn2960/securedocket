const mongoose = require('mongoose');
const { ALL_AUDIT_ACTIONS } = require('../constants/actions');

const auditLogSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Case',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Nullable for unauthenticated / failed security events
      index: true,
    },
    action: {
      type: String,
      enum: {
        values: ALL_AUDIT_ACTIONS,
        message: 'Action {VALUE} is not a valid audit trail action',
      },
      required: [true, 'Audit action is required'],
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    previousHash: {
      type: String,
      required: [true, 'Cryptographic chain previous hash is required'],
      match: [/^[a-f0-9]{64}$/i, 'Must be a 64-character hex hash'],
      index: true,
    },
    currentHash: {
      type: String,
      required: [true, 'Cryptographic chain current block hash is required'],
      match: [/^[a-f0-9]{64}$/i, 'Must be a 64-character hex hash'],
      unique: true,
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    isChainValid: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Audit logs are strictly immutable
  }
);

auditLogSchema.index({ documentId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
