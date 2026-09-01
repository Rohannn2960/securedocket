process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const crypto = require('crypto');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/database');
const { User, Case, Document, RefreshToken, CASE_STATUS, CASE_PRIORITY, DOCUMENT_STATUS, DOCUMENT_TYPES } = require('../models');
const { ROLES } = require('../constants/roles');
const totpService = require('../services/totp.service');
const { calculateSha256 } = require('../utils/crypto');

const OFFICER_1 = {
  name: 'Inspector Vikram Singh',
  email: 'vikram.officer@police.gov.in',
  password: 'OfficerVikram123!',
  role: ROLES.OFFICER,
  totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
};

const OFFICER_2 = {
  name: 'Sub-Inspector Ananya Rao',
  email: 'ananya.officer@police.gov.in',
  password: 'OfficerAnanya123!',
  role: ROLES.OFFICER,
  totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
};

const ADMIN_USER = {
  name: 'Director General Sharma',
  email: 'admin.dms@investigation.gov.in',
  password: 'AdminSecurePass123!',
  role: ROLES.ADMIN,
  totpSecret: 'MZXW6YTBOI2G63TOMZXW6YTBOI2G63TO',
};

const VERIFIER_USER = {
  name: 'Forensic Verifier Roy',
  email: 'verifier.roy@forensics.gov.in',
  password: 'VerifierSecurePass123!',
  role: ROLES.VERIFIER,
  totpSecret: 'NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP',
};

const AUDITOR_USER = {
  name: 'Judicial Auditor Sen',
  email: 'auditor.sen@judiciary.gov.in',
  password: 'AuditorSecurePass123!',
  role: ROLES.AUDITOR,
  totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
};

let officer1Doc, officer2Doc, adminDoc, verifierDoc, auditorDoc;
let officer1Cookies, officer2Cookies, adminCookies, verifierCookies, auditorCookies;
let assignedCaseDoc, unassignedCaseDoc;
let uploadedDocId;

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

async function runDocumentTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 3: SECURE DOCUMENT INGESTION SUITE');
  console.log('======================================================\n');

  await connectDB();

  // Reset test data
  await User.deleteMany({
    email: {
      $in: [
        OFFICER_1.email,
        OFFICER_2.email,
        ADMIN_USER.email,
        VERIFIER_USER.email,
        AUDITOR_USER.email,
      ],
    },
  });
  await Case.deleteMany({});
  await Document.deleteMany({});
  await RefreshToken.deleteMany({});

  // Seed users
  const [h1, h2, hAdmin, hVerif, hAudit] = await Promise.all([
    User.hashPassword(OFFICER_1.password),
    User.hashPassword(OFFICER_2.password),
    User.hashPassword(ADMIN_USER.password),
    User.hashPassword(VERIFIER_USER.password),
    User.hashPassword(AUDITOR_USER.password),
  ]);

  officer1Doc = await User.create({ ...OFFICER_1, passwordHash: h1, totpEnabled: true });
  officer2Doc = await User.create({ ...OFFICER_2, passwordHash: h2, totpEnabled: true });
  adminDoc = await User.create({ ...ADMIN_USER, passwordHash: hAdmin, totpEnabled: true });
  verifierDoc = await User.create({ ...VERIFIER_USER, passwordHash: hVerif, totpEnabled: true });
  auditorDoc = await User.create({ ...AUDITOR_USER, passwordHash: hAudit, totpEnabled: true });

  officer1Cookies = await authenticateUser(OFFICER_1);
  officer2Cookies = await authenticateUser(OFFICER_2);
  adminCookies = await authenticateUser(ADMIN_USER);
  verifierCookies = await authenticateUser(VERIFIER_USER);
  auditorCookies = await authenticateUser(AUDITOR_USER);

  // Seed two cases: One assigned to Officer 1, one assigned only to Officer 2
  assignedCaseDoc = await Case.create({
    caseNumber: 'CR/2026/0501-BLR',
    title: 'Cyber Extortion & Ransomware Seizure',
    description: 'Encrypted database extortion ring targeting municipal servers',
    leadOfficer: officer1Doc._id,
    assignedOfficers: [officer1Doc._id],
    status: CASE_STATUS.UNDER_INVESTIGATION,
  });

  unassignedCaseDoc = await Case.create({
    caseNumber: 'CR/2026/0502-DEL',
    title: 'Illegal Arms Smuggling & Ballistics Inquiry',
    description: 'Seizure of unregistered weapons cache at interstate border',
    leadOfficer: officer2Doc._id,
    assignedOfficers: [officer2Doc._id],
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
    // TEST 1: Valid PDF Document Ingestion with SHA-256 Hashing & SSE-S3
    // ----------------------------------------------------
    console.log('[1/11] Testing Valid PDF Document Ingestion by Assigned Officer...');
    // Real PDF header magic bytes: %PDF-1.4 ...
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (FIR Report) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');
    const expectedSha256 = calculateSha256(validPdfBuffer);

    const uploadRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', officer1Cookies)
      .field('caseId', assignedCaseDoc._id.toString())
      .field('title', 'Initial Cyber Incident FIR')
      .field('documentType', DOCUMENT_TYPES.FIR)
      .field('description', 'Initial FIR lodged by North Cyber Division')
      .attach('file', validPdfBuffer, { filename: 'FIR_Incident_2026.pdf', contentType: 'application/pdf' });

    assert('Document ingested successfully (HTTP 201 Created)', uploadRes.status === 201);
    assert('Calculated SHA-256 matches exact buffer hash', uploadRes.body.data.sha256Hash === expectedSha256);
    assert('Initial document status defaults to pending_review', uploadRes.body.data.status === DOCUMENT_STATUS.PENDING_REVIEW);
    assert('Document version is 1', uploadRes.body.data.version === 1);
    assert('Version history contains initial version 1 entry', uploadRes.body.data.versions?.length === 1);
    assert('S3 key is server-controlled (starts with cases/CR_2026_0501-BLR/)', uploadRes.body.data.s3Key.startsWith('cases/CR_2026_0501-BLR/'));
    assert('Raw client filename was sanitized and not used directly as key', uploadRes.body.data.s3Key !== 'FIR_Incident_2026.pdf');

    uploadedDocId = uploadRes.body.data._id;

    // ----------------------------------------------------
    // TEST 2: Valid Image Evidence Upload (PNG Magic Bytes)
    // ----------------------------------------------------
    console.log('\n[2/11] Testing Valid PNG Evidence Ingestion...');
    const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const pngUploadRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', officer1Cookies)
      .field('caseId', assignedCaseDoc._id.toString())
      .field('title', 'Ransom Note Screenshot Evidence')
      .field('documentType', DOCUMENT_TYPES.EVIDENCE)
      .attach('file', validPngBuffer, { filename: 'screenshot_evidence.png', contentType: 'image/png' });

    assert('PNG evidence ingested successfully (HTTP 201 Created)', pngUploadRes.status === 201);
    assert('Detected MIME type is image/png', pngUploadRes.body.data.mimeType === 'image/png');

    // ----------------------------------------------------
    // TEST 3: Unauthorized Case Upload Rejection (Security Boundary)
    // ----------------------------------------------------
    console.log('\n[3/11] Testing Case Access Boundary: Officer Uploading to Unassigned Case...');
    const unauthUploadRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', officer1Cookies) // Officer 1 is NOT assigned to unassignedCaseDoc
      .field('caseId', unassignedCaseDoc._id.toString())
      .field('title', 'Unauthorized Evidence')
      .field('documentType', DOCUMENT_TYPES.EVIDENCE)
      .attach('file', validPdfBuffer, { filename: 'evidence.pdf', contentType: 'application/pdf' });

    assert('Unauthorized case upload is rejected with HTTP 403 Forbidden', unauthUploadRes.status === 403);
    assert('Error code indicates INSUFFICIENT_PERMISSIONS', unauthUploadRes.body.error.code === 'INSUFFICIENT_PERMISSIONS');

    // ----------------------------------------------------
    // TEST 4: Invalid File Extension Rejection
    // ----------------------------------------------------
    console.log('\n[4/11] Testing Prohibited File Extension Rejection (.exe / .sh)...');
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]); // MZ header
    const badExtRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', officer1Cookies)
      .field('caseId', assignedCaseDoc._id.toString())
      .field('title', 'Malicious Script Payload')
      .field('documentType', DOCUMENT_TYPES.EVIDENCE)
      .attach('file', exeBuffer, { filename: 'payload.exe', contentType: 'application/octet-stream' });

    assert('Prohibited extension rejected with HTTP 400 Bad Request', badExtRes.status === 400);

    // ----------------------------------------------------
    // TEST 5: Binary Magic-Number Mismatch Rejection (File Extension Spoofing)
    // ----------------------------------------------------
    console.log('\n[5/11] Testing Binary Magic-Number Mismatch Detection (Spoofed .pdf)...');
    // An executable binary disguised with a .pdf extension
    const spoofedPdfBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const spoofedRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', officer1Cookies)
      .field('caseId', assignedCaseDoc._id.toString())
      .field('title', 'Spoofed Trojan Dossier')
      .field('documentType', DOCUMENT_TYPES.EVIDENCE)
      .attach('file', spoofedPdfBuffer, { filename: 'trojan_disguised.pdf', contentType: 'application/pdf' });

    assert('Spoofed extension with invalid binary signature rejected (HTTP 400)', spoofedRes.status === 400);
    assert('Rejection mentions binary signature mismatch or security alert', Boolean(spoofedRes.body.error.message.includes('signature') || spoofedRes.body.error.message.includes('Executable')));

    // ----------------------------------------------------
    // TEST 6: Invalid Document Category Rejection
    // ----------------------------------------------------
    console.log('\n[6/11] Testing Invalid Document Category Rejection...');
    const invalidCatRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', officer1Cookies)
      .field('caseId', assignedCaseDoc._id.toString())
      .field('title', 'Arbitrary Type File')
      .field('documentType', 'unsupported_arbitrary_category')
      .attach('file', validPdfBuffer, { filename: 'document.pdf', contentType: 'application/pdf' });

    assert('Invalid document category rejected with HTTP 400 Bad Request', invalidCatRes.status === 400);

    // ----------------------------------------------------
    // TEST 7: Presigned View URL Generation (5-Minute Expiry)
    // ----------------------------------------------------
    console.log('\n[7/11] Testing 5-Minute Presigned View URL Generation...');
    const viewUrlRes = await request(app)
      .get(`/api/v1/documents/${uploadedDocId}/view`)
      .set('Cookie', officer1Cookies);

    assert('Presigned view URL generated successfully (HTTP 200 OK)', viewUrlRes.status === 200);
    assert('Presigned URL contains 5-minute TTL parameter (300s)', viewUrlRes.body.data.expiresInSeconds === 300);
    assert(
      'Presigned URL is cryptographically signed with 5m expiry',
      viewUrlRes.body.data.url.includes('expires=') || viewUrlRes.body.data.url.includes('X-Amz-Expires=300')
    );
    assert('Response provides verified SHA-256 expected hash', viewUrlRes.body.data.sha256Expected === expectedSha256);

    // Test streaming through the generated URL
    const streamRes = await request(app).get(viewUrlRes.body.data.url.replace(/^http:\/\/[^/]+/, ''));
    assert('Document stream returns HTTP 200 OK with binary payload', streamRes.status === 200);
    assert('Streamed payload has matching cryptographic hash', calculateSha256(streamRes.body) === expectedSha256);

    // ----------------------------------------------------
    // TEST 8: Presigned View URL Access Boundary (Unassigned Officer Rejected)
    // ----------------------------------------------------
    console.log('\n[8/11] Testing Presigned View URL Boundary for Unassigned Officer...');
    const unassignedViewRes = await request(app)
      .get(`/api/v1/documents/${uploadedDocId}/view`)
      .set('Cookie', officer2Cookies); // Officer 2 is NOT assigned to this case

    assert('Unassigned officer cannot generate presigned view URL (HTTP 403 Forbidden)', unassignedViewRes.status === 403);

    // ----------------------------------------------------
    // TEST 9: Verifier & Auditor Authorized Read Clearance
    // ----------------------------------------------------
    console.log('\n[9/11] Testing Verifier and Auditor Read Clearance for Presigned View...');
    const verifierViewRes = await request(app)
      .get(`/api/v1/documents/${uploadedDocId}/view`)
      .set('Cookie', verifierCookies);
    assert('Forensic Verifier can generate presigned view URL (HTTP 200 OK)', verifierViewRes.status === 200);

    const auditorViewRes = await request(app)
      .get(`/api/v1/documents/${uploadedDocId}/view`)
      .set('Cookie', auditorCookies);
    assert('Judicial Auditor can generate presigned view URL (HTTP 200 OK)', auditorViewRes.status === 200);

    // ----------------------------------------------------
    // TEST 10: Verifier & Auditor Cannot Upload Initial Evidence
    // ----------------------------------------------------
    console.log('\n[10/11] Testing Upload Restrictions for Verifier and Auditor...');
    const verifierUploadRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', verifierCookies)
      .field('caseId', assignedCaseDoc._id.toString())
      .field('documentType', DOCUMENT_TYPES.EVIDENCE)
      .attach('file', validPdfBuffer, { filename: 'verifier_upload.pdf', contentType: 'application/pdf' });
    assert('Verifier cannot upload initial evidence dossiers (HTTP 403 Forbidden)', verifierUploadRes.status === 403);

    const auditorUploadRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', auditorCookies)
      .field('caseId', assignedCaseDoc._id.toString())
      .field('documentType', DOCUMENT_TYPES.EVIDENCE)
      .attach('file', validPdfBuffer, { filename: 'auditor_upload.pdf', contentType: 'application/pdf' });
    assert('Auditor cannot upload initial evidence dossiers (HTTP 403 Forbidden)', auditorUploadRes.status === 403);

    // ----------------------------------------------------
    // TEST 11: Document List Scoping for Officers
    // ----------------------------------------------------
    console.log('\n[11/11] Testing Document Registry Scoping...');
    const officer1ListRes = await request(app)
      .get('/api/v1/documents')
      .set('Cookie', officer1Cookies);
    assert('Officer 1 retrieves documents for assigned cases (HTTP 200 OK)', officer1ListRes.status === 200);
    assert('Officer 1 sees uploaded document in registry', officer1ListRes.body.data.some(d => d._id.toString() === uploadedDocId.toString()));

  } catch (error) {
    console.error('Unexpected test error occurred:', error);
    failedCount++;
  } finally {
    await disconnectDB();
  }

  console.log('\n======================================================');
  console.log(`DOCUMENT TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runDocumentTests();
