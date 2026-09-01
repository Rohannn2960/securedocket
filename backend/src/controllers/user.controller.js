const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, ERROR_CODES } = require('../constants/statusCodes');
const { User } = require('../models');
const { revokeAllUserSessions } = require('../services/auth.service');
const totpService = require('../services/totp.service');
const { recordAuditEntry } = require('../services/audit.service');
const { AUDIT_ACTIONS } = require('../constants/actions');

/**
 * List System Users (Admin only)
 */
async function getUsers(req, res) {
  const { role, isActive, search, page = 1, limit = 20 } = req.query;

  const query = {};
  if (role) query.role = role;
  if (isActive !== undefined) query.isActive = isActive === 'true';
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { badgeNumber: { $regex: search, $options: 'i' } },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    User.countDocuments(query),
  ]);

  return ApiResponse.success(res, {
    message: 'Users retrieved',
    data: users.map((u) => {
      delete u.passwordHash;
      delete u.totpSecret;
      return u;
    }),
    meta: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      pages: Math.ceil(total / limit),
    },
  });
}

/**
 * Get User By ID (Admin only)
 */
async function getUserById(req, res) {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  return ApiResponse.success(res, {
    data: user.toSafeObject(),
  });
}

/**
 * Create New User & Provision Initial 2FA Secret (Admin only)
 */
async function createUser(req, res) {
  const { name, email, password, role, badgeNumber, department } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw ApiError.conflict('An account with this official email already exists');
  }

  // Hash password with bcrypt (minimum 12 rounds enforced)
  const passwordHash = await User.hashPassword(password);

  // Generate initial TOTP setup credentials for user onboarding
  const { secret: totpSecret, qrCodeDataUrl } = await totpService.generateSecret(email.toLowerCase().trim());

  const newUser = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    badgeNumber,
    department,
    totpSecret,
    totpEnabled: false, // Must be activated on first login verification
    isActive: true,
  });

  await recordAuditEntry({
    userId: req.user.id,
    action: AUDIT_ACTIONS.SYSTEM_CONFIG_CHANGE,
    details: { action: 'USER_CREATED', createdUserId: newUser._id, role, email: newUser.email },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.created(res, {
    message: 'User account created with 2FA enrollment credentials',
    data: {
      user: newUser.toSafeObject(),
      totpSetup: {
        secret: totpSecret,
        qrCodeDataUrl,
      },
    },
  });
}

/**
 * Update User Role (Admin only)
 */
async function updateUserRole(req, res) {
  const { role } = req.body;
  const targetUser = await User.findById(req.params.id);

  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  const oldRole = targetUser.role;
  targetUser.role = role;
  await targetUser.save();

  // If role is modified, revoke all active sessions so the user re-authenticates with new clearance
  await revokeAllUserSessions(targetUser._id);

  await recordAuditEntry({
    userId: req.user.id,
    action: AUDIT_ACTIONS.PERMISSION_OVERRIDE,
    details: {
      targetUserId: targetUser._id,
      oldRole,
      newRole: role,
      action: 'ROLE_MODIFIED',
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: `User clearance updated from ${oldRole} to ${role}`,
    data: targetUser.toSafeObject(),
  });
}

/**
 * Update User Active / Suspended Status (Admin only)
 */
async function updateUserStatus(req, res) {
  const { isActive } = req.body;
  const targetUser = await User.findById(req.params.id);

  if (!targetUser) {
    throw ApiError.notFound('User not found');
  }

  targetUser.isActive = isActive;
  await targetUser.save();

  if (!isActive) {
    await revokeAllUserSessions(targetUser._id);
  }

  await recordAuditEntry({
    userId: req.user.id,
    action: AUDIT_ACTIONS.PERMISSION_OVERRIDE,
    details: {
      targetUserId: targetUser._id,
      isActive,
      action: isActive ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_SUSPENDED',
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return ApiResponse.success(res, {
    message: `User account has been ${isActive ? 'activated' : 'suspended'}`,
    data: targetUser.toSafeObject(),
  });
}

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUserRole,
  updateUserStatus,
};
