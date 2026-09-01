const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ALL_ROLES, ROLES } = require('../constants/roles');
const config = require('../config/env');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Official email address is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid official email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never return password hash in queries by default
    },
    role: {
      type: String,
      enum: {
        values: ALL_ROLES,
        message: 'Role {VALUE} is not a valid system role',
      },
      default: ROLES.OFFICER,
      index: true,
    },
    totpSecret: {
      type: String,
      select: false, // TOTP seed secret hidden from general queries
    },
    totpEnabled: {
      type: Boolean,
      default: false,
    },
    refreshTokenHash: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    badgeNumber: {
      type: String,
      trim: true,
    },
    department: {
      type: String,
      trim: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Method to verify password against bcrypt hash
userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Static helper to hash password with configured salt rounds
userSchema.statics.hashPassword = async function (plainPassword) {
  return bcrypt.hash(plainPassword, config.bcryptSaltRounds);
};

// Return safe user object stripped of sensitive auth credentials
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.totpSecret;
  delete obj.refreshTokenHash;
  return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
