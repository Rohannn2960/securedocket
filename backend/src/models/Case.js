const mongoose = require('mongoose');

const CASE_STATUS = Object.freeze({
  OPEN: 'open',
  UNDER_INVESTIGATION: 'under_investigation',
  PENDING_TRIAL: 'pending_trial',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
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
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    status: {
      type: String,
      enum: Object.values(CASE_STATUS),
      default: CASE_STATUS.OPEN,
      index: true,
    },
    jurisdiction: {
      type: String,
      trim: true,
    },
    incidentDate: {
      type: Date,
    },
    leadOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    assignedOfficers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    metadata: {
      tags: [String],
      priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
      },
    },
  },
  {
    timestamps: true,
  }
);

caseSchema.index({ status: 1, createdAt: -1 });

const Case = mongoose.model('Case', caseSchema);

module.exports = {
  Case,
  CASE_STATUS,
};
