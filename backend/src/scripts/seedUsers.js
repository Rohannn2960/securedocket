const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');
const { User, Case, Document, RefreshToken, CASE_STATUS, CASE_PRIORITY, DOCUMENT_STATUS, DOCUMENT_TYPES } = require('../models');
const { ROLES } = require('../constants/roles');
const s3Service = require('../services/s3.service');
const { calculateSha256 } = require('../utils/crypto');
const logger = require('../config/logger');

// Clean RFC 4648 unpadded base32 secrets for seed users
const SEED_USERS = [
  {
    name: 'Inspector Vikram Singh',
    email: 'officer@police.gov.in',
    password: 'OfficerSecurePass123!',
    role: ROLES.OFFICER,
    badgeNumber: 'CCB-9842',
    department: 'Central Cyber Crime Police Station',
    totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
  },
  {
    name: 'Sub-Inspector Ananya Rao',
    email: 'ananya.officer@police.gov.in',
    password: 'OfficerSecurePass123!',
    role: ROLES.OFFICER,
    badgeNumber: 'CCB-7719',
    department: 'Central Cyber Crime Police Station',
    totpSecret: 'KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD',
  },
  {
    name: 'Dr. Neha Sharma',
    email: 'verifier@forensics.gov.in',
    password: 'VerifierSecurePass123!',
    role: ROLES.VERIFIER,
    badgeNumber: 'CFSL-4412',
    department: 'Central Forensic Science Laboratory',
    totpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
  },
  {
    name: 'Administrator Dev Anand',
    email: 'admin@investigation.gov.in',
    password: 'AdminSecurePass123!',
    role: ROLES.ADMIN,
    badgeNumber: 'ADM-0001',
    department: 'Digital Evidence Administration Directorate',
    totpSecret: 'MZXW6YTBOI2G63TOMZXW6YTBOI2G63TO',
  },
  {
    name: 'Auditor S. K. Rao',
    email: 'auditor@judiciary.gov.in',
    password: 'AuditorSecurePass123!',
    role: ROLES.AUDITOR,
    badgeNumber: 'AUD-7731',
    department: 'Judicial Oversight & Audit Commission',
    totpSecret: 'NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP',
  },
];

const SEED_CASES = [
  {
    caseNumber: 'CR/2026/0891-BLR',
    title: 'Cyber Heist & Fake Invoicing Scheme',
    description: 'Investigation into unauthorized transaction routing and digital ledger tampering involving bogus shell suppliers.',
    status: CASE_STATUS.UNDER_INVESTIGATION,
    jurisdiction: 'Central Cyber Crime Police Station, Bengaluru',
    priority: CASE_PRIORITY.HIGH,
    tags: ['cybercrime', 'banking', 'forgery', 'ledger'],
    documents: [
      {
        title: 'Initial FIR on Cyber Fraud & Wire Transfer',
        fileName: 'FIR_2026_0891_Cyber_Heist.pdf',
        documentType: DOCUMENT_TYPES.FIR,
        mimeType: 'application/pdf',
        description: 'First Information Report lodged by State Bank Fraud Monitoring Cell',
        tags: ['FIR', 'cybercrime', 'wire_transfer'],
      },
      {
        title: 'Forged Vendor Invoices & Routing Slips',
        fileName: 'Forged_Invoices_Evidence.pdf',
        documentType: DOCUMENT_TYPES.EVIDENCE,
        mimeType: 'application/pdf',
        description: 'Altered tax invoices used to divert municipal procurement funds',
        tags: ['invoices', 'financial_forgery', 'evidence'],
      },
    ],
  },
  {
    caseNumber: 'CR/2026/0877-DEL',
    title: 'Narcotics Seizure & Forensic Ballistics Investigation',
    description: 'High-profile contraband recovery and firearm ballistics evidence matching against national ballistic records.',
    status: CASE_STATUS.PENDING_TRIAL,
    jurisdiction: 'Special Investigation Cell, New Delhi',
    priority: CASE_PRIORITY.CRITICAL,
    tags: ['narcotics', 'ballistics', 'special-cell'],
    documents: [
      {
        title: 'Contraband Seizure Memo & Chemical Analysis Report',
        fileName: 'CFSL_Chemical_Seizure_Report.pdf',
        documentType: DOCUMENT_TYPES.FORENSIC_REPORT,
        mimeType: 'application/pdf',
        description: 'Forensic chemical confirmation of seized contraband batch',
        tags: ['forensics', 'chemical', 'seizure'],
      },
    ],
  },
  {
    caseNumber: 'CR/2026/0862-MUM',
    title: 'Land Record Tampering & Forgery Syndicate',
    description: 'Systematic mutation record alteration across municipal archives; forensic OCR verification required.',
    status: CASE_STATUS.OPEN,
    jurisdiction: 'Economic Offences Wing, Mumbai',
    priority: CASE_PRIORITY.MEDIUM,
    tags: ['eow', 'land-records', 'forgery'],
    documents: [
      {
        title: 'Municipal Mutation Extract & Title Deed',
        fileName: 'Deed_Mutation_Extract_1998.pdf',
        documentType: DOCUMENT_TYPES.EVIDENCE,
        mimeType: 'application/pdf',
        description: 'Disputed cadastral record under suspicion of ink and page alteration',
        tags: ['land_record', 'cadastral', 'deed'],
      },
    ],
  },
  {
    caseNumber: 'CR/2026/0914-HYD',
    title: 'Identity Theft & Biometric Replay Fraud',
    description: 'Falsified credential generation and synthetic KYC verification bypass across digital payment gateways.',
    status: CASE_STATUS.UNDER_INVESTIGATION,
    jurisdiction: 'Cyber Crime Police Station, Hyderabad',
    priority: CASE_PRIORITY.HIGH,
    tags: ['biometrics', 'identity-theft', 'kyc-fraud'],
    documents: [
      {
        title: 'Synthetic KYC Biometric Logs & IP Audit',
        fileName: 'Biometric_Gateway_Audit_Logs.pdf',
        documentType: DOCUMENT_TYPES.EVIDENCE,
        mimeType: 'application/pdf',
        description: 'Raw server access logs and packet captures capturing credential injection',
        tags: ['biometrics', 'kyc', 'ip_audit'],
      },
      {
        title: 'Witness Deposition of Verification Officer',
        fileName: 'Deposition_Officer_Statement.pdf',
        documentType: DOCUMENT_TYPES.STATEMENT,
        mimeType: 'application/pdf',
        description: 'Statement recorded under CrPC Section 161 regarding portal breach discovery',
        tags: ['witness', 'statement', 'crpc161'],
      },
    ],
  },
];

async function seed() {
  logger.info('Connecting to database to seed default role accounts, cases, and vaulted documents...');
  await connectDB();

  // Clear existing users, cases, documents, and tokens
  await User.deleteMany({ email: { $in: SEED_USERS.map((u) => u.email) } });
  await Case.deleteMany({});
  await Document.deleteMany({});
  await RefreshToken.deleteMany({});

  const createdUsers = {};

  for (const userConfig of SEED_USERS) {
    const passwordHash = await User.hashPassword(userConfig.password);

    const user = await User.create({
      name: userConfig.name,
      email: userConfig.email,
      passwordHash,
      role: userConfig.role,
      badgeNumber: userConfig.badgeNumber,
      department: userConfig.department,
      totpSecret: userConfig.totpSecret,
      totpEnabled: true,
      totpVerifiedAt: new Date(),
      isActive: true,
    });

    createdUsers[user.email] = user;
    console.log(`[SEED] Created ${user.role.toUpperCase()}: ${user.email} (Badge: ${user.badgeNumber})`);
  }

  // Seed legal cases assigned to Inspector Vikram Singh & Sub-Inspector Ananya Rao
  const leadOfficer = createdUsers['officer@police.gov.in'];
  const secondOfficer = createdUsers['ananya.officer@police.gov.in'];

  for (const caseData of SEED_CASES) {
    const newCase = await Case.create({
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      description: caseData.description,
      status: caseData.status,
      jurisdiction: caseData.jurisdiction,
      leadOfficer: leadOfficer._id,
      assignedOfficers: [leadOfficer._id, secondOfficer._id],
      metadata: {
        priority: caseData.priority,
        tags: caseData.tags,
      },
    });

    console.log(`[SEED] Created CASE: ${newCase.caseNumber} - ${newCase.title} (Status: ${newCase.status})`);

    // Seed associated documents if defined
    if (caseData.documents && caseData.documents.length > 0) {
      for (const docInfo of caseData.documents) {
        const dummyDocMeta = {
          caseId: newCase,
          title: docInfo.title,
          fileName: docInfo.fileName,
          documentType: docInfo.documentType,
          mimeType: docInfo.mimeType,
          uploadedBy: leadOfficer,
        };

        const fileBuffer = s3Service.generateFallbackBuffer(dummyDocMeta);
        const sha256Hash = calculateSha256(fileBuffer);
        const cleanCaseNum = newCase.caseNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
        const s3Key = `cases/${cleanCaseNum}/${Date.now()}-${docInfo.fileName}`;

        await s3Service.uploadDocument({
          key: s3Key,
          fileBuffer,
          mimeType: docInfo.mimeType,
          metadata: {
            caseNumber: newCase.caseNumber,
            sha256Hash,
            uploadedBy: leadOfficer._id.toString(),
          },
        });

        const createdDoc = await Document.create({
          caseId: newCase._id,
          title: docInfo.title,
          documentType: docInfo.documentType,
          s3Key,
          s3Bucket: 'sih26190-secure-documents-vault',
          fileName: docInfo.fileName,
          originalName: docInfo.fileName,
          fileSize: fileBuffer.length,
          mimeType: docInfo.mimeType,
          uploadedBy: leadOfficer._id,
          sha256Hash,
          status: DOCUMENT_STATUS.VERIFIED,
          version: 1,
          versions: [
            {
              version: 1,
              s3Key,
              sha256Hash,
              fileSize: fileBuffer.length,
              mimeType: docInfo.mimeType,
              uploadedBy: leadOfficer._id,
              uploadedAt: new Date(),
              changeNotes: 'Initial evidentiary vault ingestion',
            },
          ],
          metadata: {
            description: docInfo.description,
            tags: docInfo.tags,
          },
        });

        console.log(`  📄 Vaulted Document: ${createdDoc.title} [SHA-256: ${createdDoc.sha256Hash.substring(0, 12)}...]`);
      }
    }
  }

  console.log('\n======================================================');
  console.log('✅ OFFICIAL SEED ACCOUNTS & CASES READY (Pass: <Role>SecurePass123!)');
  console.log('1. Officer:  officer@police.gov.in      | TOTP: KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD');
  console.log('2. Verifier: verifier@forensics.gov.in  | TOTP: JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
  console.log('3. Admin:    admin@investigation.gov.in | TOTP: MZXW6YTBOI2G63TOMZXW6YTBOI2G63TO');
  console.log('4. Auditor:  auditor@judiciary.gov.in   | TOTP: NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP');
  console.log('======================================================\n');

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
