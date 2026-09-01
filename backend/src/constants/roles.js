/**
 * RBAC System Roles
 * Strictly enforces access boundaries for law enforcement and legal audit workflows.
 */
const ROLES = Object.freeze({
  OFFICER: 'officer',     // Can create cases, upload documents, view assigned cases
  VERIFIER: 'verifier',   // Can verify OCR extractions, approve document hashes, flag anomalies
  ADMIN: 'admin',         // Can manage user accounts, assign roles, manage system settings
  AUDITOR: 'auditor',     // Read-only access to audit logs, cryptographic chains, compliance reports
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

module.exports = {
  ROLES,
  ALL_ROLES,
};
