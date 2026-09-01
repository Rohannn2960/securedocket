const mongoose = require('mongoose');

const CASE_STATUS = Object.freeze({
  OPEN: 'open',
  UNDER_INVESTIGATION: 'under_investigation',
  PENDING_TRIAL: 'pending_trial',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
});

const CASE_PRIORITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

const caseSchema = new mongoose.Schema(
  {
    caseNumber: {
      type: String,
      required: [true, 'Case number / Crime reference is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Case title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
      default: '',
    },
    status: {
      type: String,
      enum: {
        values: Object.values(CASE_STATUS),
        message: 'Status {VALUE} is not a valid case status',
      },
      default: CASE_STATUS.OPEN,
      index: true,
    },
    jurisdiction: {
      type: String,
      trim: true,
      default: 'Central Cyber Police Station',
    },
    incidentDate: {
      type: Date,
      default: Date.now,
    },
    leadOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Lead investigating officer is required'],
      index: true,
    },
    assignedOfficers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    metadata: {
      tags: {
        type: [String],
        default: [],
      },
      priority: {
        type: String,
        enum: {
          values: Object.values(CASE_PRIORITY),
          message: 'Priority {VALUE} is not valid',
        },
        default: CASE_PRIORITY.MEDIUM,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high performance and role-scoped querying
caseSchema.index({ assignedOfficers: 1, status: 1 });
caseSchema.index({ status: 1, createdAt: -1 });

const Case = mongoose.model('Case', caseSchema);

module.exports = {
  Case,
  CASE_STATUS,
  CASE_PRIORITY,
};
