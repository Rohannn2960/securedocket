const express = require('express');
const {
  getUsers,
  getUserById,
  createUser,
  updateUserRole,
  updateUserStatus,
} = require('../../controllers/user.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../constants/roles');
const {
  validateCreateUser,
  validateUpdateRole,
  validateUpdateStatus,
} = require('../../middleware/validators/user.validator');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

// Strict RBAC: All user management endpoints require ADMIN role clearance
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/', asyncWrapper(getUsers));
router.get('/:id', asyncWrapper(getUserById));
router.post('/', validateCreateUser, asyncWrapper(createUser));
router.patch('/:id/role', validateUpdateRole, asyncWrapper(updateUserRole));
router.patch('/:id/status', validateUpdateStatus, asyncWrapper(updateUserStatus));

module.exports = router;
