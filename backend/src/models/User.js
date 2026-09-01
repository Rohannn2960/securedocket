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
      select: false, // TOTP seed secret strictly hidden from queries
    },
    totpEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    totpVerifiedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    badgeNumber: {
      type: String,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
    },
    lastLoginAt: {
      type: Date,
    },
    lastLoginIp: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Method to verify password against bcrypt hash
userSchema.methods.comparePassword = async function (plainPassword) {
  if (!this.passwordHash) {
    throw new Error('passwordHash field must be selected to compare password');
  }
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Static helper to hash password with configured salt rounds (>= 12)
userSchema.statics.hashPassword = async function (plainPassword) {
  const saltRounds = Math.max(config.bcryptSaltRounds, 12);
  return bcrypt.hash(plainPassword, saltRounds);
};

// Return safe user object stripped of sensitive auth credentials
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.totpSecret;
  delete obj.__v;
  return obj;
};

// Ensure JSON.stringify serialization also removes sensitive fields automatically
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.totpSecret;
    delete ret.__v;
    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
