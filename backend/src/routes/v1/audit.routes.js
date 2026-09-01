const express = require('express');
const { getAuditLogs, verifyAuditChain } = require('../../controllers/audit.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizeRoles } = require('../../middleware/rbac.middleware');
const { ROLES } = require('../../constants/roles');
const asyncWrapper = require('../../utils/asyncWrapper');

const router = express.Router();

router.use(authenticate);

// GET /api/v1/audit (Auditor and Admin full trail access)
router.get(
  '/',
  authorizeRoles(ROLES.AUDITOR, ROLES.ADMIN, ROLES.OFFICER),
  asyncWrapper(getAuditLogs)
);

// GET /api/v1/audit/verify-chain (Cryptographic chain verification)
router.get(
  '/verify-chain',
  authorizeRoles(ROLES.AUDITOR, ROLES.ADMIN),
  asyncWrapper(verifyAuditChain)
);

module.exports = router;
