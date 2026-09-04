const mongoose = require('mongoose');
const { connectToTestDb, closeTestDb } = require('./testDb');
const { AuditLog, User, Case, Document } = require('../src/models');
const { recordAuditEntry, verifyAuditChainIntegrity } = require('../src/services/audit.service');
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
});
