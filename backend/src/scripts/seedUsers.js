const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');
const { User, Case, RefreshToken, CASE_STATUS, CASE_PRIORITY } = require('../models');
const { ROLES } = require('../constants/roles');
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
  },
  {
    caseNumber: 'CR/2026/0877-DEL',
    title: 'Narcotics Seizure & Forensic Ballistics Investigation',
    description: 'High-profile contraband recovery and firearm ballistics evidence matching against national ballistic records.',
    status: CASE_STATUS.PENDING_TRIAL,
    jurisdiction: 'Special Investigation Cell, New Delhi',
    priority: CASE_PRIORITY.CRITICAL,
    tags: ['narcotics', 'ballistics', 'special-cell'],
  },
  {
    caseNumber: 'CR/2026/0862-MUM',
    title: 'Land Record Tampering & Forgery Syndicate',
    description: 'Systematic mutation record alteration across municipal archives; forensic OCR verification required.',
    status: CASE_STATUS.OPEN,
    jurisdiction: 'Economic Offences Wing, Mumbai',
    priority: CASE_PRIORITY.MEDIUM,
    tags: ['eow', 'land-records', 'forgery'],
  },
  {
    caseNumber: 'CR/2026/0914-HYD',
    title: 'Identity Theft & Biometric Replay Fraud',
    description: 'Falsified credential generation and synthetic KYC verification bypass across digital payment gateways.',
    status: CASE_STATUS.UNDER_INVESTIGATION,
    jurisdiction: 'Cyber Crime Police Station, Hyderabad',
    priority: CASE_PRIORITY.HIGH,
    tags: ['biometrics', 'identity-theft', 'kyc-fraud'],
  },
];

async function seed() {
  logger.info('Connecting to database to seed default role accounts and active legal cases...');
  await connectDB();

  // Clear existing users, cases, and tokens
  await User.deleteMany({ email: { $in: SEED_USERS.map((u) => u.email) } });
  await Case.deleteMany({});
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
