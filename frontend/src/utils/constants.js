export const ROLES = Object.freeze({
  OFFICER: 'officer',
  VERIFIER: 'verifier',
  ADMIN: 'admin',
  AUDITOR: 'auditor',
});

export const DOCUMENT_TYPES = Object.freeze({
  FIR: 'FIR',
  STATEMENT: 'statement',
  CHARGESHEET: 'chargesheet',
  EVIDENCE: 'evidence',
  FORENSIC_REPORT: 'forensic_report',
});

export const DOCUMENT_STATUS = Object.freeze({
  PENDING_OCR: 'pending_ocr',
  OCR_COMPLETED: 'ocr_completed',
  VERIFIED: 'verified',
  FLAGGED_TAMPERED: 'flagged_tampered',
  REJECTED: 'rejected',
});

export const CASE_STATUS = Object.freeze({
  OPEN: 'open',
  UNDER_INVESTIGATION: 'under_investigation',
  PENDING_TRIAL: 'pending_trial',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
});
