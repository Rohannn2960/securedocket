/**
 * Supported Legal & Investigation Document Types (Categories)
 */
const DOCUMENT_TYPES = Object.freeze({
  FIR: 'FIR',                         // First Information Report
  STATEMENT: 'statement',             // Witness or Accused Statement (Sec 161/164 CrPC)
  CHARGESHEET: 'chargesheet',         // Final Police Report / Charge Sheet
  EVIDENCE: 'evidence',               // Seizure memos, panchnama, material evidence logs
  FORENSIC_REPORT: 'forensic_report', // Ballistics, toxicology, DNA, digital forensics
});

const ALL_DOCUMENT_TYPES = Object.freeze(Object.values(DOCUMENT_TYPES));

const DOCUMENT_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',   // Initial ingestion status
  PENDING_OCR: 'pending_ocr',         // Awaiting OCR pipeline
  OCR_COMPLETED: 'ocr_completed',     // OCR extracted
  VERIFIED: 'verified',               // Forensic / Verifier clearance
  FLAGGED_TAMPERED: 'flagged_tampered', // Integrity hash mismatch / tampering detected
  REJECTED: 'rejected',               // Rejected evidence
});

const ALL_DOCUMENT_STATUSES = Object.freeze(Object.values(DOCUMENT_STATUS));

module.exports = {
  DOCUMENT_TYPES,
  ALL_DOCUMENT_TYPES,
  DOCUMENT_STATUS,
  ALL_DOCUMENT_STATUSES,
};
