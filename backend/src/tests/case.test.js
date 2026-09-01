process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/database');
const { User, Case, RefreshToken, CASE_STATUS, CASE_PRIORITY } = require('../models');
const { ROLES } = require('../constants/roles');
const totpService = require('../services/totp.service');

const OFFICER_1 = {
  name: 'Officer One',
  email: 'officer1.test@police.gov.in',
  password: 'Officer1SecurePass123!',
  role: ROLES.OFFICER,
  totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
};

const OFFICER_2 = {
  name: 'Officer Two',
  email: 'officer2.test@police.gov.in',
  password: 'Officer2SecurePass123!',
  role: ROLES.OFFICER,
  totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
};

const ADMIN_USER = {
  name: 'Admin User',
  email: 'admin.test@investigation.gov.in',
  password: 'AdminTestSecurePass123!',
  role: ROLES.ADMIN,
  totpSecret: 'MZXW6YTBOI2G63TOMZXW6YTBOI2G63TO',
};

const VERIFIER_USER = {
  name: 'Verifier User',
  email: 'verifier.test@forensics.gov.in',
  password: 'VerifierTestSecurePass123!',
  role: ROLES.VERIFIER,
  totpSecret: 'NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP',
};

const AUDITOR_USER = {
  name: 'Auditor User',
  email: 'auditor.test@judiciary.gov.in',
  password: 'AuditorTestSecurePass123!',
  role: ROLES.AUDITOR,
  totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
};

let officer1Doc, officer2Doc, adminDoc, verifierDoc, auditorDoc;
let officer1Cookies, officer2Cookies, adminCookies, verifierCookies, auditorCookies;
let createdCaseId, unassignedCaseId;

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

async function runCaseTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 2: CASE MANAGEMENT & SECURITY SUITE');
  console.log('======================================================\n');

  await connectDB();

  // Reset collections
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
  await RefreshToken.deleteMany({});

  // Seed test users
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

  // Authenticate all users
  officer1Cookies = await authenticateUser(OFFICER_1);
  officer2Cookies = await authenticateUser(OFFICER_2);
  adminCookies = await authenticateUser(ADMIN_USER);
  verifierCookies = await authenticateUser(VERIFIER_USER);
  auditorCookies = await authenticateUser(AUDITOR_USER);

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
    // TEST 1: Create Case by Officer (Valid payload)
    // ----------------------------------------------------
    console.log('[1/11] Testing Case Registration by Officer...');
    const createRes = await request(app)
      .post('/api/v1/cases')
      .set('Cookie', officer1Cookies)
      .send({
        caseNumber: 'CR/2026/0101-BLR',
        title: 'Cyber Intrusion & Banking API Fraud',
        description: 'Investigation into unauthorized transaction routing via falsified OAuth keys',
        jurisdiction: 'Cyber Crime Police Station, North Zone',
        priority: CASE_PRIORITY.HIGH,
        status: CASE_STATUS.UNDER_INVESTIGATION,
      });

    assert('Officer successfully creates case (HTTP 201 Created)', createRes.status === 201);
    assert('Created case has uppercase unique caseNumber', createRes.body.data.caseNumber === 'CR/2026/0101-BLR');
    assert('Creator officer is automatically designated as leadOfficer', createRes.body.data.leadOfficer._id.toString() === officer1Doc._id.toString());
    assert('Creator officer is included in assignedOfficers array', createRes.body.data.assignedOfficers.some(o => o._id.toString() === officer1Doc._id.toString()));

    createdCaseId = createRes.body.data._id;

    // ----------------------------------------------------
    // TEST 2: Duplicate Case Number Rejection
    // ----------------------------------------------------
    console.log('\n[2/11] Testing Duplicate Case Number Conflict Rejection...');
    const dupRes = await request(app)
      .post('/api/v1/cases')
      .set('Cookie', officer1Cookies)
      .send({
        caseNumber: 'cr/2026/0101-blr', // Lowercase to test uppercase uniqueness
        title: 'Another Duplicate Case',
      });

    assert('Duplicate case number rejected with HTTP 409 Conflict', dupRes.status === 409);
    assert('Error payload indicates DUPLICATE_CASE_NUMBER', dupRes.body.error.code === 'DUPLICATE_CASE_NUMBER');

    // ----------------------------------------------------
    // TEST 3: Validation Error Handling (Missing Fields / Invalid ObjectIds)
    // ----------------------------------------------------
    console.log('\n[3/11] Testing Validation Bounds (Express-Validator)...');
    const badReqRes = await request(app)
      .post('/api/v1/cases')
      .set('Cookie', officer1Cookies)
      .send({
        caseNumber: 'CR/2026/0102-BLR',
        // Missing title
        assignedOfficers: ['invalid-mongo-id-123'],
      });

    assert('Invalid request payload rejected with HTTP 400 Bad Request', badReqRes.status === 400);

    // ----------------------------------------------------
    // Create an unassigned case (Created by Officer 2)
    // ----------------------------------------------------
    const unassignedRes = await request(app)
      .post('/api/v1/cases')
      .set('Cookie', officer2Cookies)
      .send({
        caseNumber: 'CR/2026/0999-MUM',
        title: 'Narcotics Smuggling & Port Operations',
        description: 'Contraband seizure at West Coast Container Depot',
        priority: CASE_PRIORITY.CRITICAL,
      });
    unassignedCaseId = unassignedRes.body.data._id;

    // ----------------------------------------------------
    // TEST 4: Assigned Officer Can Access Assigned Case
    // ----------------------------------------------------
    console.log('\n[4/11] Testing Assigned Officer Case Access...');
    const viewAssignedRes = await request(app)
      .get(`/api/v1/cases/${createdCaseId}`)
      .set('Cookie', officer1Cookies);

    assert('Assigned officer accesses case dossier (HTTP 200 OK)', viewAssignedRes.status === 200);
    assert('Response contains populated leadOfficer details', Boolean(viewAssignedRes.body.data.leadOfficer.name));

    // ----------------------------------------------------
    // TEST 5: SECURITY ASSERTION: Officer CANNOT Access Unassigned Case
    // ----------------------------------------------------
    console.log('\n[5/11] Testing Officer Isolation: Accessing Unassigned Case...');
    const viewUnassignedRes = await request(app)
      .get(`/api/v1/cases/${unassignedCaseId}`)
      .set('Cookie', officer1Cookies); // Officer 1 attempts to view Officer 2's unassigned case

    assert('Officer viewing unassigned case is rejected with HTTP 403 Forbidden', viewUnassignedRes.status === 403);
    assert('Error code indicates INSUFFICIENT_PERMISSIONS', viewUnassignedRes.body.error.code === 'INSUFFICIENT_PERMISSIONS');

    // ----------------------------------------------------
    // TEST 6: Admin Global Oversight Access
    // ----------------------------------------------------
    console.log('\n[6/11] Testing Admin Global Case Access...');
    const adminViewRes = await request(app)
      .get(`/api/v1/cases/${unassignedCaseId}`)
      .set('Cookie', adminCookies);

    assert('Admin accesses any case file globally (HTTP 200 OK)', adminViewRes.status === 200);

    // ----------------------------------------------------
    // TEST 7: Case Update by Permitted Assigned Officer
    // ----------------------------------------------------
    console.log('\n[7/11] Testing Permitted Case Updates by Assigned Officer...');
    const updateRes = await request(app)
      .patch(`/api/v1/cases/${createdCaseId}`)
      .set('Cookie', officer1Cookies)
      .send({
        title: 'Cyber Intrusion & Banking API Fraud (Escalated)',
        status: CASE_STATUS.PENDING_TRIAL,
        priority: CASE_PRIORITY.CRITICAL,
      });

    assert('Assigned officer updates permitted case metadata (HTTP 200 OK)', updateRes.status === 200);
    assert('Case status transitioned to pending_trial', updateRes.body.data.status === CASE_STATUS.PENDING_TRIAL);
    assert('Case priority updated to critical', updateRes.body.data.metadata.priority === CASE_PRIORITY.CRITICAL);

    // ----------------------------------------------------
    // TEST 8: Mass Assignment Prevention
    // ----------------------------------------------------
    console.log('\n[8/11] Testing Mass Assignment & Immutable Fields Protection...');
    const massAssignRes = await request(app)
      .patch(`/api/v1/cases/${createdCaseId}`)
      .set('Cookie', officer1Cookies)
      .send({
        caseNumber: 'TAMPERED-CRIME-NUM-000',
        leadOfficer: adminDoc._id.toString(),
        createdAt: '1970-01-01T00:00:00Z',
      });

    assert('Update request succeeds but ignores immutable fields', massAssignRes.status === 200);
    assert('caseNumber was NOT tampered', massAssignRes.body.data.caseNumber === 'CR/2026/0101-BLR');
    assert('leadOfficer was NOT modified', massAssignRes.body.data.leadOfficer._id.toString() === officer1Doc._id.toString());

    // ----------------------------------------------------
    // TEST 9: Officer Assignment Workflow
    // ----------------------------------------------------
    console.log('\n[9/11] Testing Officer Assignment Workflow...');
    const assignRes = await request(app)
      .post(`/api/v1/cases/${createdCaseId}/officers`)
      .set('Cookie', officer1Cookies)
      .send({
        officerIds: [officer2Doc._id.toString()],
      });

    assert('Lead officer assigns Officer 2 to the case (HTTP 200 OK)', assignRes.status === 200);
    assert('assignedOfficers now contains both officers', assignRes.body.data.assignedOfficers.length === 2);

    // Now Officer 2 should have access to this case!
    const officer2NowHasAccess = await request(app)
      .get(`/api/v1/cases/${createdCaseId}`)
      .set('Cookie', officer2Cookies);
    assert('Newly assigned Officer 2 can now access the case (HTTP 200 OK)', officer2NowHasAccess.status === 200);

    // ----------------------------------------------------
    // TEST 10: Verifier & Auditor Read-Only Boundaries
    // ----------------------------------------------------
    console.log('\n[10/11] Testing Verifier & Auditor Modification Restrictions...');
    const verifierUpdateRes = await request(app)
      .patch(`/api/v1/cases/${createdCaseId}`)
      .set('Cookie', verifierCookies)
      .send({ title: 'Tampered by Verifier' });

    assert('Verifier cannot modify case details (HTTP 403 Forbidden)', verifierUpdateRes.status === 403);

    const auditorUpdateRes = await request(app)
      .patch(`/api/v1/cases/${createdCaseId}`)
      .set('Cookie', auditorCookies)
      .send({ title: 'Tampered by Auditor' });

    assert('Auditor cannot modify case details (HTTP 403 Forbidden)', auditorUpdateRes.status === 403);

    // ----------------------------------------------------
    // TEST 11: Case Statistics Scoping
    // ----------------------------------------------------
    console.log('\n[11/11] Testing Case Statistics Aggregations...');
    const statsRes = await request(app)
      .get('/api/v1/cases/statistics')
      .set('Cookie', adminCookies);

    assert('Case statistics endpoint returns HTTP 200 OK', statsRes.status === 200);
    assert('Statistics include total, activeInvestigations, byStatus, byPriority', Boolean(statsRes.body.data.total >= 2 && statsRes.body.data.byStatus));

  } catch (error) {
    console.error('Unexpected test error occurred:', error);
    failedCount++;
  } finally {
    await disconnectDB();
  }

  console.log('\n======================================================');
  console.log(`CASE TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runCaseTests();
