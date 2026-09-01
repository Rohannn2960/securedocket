const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const caseRoutes = require('./case.routes');
const documentRoutes = require('./document.routes');
const auditRoutes = require('./audit.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/cases', caseRoutes);
router.use('/documents', documentRoutes);
router.use('/audit', auditRoutes);

module.exports = router;
