const mongoose = require('mongoose');
const { connectToTestDb, closeTestDb } = require('./testDb');
const intelligenceService = require('../src/services/intelligence.service');
const { Case, Document, User } = require('../src/models');
const { ROLES } = require('../src/constants/roles');

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
});

describe('Phase 8: Case Intelligence - Timeline & Entity Linking Engine', () => {
  let adminUser, officerUser, unauthorizedOfficer;
  let caseA, caseB;

  beforeEach(async () => {
    adminUser = await User.create({
      email: 'admin.intel@example.com',
      passwordHash: 'hashed123',
      name: 'Director Sharma',
      role: ROLES.ADMIN,
      organization: 'CID Headquarters',
    });

    officerUser = await User.create({
      email: 'officer.assigned@example.com',
      passwordHash: 'hashed123',
      name: 'Inspector Rajan',
      role: ROLES.OFFICER,
      organization: 'Crime Branch',
    });

    unauthorizedOfficer = await User.create({
      email: 'officer.unauth@example.com',
      passwordHash: 'hashed123',
      name: 'Sub-Inspector Verma',
      role: ROLES.OFFICER,
      organization: 'Traffic Division',
    });

    caseA = await Case.create({
      caseNumber: 'CR/2026/0891-BLR',
      title: 'Cyber Heist & Vault Tampering',
      status: 'under_investigation',
      leadOfficer: officerUser._id,
      assignedOfficers: [officerUser._id],
    });

    caseB = await Case.create({
      caseNumber: 'CR/2026/0999-MUM',
      title: 'Unrelated Corporate Fraud Case',
      status: 'open',
      leadOfficer: adminUser._id,
      assignedOfficers: [],
    });
  });

  describe('1. Case Chronological Timeline Generation', () => {
    it('should extract events from multiple documents and sort them chronologically', async () => {
      // Doc 1: FIR (Incident on 10 Jan 2026, Registered on 12 Jan 2026)
      await Document.create({
        caseId: caseA._id,
        title: 'Certified FIR No. 891/26',
        documentType: 'FIR',
        s3Key: 'fir_key_01',
        s3Bucket: 'test-bucket',
        fileName: 'fir_891.pdf',
        originalName: 'fir_891.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: 'a'.repeat(64),
        extractedFields: {
          incidentDate: { value: '2026-01-10T14:30:00.000Z', confidence: 0.95, sourceReference: 'Para 1' },
          filingDate: { value: '2026-01-12T10:00:00.000Z', confidence: 0.98 },
          firNumber: { value: 'FIR 891/26' },
          policeStation: { value: 'Cyber Crime PS' },
          incidentLocation: { value: 'MG Road Branch' },
        },
      });

      // Doc 2: Witness Statement (Recorded on 15 Jan 2026)
      await Document.create({
        caseId: caseA._id,
        title: 'Witness Statement - Bank Teller',
        documentType: 'statement',
        s3Key: 'stmt_key_01',
        s3Bucket: 'test-bucket',
        fileName: 'statement_teller.pdf',
        originalName: 'statement_teller.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: 'b'.repeat(64),
        extractedFields: {
          statementDate: { value: '15/01/2026', confidence: 0.92, sourceReference: 'Header' },
          witnessName: { value: 'Ravi Kumar' },
        },
      });

      // Doc 3: Forensic Lab Report (Concluded on 20 Jan 2026)
      await Document.create({
        caseId: caseA._id,
        title: 'CFSL Digital Forensics Report',
        documentType: 'forensic_report',
        s3Key: 'forensic_key_01',
        s3Bucket: 'test-bucket',
        fileName: 'cfsl_report.pdf',
        originalName: 'cfsl_report.pdf',
        fileSize: 4096,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: 'c'.repeat(64),
        extractedFields: {
          examinationDate: { value: '2026-01-20T18:00:00.000Z', confidence: 0.96 },
          reportNumber: { value: 'CFSL/2026/D-401' },
          laboratory: { value: 'Central Forensic Science Laboratory' },
          findings: { value: 'Malicious firmware injected via USB' },
        },
      });

      const timelineResult = await intelligenceService.generateCaseTimeline(caseA._id, officerUser);

      expect(timelineResult.timeline).toBeDefined();
      expect(timelineResult.totalEvents).toBe(4); // Incident, FIR, Statement, Forensics

      // Verify Chronological Order: 10 Jan -> 12 Jan -> 15 Jan -> 20 Jan
      const dates = timelineResult.certainEvents.map((e) => new Date(e.date).getTime());
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
      }

      // Verify event types
      const types = timelineResult.timeline.map((e) => e.eventType);
      expect(types).toContain('incident_occurred');
      expect(types).toContain('fir_registered');
      expect(types).toContain('statement_recorded');
      expect(types).toContain('forensic_examination');

      // Verify source document IDs link back correctly
      expect(timelineResult.timeline[0].sourceDocumentId).toBeDefined();
      expect(timelineResult.timeline[0].sourceDocumentTitle).toBeDefined();
    });

    it('should flag unparseable or low-confidence dates as isUncertain rather than inventing dates', async () => {
      await Document.create({
        caseId: caseA._id,
        title: 'Corrupted Note',
        documentType: 'statement',
        s3Key: 'corrupt_key_01',
        s3Bucket: 'test-bucket',
        fileName: 'corrupt.pdf',
        originalName: 'corrupt.pdf',
        fileSize: 512,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: 'd'.repeat(64),
        extractedFields: {
          statementDate: { value: 'some vague winter day in 2026', confidence: 0.45 },
          witnessName: { value: 'Anonymous Informant' },
        },
      });

      const res = await intelligenceService.generateCaseTimeline(caseA._id, officerUser);
      expect(res.uncertainEvents.length).toBeGreaterThan(0);
      expect(res.uncertainEvents[0].isUncertain).toBe(true);
      expect(res.uncertainEvents[0].date).toBeNull();
    });
  });

  describe('2. Cross-Document Entity Linking & Normalization', () => {
    it('should identify and link the same entity across multiple documents within a case', async () => {
      // Document 1 (FIR): Mentions Accused "Shri Ravi Kumar" and Location "Indiranagar Police Station"
      await Document.create({
        caseId: caseA._id,
        title: 'Initial FIR Report',
        documentType: 'FIR',
        s3Key: 'doc_fir_01',
        s3Bucket: 'test-bucket',
        fileName: 'fir.pdf',
        originalName: 'fir.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: 'e'.repeat(64),
        extractedFields: {
          accused: { value: 'Shri Ravi Kumar', confidence: 0.94 },
          policeStation: { value: 'Indiranagar Police Station', confidence: 0.90 },
          incidentLocation: { value: 'MG Road Axis Bank', confidence: 0.88 },
        },
        extractedText: 'Accused Shri Ravi Kumar was apprehended near MG Road Axis Bank...',
      });

      // Document 2 (Statement): Mentions Witness "Ravi Kumar"
      await Document.create({
        caseId: caseA._id,
        title: 'Interrogation Transcript',
        documentType: 'statement',
        s3Key: 'doc_stmt_02',
        s3Bucket: 'test-bucket',
        fileName: 'interrogation.pdf',
        originalName: 'interrogation.pdf',
        fileSize: 2048,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: 'f'.repeat(64),
        extractedFields: {
          witnessName: { value: 'Ravi Kumar', confidence: 0.92 },
          location: { value: 'MG Road Axis Bank', confidence: 0.85 },
        },
        extractedText: 'Statement of Ravi Kumar regarding the midnight transfer at MG Road Axis Bank...',
      });

      // Document 3 (Evidence): Mentions physical evidence seized from "Ravi Kumar"
      await Document.create({
        caseId: caseA._id,
        title: 'Seizure Memo for Hard Drive',
        documentType: 'evidence',
        s3Key: 'doc_seizure_03',
        s3Bucket: 'test-bucket',
        fileName: 'seizure.pdf',
        originalName: 'seizure.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: '1'.repeat(64),
        extractedFields: {
          evidenceIdentifier: { value: 'EVD-2026-USB-01', confidence: 0.99 },
          person_name: { value: 'RAVI KUMAR', confidence: 0.95 },
        },
        extractedText: 'Seized 1x SanDisk USB Drive (EVD-2026-USB-01) from RAVI KUMAR...',
      });

      const entitiesResult = await intelligenceService.extractCaseEntities(caseA._id, officerUser);

      expect(entitiesResult.entities).toBeDefined();

      // "Ravi Kumar" should be linked across all 3 documents
      const raviEntity = entitiesResult.entities.find(
        (e) => e.canonicalName.toLowerCase() === 'ravi kumar' && e.category === 'person'
      );

      expect(raviEntity).toBeDefined();
      expect(raviEntity.distinctDocumentCount).toBe(3);
      expect(raviEntity.isMultiDocument).toBe(true);
      expect(raviEntity.mentionCount).toBe(3);
      expect(raviEntity.aliases).toContain('Shri Ravi Kumar');
      expect(raviEntity.aliases).toContain('Ravi Kumar');
      expect(raviEntity.aliases).toContain('RAVI KUMAR');
      expect(raviEntity.linkedDocuments.length).toBe(3);
      expect(raviEntity.confidence).toBeGreaterThan(0.90);

      // "MG Road Axis Bank" location should be linked across 2 documents
      const bankEntity = entitiesResult.entities.find(
        (e) => e.canonicalName.toLowerCase().includes('axis bank')
      );
      expect(bankEntity).toBeDefined();
      expect(bankEntity.distinctDocumentCount).toBe(2);
    });
  });

  describe('3. Case Isolation Guarantee', () => {
    it('should strictly isolate entities within the target case and NEVER link across cases', async () => {
      // Case A document with person "Vikram Malhotra"
      await Document.create({
        caseId: caseA._id,
        title: 'Case A Statement',
        documentType: 'statement',
        s3Key: 'doc_case_a',
        s3Bucket: 'test-bucket',
        fileName: 'case_a.pdf',
        originalName: 'case_a.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: '2'.repeat(64),
        extractedFields: {
          person_name: { value: 'Vikram Malhotra', confidence: 0.95 },
        },
      });

      // Case B document with the SAME person name "Vikram Malhotra"
      await Document.create({
        caseId: caseB._id,
        title: 'Case B Statement',
        documentType: 'statement',
        s3Key: 'doc_case_b',
        s3Bucket: 'test-bucket',
        fileName: 'case_b.pdf',
        originalName: 'case_b.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: adminUser._id,
        sha256Hash: '3'.repeat(64),
        extractedFields: {
          person_name: { value: 'Vikram Malhotra', confidence: 0.95 },
        },
      });

      // Query intelligence for Case A
      const caseAEntities = await intelligenceService.extractCaseEntities(caseA._id, officerUser);
      const caseAPerson = caseAEntities.entities.find((e) => e.canonicalName === 'Vikram Malhotra');

      expect(caseAPerson).toBeDefined();
      // Case A must ONLY have 1 document linked (not 2 from both cases!)
      expect(caseAPerson.distinctDocumentCount).toBe(1);
      expect(caseAPerson.linkedDocuments.every((d) => d.documentTitle === 'Case A Statement')).toBe(true);

      // Query intelligence for Case B
      const caseBEntities = await intelligenceService.extractCaseEntities(caseB._id, adminUser);
      const caseBPerson = caseBEntities.entities.find((e) => e.canonicalName === 'Vikram Malhotra');

      expect(caseBPerson).toBeDefined();
      expect(caseBPerson.distinctDocumentCount).toBe(1);
      expect(caseBPerson.linkedDocuments.every((d) => d.documentTitle === 'Case B Statement')).toBe(true);
    });
  });

  describe('4. Authorization & Security Boundaries', () => {
    it('should reject unauthorized officer attempting to view case intelligence', async () => {
      await expect(
        intelligenceService.getCaseIntelligence(caseA._id, unauthorizedOfficer)
      ).rejects.toThrow(/Access forbidden/);
    });

    it('should permit assigned officer and administrator to access case intelligence', async () => {
      const officerRes = await intelligenceService.getCaseIntelligence(caseA._id, officerUser);
      expect(officerRes.summary).toBeDefined();

      const adminRes = await intelligenceService.getCaseIntelligence(caseA._id, adminUser);
      expect(adminRes.summary).toBeDefined();
    });
  });

  describe('5. Case-to-Case Similarity & Relationship Intelligence', () => {
    it('should calculate very high similarity for identical case representations and low similarity for unrelated cases', () => {
      const baseProfile = {
        caseId: 'case_1',
        caseNumber: 'CR/001',
        title: 'Cyber Fraud Investigation',
        jurisdiction: 'Bangalore City',
        status: 'under_investigation',
        personEntities: new Set(['ravi kumar', 'ananya roy']),
        orgEntities: new Set(['axis bank']),
        locationEntities: new Set(['mg road', 'koramangala']),
        legalSections: new Set(['ipc 420', 'it act 66d']),
        embeddingVectors: [[0.5, 0.5, 0.5]],
      };

      const identicalProfile = {
        caseId: 'case_2',
        caseNumber: 'CR/002',
        title: 'Parallel Cyber Investigation',
        jurisdiction: 'Bangalore City',
        status: 'under_investigation',
        personEntities: new Set(['ravi kumar', 'ananya roy']),
        orgEntities: new Set(['axis bank']),
        locationEntities: new Set(['mg road', 'koramangala']),
        legalSections: new Set(['ipc 420', 'it act 66d']),
        embeddingVectors: [[0.5, 0.5, 0.5]],
      };

      const unrelatedProfile = {
        caseId: 'case_3',
        caseNumber: 'CR/003',
        title: 'Maritime Poaching Incident',
        jurisdiction: 'Cochin Harbour',
        status: 'open',
        personEntities: new Set(['george varghese']),
        orgEntities: new Set(['fisheries board']),
        locationEntities: new Set(['mattancherry']),
        legalSections: new Set(['wildlife act 9']),
        embeddingVectors: [[-0.5, -0.5, -0.5]],
      };

      const identicalResult = intelligenceService.calculateProfileSimilarity(baseProfile, identicalProfile);
      expect(identicalResult.similarityScore).toBeGreaterThanOrEqual(0.90);
      expect(identicalResult.confidenceLevel).toBe('high');
      expect(identicalResult.relationshipType).toBe('strongly_related');
      expect(identicalResult.reasons.length).toBeGreaterThan(0);

      const unrelatedResult = intelligenceService.calculateProfileSimilarity(baseProfile, unrelatedProfile);
      expect(unrelatedResult.similarityScore).toBe(0);
      expect(unrelatedResult.confidenceLevel).toBe('low');
      expect(unrelatedResult.reasons.length).toBe(0);
    });

    it('should demonstrate that individual signals (entity, location, section, semantic) increase similarity and provide explainable reasons', () => {
      const base = {
        personEntities: new Set(['suspect x']),
        orgEntities: new Set(),
        locationEntities: new Set(['indiranagar']),
        legalSections: new Set(['ipc 379']),
        embeddingVectors: [],
      };

      // Case with no overlap
      const noOverlap = {
        personEntities: new Set(['someone else']),
        orgEntities: new Set(),
        locationEntities: new Set(['whitefield']),
        legalSections: new Set(['ipc 302']),
        embeddingVectors: [],
      };
      const scoreZero = intelligenceService.calculateProfileSimilarity(base, noOverlap);
      expect(scoreZero.similarityScore).toBe(0);

      // Shared entity only
      const sharedEntity = {
        personEntities: new Set(['suspect x']),
        orgEntities: new Set(),
        locationEntities: new Set(['whitefield']),
        legalSections: new Set(['ipc 302']),
        embeddingVectors: [],
      };
      const scoreEntity = intelligenceService.calculateProfileSimilarity(base, sharedEntity);
      expect(scoreEntity.similarityScore).toBeGreaterThan(0);
      expect(scoreEntity.reasons.some((r) => r.includes('Shared entity reference'))).toBe(true);

      // Shared location only
      const sharedLocation = {
        personEntities: new Set(['someone else']),
        orgEntities: new Set(),
        locationEntities: new Set(['indiranagar']),
        legalSections: new Set(['ipc 302']),
        embeddingVectors: [],
      };
      const scoreLocation = intelligenceService.calculateProfileSimilarity(base, sharedLocation);
      expect(scoreLocation.similarityScore).toBeGreaterThan(0);
      expect(scoreLocation.reasons.some((r) => r.includes('Shared location'))).toBe(true);

      // Shared legal section only
      const sharedSection = {
        personEntities: new Set(['someone else']),
        orgEntities: new Set(),
        locationEntities: new Set(['whitefield']),
        legalSections: new Set(['ipc 379']),
        embeddingVectors: [],
      };
      const scoreSection = intelligenceService.calculateProfileSimilarity(base, sharedSection);
      expect(scoreSection.similarityScore).toBeGreaterThan(0);
      expect(scoreSection.reasons.some((r) => r.includes('Matching legal statute'))).toBe(true);

      // Semantic vectors only
      const baseWithVector = {
        ...base,
        embeddingVectors: [[1, 0, 0]],
      };
      const matchingVector = {
        ...noOverlap,
        embeddingVectors: [[1, 0, 0]],
      };
      const scoreVector = intelligenceService.calculateProfileSimilarity(baseWithVector, matchingVector);
      expect(scoreVector.similarityScore).toBeGreaterThan(0);
      expect(scoreVector.reasons.some((r) => r.includes('High semantic similarity'))).toBe(true);
    });

    it('should be strictly deterministic across repeated runs', () => {
      const profileA = {
        personEntities: new Set(['john doe']),
        orgEntities: new Set(['acme corp']),
        locationEntities: new Set(['mumbai']),
        legalSections: new Set(['ipc 420']),
        embeddingVectors: [[0.3, 0.4, 0.5]],
      };
      const profileB = {
        personEntities: new Set(['john doe']),
        orgEntities: new Set(),
        locationEntities: new Set(['mumbai']),
        legalSections: new Set(['ipc 420']),
        embeddingVectors: [[0.3, 0.4, 0.5]],
      };

      const run1 = intelligenceService.calculateProfileSimilarity(profileA, profileB);
      const run2 = intelligenceService.calculateProfileSimilarity(profileA, profileB);

      expect(run1.similarityScore).toBe(run2.similarityScore);
      expect(run1.confidenceLevel).toBe(run2.confidenceLevel);
      expect(run1.relationshipType).toBe(run2.relationshipType);
      expect(run1.reasons).toEqual(run2.reasons);
    });

    it('should handle empty or missing embeddings without crashing', () => {
      const profileEmptyVectors = {
        personEntities: new Set(['entity a']),
        orgEntities: new Set(),
        locationEntities: new Set(['city b']),
        legalSections: new Set(['section c']),
        embeddingVectors: [],
      };
      const profileNullVectors = {
        personEntities: new Set(['entity a']),
        orgEntities: new Set(),
        locationEntities: new Set(['city b']),
        legalSections: new Set(['section c']),
        embeddingVectors: [],
      };

      expect(() => {
        const result = intelligenceService.calculateProfileSimilarity(profileEmptyVectors, profileNullVectors);
        expect(result.similarityScore).toBeGreaterThan(0);
      }).not.toThrow();
    });

    it('should enforce strict server-side RBAC: Officer cannot discover unassigned cases through similarity', async () => {
      // Create Case C assigned to Officer
      const caseC = await Case.create({
        caseNumber: 'CR/2026/0101-BLR',
        title: 'Case C - Assigned to Officer',
        status: 'under_investigation',
        leadOfficer: officerUser._id,
        assignedOfficers: [officerUser._id],
      });

      // Case A document with person "Mohan Lal"
      await Document.create({
        caseId: caseA._id,
        title: 'Case A FIR',
        documentType: 'FIR',
        s3Key: 'key_a_fir',
        s3Bucket: 'test-bucket',
        fileName: 'a_fir.pdf',
        originalName: 'a_fir.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: '4'.repeat(64),
        extractedFields: {
          person_name: { value: 'Mohan Lal', confidence: 0.95 },
          legal_section: { value: 'IPC 420', confidence: 0.95 },
        },
      });

      // Case B (NOT assigned to Officer, owned by Admin) has the SAME person and section
      await Document.create({
        caseId: caseB._id,
        title: 'Case B Charge Sheet',
        documentType: 'chargesheet',
        s3Key: 'key_b_cs',
        s3Bucket: 'test-bucket',
        fileName: 'b_cs.pdf',
        originalName: 'b_cs.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: adminUser._id,
        sha256Hash: '5'.repeat(64),
        extractedFields: {
          person_name: { value: 'Mohan Lal', confidence: 0.95 },
          legal_section: { value: 'IPC 420', confidence: 0.95 },
        },
      });

      // Case C (Assigned to Officer) also has the SAME person and section
      await Document.create({
        caseId: caseC._id,
        title: 'Case C Statement',
        documentType: 'statement',
        s3Key: 'key_c_stmt',
        s3Bucket: 'test-bucket',
        fileName: 'c_stmt.pdf',
        originalName: 'c_stmt.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: officerUser._id,
        sha256Hash: '6'.repeat(64),
        extractedFields: {
          person_name: { value: 'Mohan Lal', confidence: 0.95 },
          legal_section: { value: 'IPC 420', confidence: 0.95 },
        },
      });

      // 1. Officer queries relationships for Case A
      const officerRelations = await intelligenceService.getCaseRelationships(caseA._id, officerUser);

      // Officer must ONLY see Case C, NOT Case B (Case B is unauthorized!)
      const targetCaseIds = officerRelations.relationships.map((r) => r.targetCaseId.toString());
      expect(targetCaseIds).toContain(caseC._id.toString());
      expect(targetCaseIds).not.toContain(caseB._id.toString());

      // 2. Admin queries relationships for Case A
      // Admin is authorized across cases, so Admin should see both Case B and Case C
      const adminRelations = await intelligenceService.getCaseRelationships(caseA._id, adminUser);
      const adminTargetIds = adminRelations.relationships.map((r) => r.targetCaseId.toString());
      expect(adminTargetIds).toContain(caseB._id.toString());
      expect(adminTargetIds).toContain(caseC._id.toString());

      // 3. Officer attempts to query relationships for Case B (unauthorized target) -> Must throw 403
      await expect(
        intelligenceService.getCaseRelationships(caseB._id, officerUser)
      ).rejects.toThrow(/Access forbidden/);
    });
  });
});
