process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/database');
const { User, Case, Document, RefreshToken, CASE_STATUS, DOCUMENT_STATUS, DOCUMENT_TYPES } = require('../models');
const { ROLES } = require('../constants/roles');
const totpService = require('../services/totp.service');
const aiOcrService = require('../services/aiOcr.service');
const extractionService = require('../services/extraction.service');
const s3Service = require('../services/s3.service');
const { calculateSha256 } = require('../utils/crypto');

const VERIFIER_USER = {
  name: 'Forensic Verifier Roy',
  email: 'verifier.phase4@forensics.gov.in',
  password: 'VerifierSecurePass123!',
  role: ROLES.VERIFIER,
  badgeNumber: 'CFSL-9901',
  department: 'Central Forensic Science Laboratory',
  totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
};

const OFFICER_USER = {
  name: 'Inspector Vikram Singh',
  email: 'officer.phase4@police.gov.in',
  password: 'OfficerSecurePass123!',
  role: ROLES.OFFICER,
  badgeNumber: 'CCB-9842',
  department: 'Cyber Crime Police Station',
  totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
};

const AUDITOR_USER = {
  name: 'Judicial Auditor Sen',
  email: 'auditor.phase4@judiciary.gov.in',
  password: 'AuditorSecurePass123!',
  role: ROLES.AUDITOR,
  badgeNumber: 'AUD-5521',
  department: 'Judicial Oversight Directorate',
  totpSecret: 'NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP',
};

let verifierDoc, officerDoc, auditorDoc;
let verifierCookies, officerCookies, auditorCookies;
let testCase;
let testDoc;

async function authenticateUser(credentials) {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: credentials.email, password: credentials.password });

  const totp = totpService.generateCode(credentials.totpSecret);
  const verifyRes = await request(app)
    .post('/api/v1/auth/verify-2fa')
    .send({ tempToken: loginRes.body.data.tempToken, totpCode: totp });

  return verifyRes.headers['set-cookie'];
}

async function runOcrExtractionTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 4: AI OCR & HUMAN VERIFICATION SUITE');
  console.log('======================================================\n');

  await connectDB();

  // Reset test accounts
  await User.deleteMany({
    email: { $in: [VERIFIER_USER.email, OFFICER_USER.email, AUDITOR_USER.email] },
  });
  await Case.deleteMany({ caseNumber: 'CR/2026/0401-TEST' });
  await Document.deleteMany({ fileName: /TEST_PHASE4/ });

  const [hVerif, hOff, hAudit] = await Promise.all([
    User.hashPassword(VERIFIER_USER.password),
    User.hashPassword(OFFICER_USER.password),
    User.hashPassword(AUDITOR_USER.password),
  ]);

  verifierDoc = await User.create({ ...VERIFIER_USER, passwordHash: hVerif, totpEnabled: true });
  officerDoc = await User.create({ ...OFFICER_USER, passwordHash: hOff, totpEnabled: true });
  auditorDoc = await User.create({ ...AUDITOR_USER, passwordHash: hAudit, totpEnabled: true });

  verifierCookies = await authenticateUser(VERIFIER_USER);
  officerCookies = await authenticateUser(OFFICER_USER);
  auditorCookies = await authenticateUser(AUDITOR_USER);

  testCase = await Case.create({
    caseNumber: 'CR/2026/0401-TEST',
    title: 'Phase 4 Document Intelligence Test Case',
    description: 'Automated test suite execution for SIH-26190 Phase 4',
    leadOfficer: officerDoc._id,
    assignedOfficers: [officerDoc._id],
    status: CASE_STATUS.UNDER_INVESTIGATION,
  });

  let passedCount = 0;
  let failedCount = 0;

  function assert(description, condition) {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failedCount++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: OCR Processing & Document Classification (FIR Schema)
    // ----------------------------------------------------
    console.log('[1/8] Testing OCR Intelligence & FIR Document Classification...');
    const firSampleText = `FIRST INFORMATION REPORT (Under Section 154 Cr.P.C)
Police Station: Central Cyber Crime Police Station
FIR Number: CR/2026/0891-BLR
Date and Time of Incident: 2026-03-14 02:30 IST
Place of Occurrence: Bengaluru City North Corridor
Complainant: State Bank Fraud Monitoring Officer
Name of Accused: Devendra Verma & Unknown Associates
Acts & Sections: IPC Sec 420, 468, 471 / IT Act Sec 66C, 66D
Brief Description: Unauthorized wire transfer rerouting via compromised municipal proxy portal.`;

    const firBuffer = Buffer.from(firSampleText, 'utf8');
    const firSha256 = calculateSha256(firBuffer);
    const s3Key = `cases/CR_2026_0401-TEST/${Date.now()}-TEST_PHASE4_FIR.pdf`;

    await s3Service.uploadDocument({
      key: s3Key,
      fileBuffer: firBuffer,
      mimeType: 'application/pdf',
      metadata: { caseNumber: testCase.caseNumber },
    });

    testDoc = await Document.create({
      caseId: testCase._id,
      title: 'Initial Cyber Heist FIR Docket',
      documentType: DOCUMENT_TYPES.FIR,
      s3Key,
      s3Bucket: 'sih26190-secure-documents-vault',
      fileName: 'TEST_PHASE4_FIR.pdf',
      originalName: 'TEST_PHASE4_FIR.pdf',
      fileSize: firBuffer.length,
      mimeType: 'application/pdf',
      uploadedBy: officerDoc._id,
      sha256Hash: firSha256,
      status: DOCUMENT_STATUS.PENDING_REVIEW,
    });

    const extractionResult = await extractionService.extractAndProcessDocument(testDoc._id);
    testDoc = extractionResult;

    assert('Document classified as FIR', extractionResult.classification.predictedType === DOCUMENT_TYPES.FIR);
    assert('Classification confidence is >= 0.85', extractionResult.classification.confidence >= 0.85);
    assert('Extracted FIR number correctly', extractionResult.extractedFields.firNumber?.value.includes('CR/2026/0891'));
    assert('Extracted Accused correctly', extractionResult.extractedFields.accused?.value.includes('Devendra Verma'));
    assert('Extracted Sections correctly', extractionResult.extractedFields.sections?.value.includes('420'));
    assert('Each field contains a confidence score', typeof extractionResult.extractedFields.firNumber?.confidence === 'number');

    // ----------------------------------------------------
    // TEST 2: Schema-Specific Extraction for Forensic Report
    // ----------------------------------------------------
    console.log('\n[2/8] Testing Schema-Specific Extraction for Forensic Report...');
    const forensicText = `CENTRAL FORENSIC SCIENCE LABORATORY
Directorate of Forensic Science Services
Report Number: CFSL/BLR/2026/CHEM-491
Examination Date: 2026-04-12
Laboratory: Central Forensic Science Laboratory, Bengaluru
Exhibit No.: Exhibit A-1 (Seized Flash Memory Drive)
Result of Examination: The memory dump contains intact cryptographic hashes matching fraudulent banking transaction logs.`;

    const forensicBuffer = Buffer.from(forensicText, 'utf8');
    const forensicDoc = await Document.create({
      caseId: testCase._id,
      title: 'CFSL Chemical & Digital Forensic Analysis Report',
      documentType: DOCUMENT_TYPES.FORENSIC_REPORT,
      s3Key: `cases/CR_2026_0401-TEST/${Date.now()}-TEST_PHASE4_FORENSIC.pdf`,
      s3Bucket: 'sih26190-secure-documents-vault',
      fileName: 'TEST_PHASE4_FORENSIC.pdf',
      originalName: 'TEST_PHASE4_FORENSIC.pdf',
      fileSize: forensicBuffer.length,
      mimeType: 'application/pdf',
      uploadedBy: officerDoc._id,
      sha256Hash: calculateSha256(forensicBuffer),
      status: DOCUMENT_STATUS.PENDING_REVIEW,
    });

    await s3Service.uploadDocument({
      key: forensicDoc.s3Key,
      fileBuffer: forensicBuffer,
      mimeType: 'application/pdf',
    });

    const forensicExtracted = await extractionService.extractAndProcessDocument(forensicDoc._id);

    assert('Forensic Report schema extracts reportNumber', Boolean(forensicExtracted.extractedFields.reportNumber?.value));
    assert('Forensic Report schema extracts laboratory', Boolean(forensicExtracted.extractedFields.laboratory?.value));
    assert('Forensic Report schema extracts findings', Boolean(forensicExtracted.extractedFields.findings?.value));
    assert('Forensic Report schema extracts relatedEvidence', Boolean(forensicExtracted.extractedFields.relatedEvidence?.value));

    // ----------------------------------------------------
    // TEST 3: Verifier Review Queue Retrieval
    // ----------------------------------------------------
    console.log('\n[3/8] Testing Verifier Review Queue API...');
    const queueRes = await request(app)
      .get('/api/v1/verification/queue')
      .set('Cookie', verifierCookies);

    assert('Verifier can retrieve review queue (HTTP 200 OK)', queueRes.status === 200);
    assert('Review queue contains pending documents', queueRes.body.data.length > 0);
    assert('Queue items contain extractedFields and OCR metadata', queueRes.body.data.some(d => d.extractedFields && d.ocrMetadata));

    // ----------------------------------------------------
    // TEST 4: Verifier Field Correction (Preserving AI Value)
    // ----------------------------------------------------
    console.log('\n[4/8] Testing Non-Destructive Verifier Field Correction...');
    const originalAiAccused = testDoc.extractedFields.accused?.aiValue || 'Devendra Verma & Unknown Associates';

    const correctionRes = await request(app)
      .patch(`/api/v1/verification/${testDoc._id}/fields`)
      .set('Cookie', verifierCookies)
      .send({
        fieldName: 'accused',
        correctedValue: 'Devendra Verma, Rajesh Kumar, and Ankit Sharma (Identified Co-conspirators)',
      });

    assert('Verifier correction succeeds (HTTP 200 OK)', correctionRes.status === 200);
    const updatedAccusedField = correctionRes.body.data.extractedFields.accused;
    assert('Human corrected value is updated in effective value', updatedAccusedField.value.includes('Ankit Sharma'));
    assert('Human corrected value is recorded in humanValue property', updatedAccusedField.humanValue.includes('Ankit Sharma'));
    assert('Original AI extracted value is preserved intact (non-destructive)', Boolean(updatedAccusedField.aiValue));
    assert('Field is marked as isCorrected = true', updatedAccusedField.isCorrected === true);
    assert('Field status is updated to corrected', updatedAccusedField.status === 'corrected');
    assert('Field records reviewer who made the correction', Boolean(updatedAccusedField.correctedBy));

    // ----------------------------------------------------
    // TEST 5: Unauthorized Field Correction Rejection (RBAC)
    // ----------------------------------------------------
    console.log('\n[5/8] Testing Security Boundary: Officer & Auditor Unauthorized Corrections...');
    const officerCorrectionRes = await request(app)
      .patch(`/api/v1/verification/${testDoc._id}/fields`)
      .set('Cookie', officerCookies) // Investigating Officer is NOT a verifier
      .send({
        fieldName: 'accused',
        correctedValue: 'Unauthorized Modification Attempt',
      });

    assert('Officer cannot modify forensic extraction values (HTTP 403 Forbidden)', officerCorrectionRes.status === 403);
    assert('Error code indicates INSUFFICIENT_PERMISSIONS', officerCorrectionRes.body.error.code === 'INSUFFICIENT_PERMISSIONS');

    const auditorCorrectionRes = await request(app)
      .patch(`/api/v1/verification/${testDoc._id}/fields`)
      .set('Cookie', auditorCookies) // Auditor is read-only
      .send({
        fieldName: 'accused',
        correctedValue: 'Auditor Modification Attempt',
      });

    assert('Auditor cannot modify forensic extraction values (HTTP 403 Forbidden)', auditorCorrectionRes.status === 403);

    // ----------------------------------------------------
    // TEST 6: Field Approval without Modification
    // ----------------------------------------------------
    console.log('\n[6/8] Testing Verifier Single Field Approval...');
    const approveRes = await request(app)
      .post(`/api/v1/verification/${testDoc._id}/fields/approve`)
      .set('Cookie', verifierCookies)
      .send({ fieldName: 'firNumber' });

    assert('Verifier can approve specific field (HTTP 200 OK)', approveRes.status === 200);
    assert('Approved field status is set to approved', approveRes.body.data.extractedFields.firNumber.status === 'approved');

    // ----------------------------------------------------
    // TEST 7: Document Verification & Digital Certification
    // ----------------------------------------------------
    console.log('\n[7/8] Testing Document Final Verification & Digital Certification...');
    const verifyDocRes = await request(app)
      .post(`/api/v1/verification/${testDoc._id}/verify`)
      .set('Cookie', verifierCookies)
      .send({ notes: 'All evidentiary fields cross-examined and certified against CFSL standards.' });

    assert('Document verified successfully (HTTP 200 OK)', verifyDocRes.status === 200);
    assert('Document status updated to verified', verifyDocRes.body.data.status === DOCUMENT_STATUS.VERIFIED);
    assert('Document verifiedBy is populated', Boolean(verifyDocRes.body.data.verifiedBy));
    assert('Document verificationNotes are recorded', Boolean(verifyDocRes.body.data.verificationNotes));

    // ----------------------------------------------------
    // TEST 8: Document Anomaly & Tamper Flagging
    // ----------------------------------------------------
    console.log('\n[8/8] Testing Document Anomaly & Tamper Flagging...');
    const flagRes = await request(app)
      .post(`/api/v1/verification/${forensicDoc._id}/flag`)
      .set('Cookie', verifierCookies)
      .send({ reason: 'Digital signature timestamp disparity observed on laboratory header page 2.' });

    assert('Document flagged successfully (HTTP 200 OK)', flagRes.status === 200);
    assert('Document status updated to flagged_tampered', flagRes.body.data.status === DOCUMENT_STATUS.FLAGGED_TAMPERED);
    assert('Document isTampered flag set to true', flagRes.body.data.isTampered === true);
    assert('Tamper flags array contains new entry with reason', flagRes.body.data.tamperFlags.length > 0);

  } catch (err) {
    console.error('Unexpected test failure:', err);
    failedCount++;
  } finally {
    await disconnectDB();
  }

  console.log('\n======================================================');
  console.log(`PHASE 4 TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOcrExtractionTests();
