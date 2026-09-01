process.env.NODE_ENV = 'test';

const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/database');
const { User, RefreshToken } = require('../models');
const { ROLES } = require('../constants/roles');
const totpService = require('../services/totp.service');
const config = require('../config/env');

const TEST_OFFICER = {
  name: 'Test Officer',
  email: 'test.officer@police.gov.in',
  password: 'OfficerTestPass123!',
  role: ROLES.OFFICER,
  totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
};

const TEST_VERIFIER = {
  name: 'Test Verifier',
  email: 'test.verifier@forensics.gov.in',
  password: 'VerifierTestPass123!',
  role: ROLES.VERIFIER,
  totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
};

const TEST_ADMIN = {
  name: 'Test Admin',
  email: 'test.admin@investigation.gov.in',
  password: 'AdminTestPass123!',
  role: ROLES.ADMIN,
  totpSecret: 'MZXW6YTBOI2G63TOMZXW6YTBOI2G63TO',
};

const TEST_AUDITOR = {
  name: 'Test Auditor',
  email: 'test.auditor@judiciary.gov.in',
  password: 'AuditorTestPass123!',
  role: ROLES.AUDITOR,
  totpSecret: 'NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP',
};

let officerUser, verifierUser, adminUser, auditorUser;

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING PHASE 1 SECURITY & AUTHENTICATION TEST SUITE');
  console.log('======================================================\n');

  await connectDB();

  // Reset test database records
  await User.deleteMany({
    email: {
      $in: [
        TEST_OFFICER.email,
        TEST_VERIFIER.email,
        TEST_ADMIN.email,
        TEST_AUDITOR.email,
        'new.officer@police.gov.in',
      ],
    },
  });
  await RefreshToken.deleteMany({});

  // Seed test users
  const [officerHash, verifierHash, adminHash, auditorHash] = await Promise.all([
    User.hashPassword(TEST_OFFICER.password),
    User.hashPassword(TEST_VERIFIER.password),
    User.hashPassword(TEST_ADMIN.password),
    User.hashPassword(TEST_AUDITOR.password),
  ]);

  officerUser = await User.create({ ...TEST_OFFICER, passwordHash: officerHash, totpEnabled: true });
  verifierUser = await User.create({ ...TEST_VERIFIER, passwordHash: verifierHash, totpEnabled: true });
  adminUser = await User.create({ ...TEST_ADMIN, passwordHash: adminHash, totpEnabled: true });
  auditorUser = await User.create({ ...TEST_AUDITOR, passwordHash: auditorHash, totpEnabled: true });

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
    // TEST 1: Password Hashing (bcrypt >= 12 rounds)
    // ----------------------------------------------------
    console.log('[1/11] Testing Password Security & Hashing...');
    const saltRounds = bcrypt.getRounds(officerUser.passwordHash || officerHash);
    assert('Bcrypt uses at least 12 salt rounds', saltRounds >= 12);
    assert('Plaintext password does not equal stored hash', officerHash !== TEST_OFFICER.password);
    const queriedUser = await User.findById(officerUser._id);
    assert('passwordHash and totpSecret are hidden by default', queriedUser.passwordHash === undefined && queriedUser.totpSecret === undefined);

    // ----------------------------------------------------
    // TEST 2: Login Step 1 (Email + Password)
    // ----------------------------------------------------
    console.log('\n[2/11] Testing Step 1 Login (Password Verification)...');
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_OFFICER.email, password: TEST_OFFICER.password });

    assert('Valid credentials returns HTTP 200/202', loginRes.status === 200 || loginRes.status === 202);
    assert('Pre-2FA requirement signaled (require2FA: true)', loginRes.body.data.require2FA === true);
    assert('Pre-2FA temporary token is issued', typeof loginRes.body.data.tempToken === 'string');
    assert('No authenticated session cookie issued before 2FA', !loginRes.headers['set-cookie'] || !loginRes.headers['set-cookie'].some(c => c.startsWith('accessToken=')));

    const tempToken = loginRes.body.data.tempToken;

    // ----------------------------------------------------
    // TEST 3: Failed Password Handling
    // ----------------------------------------------------
    console.log('\n[3/11] Testing Invalid Password Handling...');
    const badPassRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_OFFICER.email, password: 'WrongPassword123!' });

    assert('Incorrect password returns HTTP 401 Unauthorized', badPassRes.status === 401);
    assert('Error payload contains standardized INVALID_CREDENTIALS code', badPassRes.body.error.code === 'INVALID_CREDENTIALS');

    // ----------------------------------------------------
    // TEST 4: Failed TOTP Code
    // ----------------------------------------------------
    console.log('\n[4/11] Testing Invalid TOTP 2FA Verification...');
    const badTotpRes = await request(app)
      .post('/api/v1/auth/verify-2fa')
      .send({ tempToken, totpCode: '000000' });

    assert('Invalid TOTP code returns HTTP 401 Unauthorized', badTotpRes.status === 401);
    assert('Error payload indicates INVALID_TOTP code', badTotpRes.body.error.code === 'INVALID_TOTP');

    // ----------------------------------------------------
    // TEST 5: Successful TOTP 2FA & httpOnly Cookie Issuance
    // ----------------------------------------------------
    console.log('\n[5/11] Testing Successful TOTP 2FA Verification...');
    const validOfficerTotp = totpService.generateCode(TEST_OFFICER.totpSecret);
    const goodTotpRes = await request(app)
      .post('/api/v1/auth/verify-2fa')
      .send({ tempToken, totpCode: validOfficerTotp });

    assert('Valid TOTP returns HTTP 200 OK', goodTotpRes.status === 200);
    assert('Session contains user safe profile without passwordHash', goodTotpRes.body.data.user && !goodTotpRes.body.data.user.passwordHash);

    const setCookies = goodTotpRes.headers['set-cookie'] || [];
    const hasAccessTokenCookie = setCookies.some((c) => c.includes('accessToken=') && c.toLowerCase().includes('httponly') && c.toLowerCase().includes('samesite=strict'));
    const hasRefreshTokenCookie = setCookies.some((c) => c.includes('refreshToken=') && c.toLowerCase().includes('httponly') && c.toLowerCase().includes('samesite=strict'));

    assert('accessToken issued with httpOnly=true and sameSite=strict', hasAccessTokenCookie);
    assert('refreshToken issued with httpOnly=true and sameSite=strict', hasRefreshTokenCookie);

    const officerCookies = setCookies;

    // ----------------------------------------------------
    // TEST 6: Protected Route Authorization
    // ----------------------------------------------------
    console.log('\n[6/11] Testing Protected Route Boundaries...');
    const unauthRes = await request(app).get('/api/v1/auth/profile');
    assert('Unauthenticated request to protected route returns HTTP 401', unauthRes.status === 401);

    const authRes = await request(app)
      .get('/api/v1/auth/profile')
      .set('Cookie', officerCookies);
    assert('Authenticated request with httpOnly cookie returns HTTP 200', authRes.status === 200);
    assert('Profile returns official role "officer"', authRes.body.data.user.role === ROLES.OFFICER);

    // ----------------------------------------------------
    // TEST 7: Role-Based Access Control (Admin Login & Clearance)
    // ----------------------------------------------------
    console.log('\n[7/11] Testing Admin Clearance & User Management...');
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });
    const adminTotp = totpService.generateCode(TEST_ADMIN.totpSecret);
    const adminAuthRes = await request(app)
      .post('/api/v1/auth/verify-2fa')
      .send({ tempToken: adminLoginRes.body.data.tempToken, totpCode: adminTotp });

    const adminCookies = adminAuthRes.headers['set-cookie'];

    const adminUsersRes = await request(app)
      .get('/api/v1/users')
      .set('Cookie', adminCookies);

    assert('Admin clearance accesses /api/v1/users successfully (HTTP 200)', adminUsersRes.status === 200);

    // Admin creates new user with automatic 2FA onboarding setup
    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Cookie', adminCookies)
      .send({
        name: 'New Sub-Inspector',
        email: 'new.officer@police.gov.in',
        password: 'SecureInitialPass123!',
        role: ROLES.OFFICER,
        badgeNumber: 'CCB-1002',
      });

    assert('Admin creates user with 2FA QR Code & secret (HTTP 201)', createRes.status === 201);
    assert('Created user response provides base64 QR code Data URL', Boolean(createRes.body.data.totpSetup.qrCodeDataUrl));

    // ----------------------------------------------------
    // TEST 8: Verifier -> Admin Endpoint Forbidden (403)
    // ----------------------------------------------------
    console.log('\n[8/11] Testing RBAC Security Violation: Verifier accessing Admin Endpoint...');
    const verifierLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_VERIFIER.email, password: TEST_VERIFIER.password });
    const verifierTotp = totpService.generateCode(TEST_VERIFIER.totpSecret);
    const verifierAuthRes = await request(app)
      .post('/api/v1/auth/verify-2fa')
      .send({ tempToken: verifierLoginRes.body.data.tempToken, totpCode: verifierTotp });

    const verifierCookies = verifierAuthRes.headers['set-cookie'];

    const forbiddenRes = await request(app)
      .get('/api/v1/users')
      .set('Cookie', verifierCookies);

    assert('Verifier requesting Admin route receives HTTP 403 Forbidden', forbiddenRes.status === 403);
    assert('Error code is INSUFFICIENT_PERMISSIONS', forbiddenRes.body.error.code === 'INSUFFICIENT_PERMISSIONS');

    // Officer attempting to access admin route also receives 403
    const officerAdminRes = await request(app)
      .get('/api/v1/users')
      .set('Cookie', officerCookies);
    assert('Officer requesting Admin route receives HTTP 403 Forbidden', officerAdminRes.status === 403);

    // Auditor attempting to modify document receives 403
    const auditorDocModRes = await request(app)
      .post('/api/v1/documents')
      .set('Cookie', verifierCookies);
    assert('Verifier cannot upload initial document dossier (403 Forbidden)', auditorDocModRes.status === 403);

    // ----------------------------------------------------
    // TEST 9: Refresh Token Rotation & Replay Attack Defense
    // ----------------------------------------------------
    console.log('\n[9/11] Testing Refresh Token Rotation & Replay Protection...');
    const auditorLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_AUDITOR.email, password: TEST_AUDITOR.password });
    const auditorTotp = totpService.generateCode(TEST_AUDITOR.totpSecret);
    const auditorAuthRes = await request(app)
      .post('/api/v1/auth/verify-2fa')
      .send({ tempToken: auditorLoginRes.body.data.tempToken, totpCode: auditorTotp });

    const initialAuditorCookies = auditorAuthRes.headers['set-cookie'];
    const refreshTokenCookie = initialAuditorCookies.find(c => c.startsWith('refreshToken='));

    // Rotate Token 1st time
    const rotateRes1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshTokenCookie]);

    assert('Initial refresh returns HTTP 200 with new rotated tokens', rotateRes1.status === 200);
    const rotatedAuditorCookies = rotateRes1.headers['set-cookie'] || [];
    const newRefreshTokenCookie = rotatedAuditorCookies.find(c => c.startsWith('refreshToken='));

    assert('Rotated refresh token cookie is set', Boolean(newRefreshTokenCookie));

    // Replay Attack Test: Attempt to reuse the OLD, already-rotated refresh token!
    const replayAttackRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [refreshTokenCookie]);

    assert('Replaying old refresh token is blocked (HTTP 401)', replayAttackRes.status === 401);

    // Verify that due to replay detection, the NEW token in the same family was also revoked!
    if (newRefreshTokenCookie) {
      const postReplayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [newRefreshTokenCookie]);

      assert('Replay attack successfully invalidated subsequent family tokens', postReplayRes.status === 401);
    }

    // ----------------------------------------------------
    // TEST 10: Secure Logout & Session Invalidation
    // ----------------------------------------------------
    console.log('\n[10/11] Testing Secure Logout & Session Invalidation...');
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', officerCookies);

    assert('Logout returns HTTP 200 OK', logoutRes.status === 200);
    const clearedCookies = logoutRes.headers['set-cookie'] || [];
    assert('Logout clears accessToken and refreshToken cookies', clearedCookies.some(c => c.includes('accessToken=;')) && clearedCookies.some(c => c.includes('refreshToken=;')));

    // ----------------------------------------------------
    // TEST 11: Rate Limiting
    // ----------------------------------------------------
    console.log('\n[11/11] Testing Rate Limiter Protection on Auth Gateways...');
    let hitRateLimit = false;
    for (let i = 0; i < 110; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'spam.bruteforce@police.gov.in', password: 'badpassword' });
      if (res.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert('Rate limiter triggers HTTP 429 Too Many Requests upon rapid bursts', hitRateLimit);

  } catch (error) {
    console.error('Unexpected test error occurred:', error);
    failedCount++;
  } finally {
    await disconnectDB();
  }

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
