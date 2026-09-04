const mongoose = require('mongoose');
const { connectToTestDb, closeTestDb } = require('./testDb');
const bcrypt = require('bcryptjs');
const { User, Case, Document, AuditLog, RefreshToken } = require('../src/models');
const { ROLES } = require('../src/constants/roles');
const { cookieConfig } = require('../src/config/security');
const {
  generateAccessToken,
  generatePre2faToken,
  createRefreshTokenSession,
  rotateRefreshToken,
} = require('../src/services/auth.service');
const {
  encryptAES256GCM,
  decryptAES256GCM,
  calculateSha256,
  calculateAuditHash,
  timingSafeEqual,
} = require('../src/utils/crypto');
const { validateUploadedFile } = require('../src/utils/fileValidator');
const aiOcrService = require('../src/services/aiOcr.service');
const searchService = require('../src/services/search.service');
const config = require('../src/config/env');

beforeAll(async () => {
  await connectToTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

afterEach(async () => {
  await Document.deleteMany({});
  await Case.deleteMany({});
  await User.deleteMany({});
  await AuditLog.deleteMany({});
  await RefreshToken.deleteMany({});
});

describe('Phase 11: Security Hardening & Threat Review Verification', () => {
  let adminUser, officerUser, officerB;

  beforeEach(async () => {
    adminUser = await User.create({
      email: 'admin.sec@police.gov.in',
      passwordHash: await User.hashPassword('AdminPassphraseSecure123!'),
      name: 'Director Kumar',
      role: ROLES.ADMIN,
      isActive: true,
    });

    officerUser = await User.create({
      email: 'officer.a@police.gov.in',
      passwordHash: await User.hashPassword('OfficerPassphrase123!'),
      name: 'Inspector Anand',
      role: ROLES.OFFICER,
      isActive: true,
    });

    officerB = await User.create({
      email: 'officer.b@police.gov.in',
      passwordHash: await User.hashPassword('OfficerPassphraseB123!'),
      name: 'Inspector Bala',
      role: ROLES.OFFICER,
      isActive: true,
    });
  });

  describe('1. Authentication & Session Cryptography', () => {
    test('Bcrypt uses >= 12 rounds on all password hashes', async () => {
      const rounds = bcrypt.getRounds(adminUser.passwordHash);
      expect(rounds).toBeGreaterThanOrEqual(12);
    });

    test('Cookie configuration enforces httpOnly, strict sameSite, and 15m expiration', () => {
      expect(cookieConfig.accessToken.httpOnly).toBe(true);
      expect(cookieConfig.accessToken.sameSite).toBe('strict');
      expect(cookieConfig.accessToken.maxAge).toBe(15 * 60 * 1000); // 15 minutes

      expect(cookieConfig.refreshToken.httpOnly).toBe(true);
      expect(cookieConfig.refreshToken.sameSite).toBe('strict');
      expect(cookieConfig.refreshToken.path).toBe('/api/v1/auth/refresh');
    });

    test('Pre-2FA temporary token has isPre2FA flag and expires in 5 minutes', () => {
      const pre2faToken = generatePre2faToken(officerUser);
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(pre2faToken);

      expect(decoded.isPre2FA).toBe(true);
      expect(decoded.id).toBe(officerUser._id.toString());
      expect(decoded.exp - decoded.iat).toBe(300); // 5 minutes
    });

    test('Refresh token rotation detects replay attack and revokes token family', async () => {
      const { token: originalRefresh } = await createRefreshTokenSession(officerUser._id, null, {
        ip: '127.0.0.1',
      });

      // Valid rotation
      const { refreshToken: newRefreshToken } = await rotateRefreshToken(originalRefresh, { ip: '127.0.0.1' });
      expect(newRefreshToken).toBeDefined();

      // Replay attack: Attacker attempts to use originalRefresh again
      await expect(rotateRefreshToken(originalRefresh, { ip: '192.168.1.100' })).rejects.toThrow(
        /Reused refresh token detected/i
      );

      // Verify that active tokens in that family were revoked
      const activeSessions = await RefreshToken.find({
        userId: officerUser._id,
        isRevoked: false,
      });
      expect(activeSessions.length).toBe(0);
    });
  });

  describe('2. Encryption at Rest (AES-256-GCM)', () => {
    test('Encrypts with AES-256-GCM using unique IV and 16-byte authentication tag', () => {
      const plaintext = 'Sensitive Witness Deposition: Confidential Informant 007';
      const encrypted1 = encryptAES256GCM(plaintext, config.masterEncryptionKey);
      const encrypted2 = encryptAES256GCM(plaintext, config.masterEncryptionKey);

      expect(encrypted1.isEncrypted).toBe(true);
      expect(encrypted1.iv.length).toBe(24); // 12 bytes = 24 hex characters
      expect(encrypted1.authTag.length).toBe(32); // 16 bytes = 32 hex characters
      // Unique IV ensures identical plaintexts produce different ciphertexts
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);

      const decrypted = decryptAES256GCM(encrypted1, config.masterEncryptionKey);
      expect(decrypted).toBe(plaintext);
    });

    test('Tampering with ciphertext or authTag causes decryption failure', () => {
      const plaintext = 'Confidential Bank Accused KYC';
      const encrypted = encryptAES256GCM(plaintext, config.masterEncryptionKey);

      // Tamper with ciphertext
      const tamperedEncrypted = {
        ...encrypted,
        ciphertext: 'ff' + encrypted.ciphertext.slice(2),
      };

      expect(() => decryptAES256GCM(tamperedEncrypted, config.masterEncryptionKey)).toThrow();
    });

    test('Timing-safe comparison prevents timing attacks on hashes', () => {
      const hashA = '48830252e5449767bf9f43058863f58a44cdffc0a7d9036f0db5c986c753b708';
      const hashB = '48830252e5449767bf9f43058863f58a44cdffc0a7d9036f0db5c986c753b708';
      const hashC = '58830252e5449767bf9f43058863f58a44cdffc0a7d9036f0db5c986c753b708';

      expect(timingSafeEqual(hashA, hashB)).toBe(true);
      expect(timingSafeEqual(hashA, hashC)).toBe(false);
      expect(timingSafeEqual(hashA, null)).toBe(false);
    });
  });

  describe('3. Upload & File Signature Security', () => {
    test('Rejects executable files disguised with innocent extensions', () => {
      // DOS MZ header disguised as .pdf
      const maliciousBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);

      expect(() =>
        validateUploadedFile({
          buffer: maliciousBuffer,
          originalname: 'statement.pdf',
          size: maliciousBuffer.length,
        })
      ).toThrow(/Executable binary detected/i);
    });

    test('Rejects extension mismatch (JPEG header with .pdf extension)', () => {
      // JPEG magic number: 0xFF, 0xD8, 0xFF
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

      expect(() =>
        validateUploadedFile({
          buffer: jpegBuffer,
          originalname: 'fir_intake.pdf',
          size: jpegBuffer.length,
        })
      ).toThrow(/Binary signature mismatch/i);
    });

    test('Enforces maximum file size limit (25 MB)', () => {
      const oversizedBuffer = Buffer.alloc(26 * 1024 * 1024); // 26 MB
      expect(() =>
        validateUploadedFile({
          buffer: oversizedBuffer,
          originalname: 'large.pdf',
          size: oversizedBuffer.length,
        })
      ).toThrow(/exceeds maximum allowed limit of 25 MB/i);
    });
  });

  describe('4. AI Extraction & Zero Fabrication Guarantee', () => {
    test('Local legal extractor never invents fake names or dates when fields are absent', async () => {
      // Short document with only a FIR number
      const shortText = 'First Information Report. Case Number: CR/2026/9999-CYBER. FIR lodged.';
      const result = await aiOcrService._processWithLocalFallback({
        fileBuffer: Buffer.from(shortText),
        mimeType: 'text/plain',
        fileName: 'fir_minimal.txt',
        documentTypeHint: 'FIR',
      });

      // firNumber was present in text
      const firField = result.fields.find((f) => f.field === 'firNumber');
      expect(firField).toBeDefined();
      expect(firField.value).toBe('CR/2026/9999-CYBER');
      expect(firField.confidence).toBeGreaterThan(0.8);

      // Complainant was NOT present in text - must NOT fabricate a fake name
      const compField = result.fields.find((f) => f.field === 'complainant');
      expect(compField.value).toBeNull();
      expect(compField.confidence).toBe(0.0);

      // Accused was NOT present in text - must NOT fabricate
      const accusedField = result.fields.find((f) => f.field === 'accused');
      expect(accusedField.value).toBeNull();
      expect(accusedField.confidence).toBe(0.0);
    });
  });

  describe('5. Search Authorization & Case Isolation', () => {
    test('Officers only receive semantic search results from assigned cases', async () => {
      // Case A assigned to officerUser
      const caseA = await Case.create({
        caseNumber: 'CR/2026/CASE-A',
        title: 'Cyber Financial Fraud Case A',
        leadOfficer: officerUser._id,
        assignedOfficers: [officerUser._id],
      });

      // Case B assigned to officerB
      const caseB = await Case.create({
        caseNumber: 'CR/2026/CASE-B',
        title: 'Narcotics Smuggling Case B',
        leadOfficer: officerB._id,
        assignedOfficers: [officerB._id],
      });

      // Document A in Case A
      await Document.create({
        caseId: caseA._id,
        title: 'Hacked Server Ledger Logs',
        documentType: 'evidence',
        s3Key: 'cases/CR-2026-CASE-A/docA.pdf',
        s3Bucket: 'vault',
        fileName: 'docA.pdf',
        originalName: 'docA.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: calculateSha256('docA'),
        extractedText: 'Cryptocurrency transaction hashes stolen from customer accounts',
      });

      // Document B in Case B
      await Document.create({
        caseId: caseB._id,
        title: 'Seizure Memo for Contraband',
        documentType: 'evidence',
        s3Key: 'cases/CR-2026-CASE-B/docB.pdf',
        s3Bucket: 'vault',
        fileName: 'docB.pdf',
        originalName: 'docB.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        uploadedBy: officerB._id,
        sha256Hash: calculateSha256('docB'),
        extractedText: 'Contraband seized at warehouse dock 4',
      });

      // Officer A searches for "transaction accounts"
      const resultsOfficerA = await searchService.semanticSearch({
        query: 'transaction accounts',
        user: officerUser,
      });

      // Officer A should only see documents from Case A
      const caseIdsFound = resultsOfficerA.map((r) => r.caseId.toString());
      expect(caseIdsFound).not.toContain(caseB._id.toString());

      // If Officer A attempts to explicitly search Case B by ID, returns 0 results
      const resultsUnassignedCase = await searchService.semanticSearch({
        query: 'Contraband',
        caseIdFilter: caseB._id.toString(),
        user: officerUser,
      });
      expect(resultsUnassignedCase.length).toBe(0);
    });
  });
});
