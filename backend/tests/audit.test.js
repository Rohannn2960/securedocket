const mongoose = require('mongoose');
const { connectToTestDb, closeTestDb } = require('./testDb');
const { AuditLog, User, Case, Document } = require('../src/models');
const { recordAuditEntry, verifyAuditChainIntegrity, extractClientIp } = require('../src/services/audit.service');
const { AUDIT_ACTIONS } = require('../src/constants/actions');
const { calculateAuditHash, GENESIS_HASH } = require('../src/utils/crypto');
const documentService = require('../src/services/document.service');
const { streamVaultDocument } = require('../src/controllers/document.controller');
const { ROLES } = require('../src/constants/roles');
const { calculateSha256 } = require('../src/utils/crypto');

beforeAll(async () => {
  await connectToTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

beforeEach(async () => {
  await AuditLog.deleteMany({});
});

describe('Tamper-Evident Audit Trail - Hash Chain Verification', () => {
  const dummyUserId = new mongoose.Types.ObjectId();
  const dummyDocId = new mongoose.Types.ObjectId();
  const dummyCaseId = new mongoose.Types.ObjectId();

  const createNormalChain = async (count = 3) => {
    for (let i = 0; i < count; i++) {
      await recordAuditEntry({
        userId: dummyUserId,
        action: AUDIT_ACTIONS.DOCUMENT_VIEW,
        documentId: dummyDocId,
        caseId: dummyCaseId,
        details: { index: i },
      });
    }
  };

  test('0. Successful document view should create exactly one DOCUMENT_VIEW audit entry', async () => {
    const user = await User.create({
      email: 'docview.audit@example.com',
      passwordHash: 'hashed123',
      name: 'Audit View User',
      role: ROLES.ADMIN,
    });

    const testCase = await Case.create({
      caseNumber: 'CASE-VIEW-AUDIT-01',
      title: 'View Audit Case',
      description: 'Audit regression case',
      leadOfficer: user._id,
      assignedOfficers: [user._id],
    });

    const buffer = Buffer.from('%PDF-1.4\nDocument view regression test');
    const sha256 = calculateSha256(buffer);

    const doc = await Document.create({
      caseId: testCase._id,
      title: 'View Audit Document',
      documentType: 'FIR',
      s3Key: 'cases/CASE-VIEW-AUDIT-01/view-audit-regression.pdf',
      s3Bucket: 'secure-vault',
      fileName: 'view-audit-regression.pdf',
      originalName: 'view-audit-regression.pdf',
      fileSize: buffer.length,
      mimeType: 'application/pdf',
      uploadedBy: user._id,
      sha256Hash: sha256,
      version: 1,
      versions: [{
        versionNumber: 1,
        version: 1,
        s3Key: 'cases/CASE-VIEW-AUDIT-01/view-audit-regression.pdf',
        sha256Hash: sha256,
        fileSize: buffer.length,
        mimeType: 'application/pdf',
        uploadedBy: user._id,
        editedBy: user._id,
        createdAt: new Date(),
        uploadedAt: new Date(),
        changeDescription: 'Initial secure ingestion',
        changeNotes: 'Initial secure ingestion',
      }],
      extractedFields: { docNumber: 'DOC-001' },
    });

    const generated = await documentService.generatePresignedViewUrl(doc._id, {
      id: user._id,
      role: user.role,
    });

    const parsedUrl = new URL(generated.url);
    const expires = parsedUrl.searchParams.get('expires');
    const signature = parsedUrl.searchParams.get('signature');

    const req = {
      params: { id: doc._id.toString() },
      query: { expires, signature, disposition: 'inline' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest-audit-regression' },
    };
    const res = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await streamVaultDocument(req, res);

    const viewLogs = await AuditLog.find({
      action: AUDIT_ACTIONS.DOCUMENT_VIEW,
      documentId: doc._id,
    }).sort({ timestamp: 1 });

    expect(viewLogs).toHaveLength(1);
    expect(viewLogs[0].userId.toString()).toBe(user._id.toString());
  });

  test('0b. Unauthorized vault stream should not create a successful DOCUMENT_VIEW audit entry', async () => {
    const user = await User.create({
      email: 'unauthorized.view@example.com',
      passwordHash: 'hashed123',
      name: 'Unauthorized Viewer',
      role: ROLES.OFFICER,
    });

    const testCase = await Case.create({
      caseNumber: 'CASE-UNAUTH-AUDIT-01',
      title: 'Unauthorized View Audit Case',
      description: 'Audit unauthorized access case',
      leadOfficer: user._id,
      assignedOfficers: [user._id],
    });

    const buffer = Buffer.from('%PDF-1.4\nUnauthorized access block');
    const sha256 = calculateSha256(buffer);

    const doc = await Document.create({
      caseId: testCase._id,
      title: 'Unauthorized Access Document',
      documentType: 'FIR',
      s3Key: 'cases/CASE-UNAUTH-AUDIT-01/unauthorized-view.pdf',
      s3Bucket: 'secure-vault',
      fileName: 'unauthorized-view.pdf',
      originalName: 'unauthorized-view.pdf',
      fileSize: buffer.length,
      mimeType: 'application/pdf',
      uploadedBy: user._id,
      sha256Hash: sha256,
      version: 1,
      versions: [{
        versionNumber: 1,
        version: 1,
        s3Key: 'cases/CASE-UNAUTH-AUDIT-01/unauthorized-view.pdf',
        sha256Hash: sha256,
        fileSize: buffer.length,
        mimeType: 'application/pdf',
        uploadedBy: user._id,
        editedBy: user._id,
        createdAt: new Date(),
        uploadedAt: new Date(),
        changeDescription: 'Initial secure ingestion',
        changeNotes: 'Initial secure ingestion',
      }],
      extractedFields: { docNumber: 'DOC-002' },
    });

    const futureExpiry = Math.floor(Date.now() / 1000) + 300;
    const invalidReq = {
      params: { id: doc._id.toString() },
      query: { expires: String(futureExpiry), signature: 'invalid-signature', disposition: 'inline' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'jest-audit-regression' },
    };
    const invalidRes = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await expect(streamVaultDocument(invalidReq, invalidRes)).rejects.toThrow(
      'Cryptographic signature mismatch: Access token is invalid or has been tampered with.'
    );

    const viewLogs = await AuditLog.find({
      action: AUDIT_ACTIONS.DOCUMENT_VIEW,
      documentId: doc._id,
    });

    expect(viewLogs).toHaveLength(0);
  });

  test('1. Normal chain passes verification', async () => {
    await createNormalChain(3);

    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(true);
    expect(result.checkedEntries).toBe(3);
  });

  test('2. Modified event payload fails verification', async () => {
    await createNormalChain(3);

    // Tamper with the 2nd record's details
    const records = await AuditLog.find().sort({ timestamp: 1 });
    const tamperedRecord = records[1];
    
    await AuditLog.collection.updateOne(
      { _id: tamperedRecord._id },
      { $set: { action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD } }
    );

    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PAYLOAD_HASH_TAMPERED');
    expect(result.firstBrokenEntry.toString()).toBe(tamperedRecord._id.toString());
  });

  test('3. Modified currentHash fails verification', async () => {
    await createNormalChain(3);

    const records = await AuditLog.find().sort({ timestamp: 1 });
    const tamperedRecord = records[1];
    
    // Change the hash slightly
    const fakeHash = 'f'.repeat(64);
    await AuditLog.collection.updateOne(
      { _id: tamperedRecord._id },
      { $set: { currentHash: fakeHash } }
    );

    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PAYLOAD_HASH_TAMPERED'); 
  });

  test('4. Modified previousHash fails verification', async () => {
    await createNormalChain(3);

    const records = await AuditLog.find().sort({ timestamp: 1 });
    const tamperedRecord = records[1];
    
    // Tamper with previousHash
    const fakeHash = 'a'.repeat(64);
    await AuditLog.collection.updateOne(
      { _id: tamperedRecord._id },
      { $set: { previousHash: fakeHash } }
    );

    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PREVIOUS_HASH_MISMATCH');
    expect(result.firstBrokenEntry.toString()).toBe(tamperedRecord._id.toString());
  });

  test('5. Deleted/interrupted entry is detected', async () => {
    await createNormalChain(4);

    const records = await AuditLog.find().sort({ timestamp: 1 });
    // Delete the 2nd record
    await AuditLog.collection.deleteOne({ _id: records[1]._id });

    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PREVIOUS_HASH_MISMATCH');
    // It should detect the break at what is now index 1 (originally index 2)
    expect(result.firstBrokenEntry.toString()).toBe(records[2]._id.toString());
  });

  test('6. Reordered events are detected', async () => {
    await createNormalChain(3);

    const records = await AuditLog.find().sort({ timestamp: 1 });
    
    // Swap the timestamps of record 1 and 2 to change the sort order
    await AuditLog.collection.updateOne(
      { _id: records[1]._id },
      { $set: { timestamp: records[2].timestamp } }
    );
    await AuditLog.collection.updateOne(
      { _id: records[2]._id },
      { $set: { timestamp: records[1].timestamp } }
    );

    const result = await verifyAuditChainIntegrity();
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('PREVIOUS_HASH_MISMATCH');
  });

  describe('7. Server-Side IP Address Tracking & Hash-Chain Security', () => {
    test('Records server-derived IPv4 address and ignores frontend/body spoofed IP', async () => {
      const mockReq = {
        ip: '198.51.100.23',
        headers: { 'user-agent': 'SecureBrowser/2.0' },
        body: { ipAddress: '10.99.99.99' }, // Attacker trying to spoof IP in body
        query: { ipAddress: '172.16.0.1' }, // Attacker trying to spoof IP in query
      };

      const entry = await recordAuditEntry({
        userId: dummyUserId,
        action: AUDIT_ACTIONS.CASE_CREATE,
        caseId: dummyCaseId,
        details: { caseNumber: 'TEST/IP/01' },
        req: mockReq,
        ipAddress: '10.99.99.99', // Direct param attempt must also be overridden by req
      });

      expect(entry.ipAddress).toBe('198.51.100.23');
      expect(entry.ipAddress).not.toBe('10.99.99.99');
      expect(entry.userAgent).toBe('SecureBrowser/2.0');

      // Verify chain succeeds with this real IP
      const result = await verifyAuditChainIntegrity();
      expect(result.valid).toBe(true);
    });

    test('Properly handles and unmaps IPv4-mapped IPv6 addresses (::ffff:)', async () => {
      const mockReq = {
        ip: '::ffff:192.0.2.146',
        headers: { 'user-agent': 'NodeAgent' },
      };

      const entry = await recordAuditEntry({
        userId: dummyUserId,
        action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
        documentId: dummyDocId,
        req: mockReq,
      });

      expect(entry.ipAddress).toBe('192.0.2.146');
    });

    test('Supports native IPv6 addresses without corruption', async () => {
      const nativeIpv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const mockReq = {
        ip: nativeIpv6,
        headers: { 'user-agent': 'IPv6Client' },
      };

      const entry = await recordAuditEntry({
        userId: dummyUserId,
        action: AUDIT_ACTIONS.DOCUMENT_VERIFY,
        documentId: dummyDocId,
        req: mockReq,
      });

      expect(entry.ipAddress).toBe(nativeIpv6);

      const result = await verifyAuditChainIntegrity();
      expect(result.valid).toBe(true);
    });

    test('IP address is included in currentHash; tampering with stored IP breaks chain verification', async () => {
      const mockReq = {
        ip: '203.0.113.88',
        headers: { 'user-agent': 'TestAgent' },
      };

      const entry = await recordAuditEntry({
        userId: dummyUserId,
        action: AUDIT_ACTIONS.DOCUMENT_FIELD_CORRECT,
        documentId: dummyDocId,
        details: { field: 'accusedName' },
        req: mockReq,
      });

      // Chain should be 100% valid initially
      let result = await verifyAuditChainIntegrity();
      expect(result.valid).toBe(true);

      // Maliciously tamper with the stored IP address in the database
      await AuditLog.collection.updateOne(
        { _id: entry._id },
        { $set: { ipAddress: '198.51.100.99' } }
      );

      // Verify chain MUST detect tampering because IP participated in currentHash
      result = await verifyAuditChainIntegrity();
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('PAYLOAD_HASH_TAMPERED');
      expect(result.firstBrokenEntry.toString()).toBe(entry._id.toString());
    });

    test('Fallback to socket remoteAddress when req.ip is not directly set', () => {
      const mockReq = {
        socket: { remoteAddress: '192.168.1.150' },
      };
      const extracted = extractClientIp(mockReq);
      expect(extracted).toBe('192.168.1.150');
    });

    test('Does not create duplicate audit entries', async () => {
      const initialCount = await AuditLog.countDocuments();
      const mockReq = { ip: '10.0.0.5' };

      await recordAuditEntry({
        userId: dummyUserId,
        action: AUDIT_ACTIONS.DOCUMENT_VIEW,
        documentId: dummyDocId,
        req: mockReq,
      });

      const finalCount = await AuditLog.countDocuments();
      expect(finalCount).toBe(initialCount + 1);
    });
  });
});
