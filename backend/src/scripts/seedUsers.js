const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/database');
const { User, RefreshToken } = require('../models');
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

async function seed() {
  logger.info('Connecting to database to seed default role accounts...');
  await connectDB();

  // Clear existing users and tokens
  await User.deleteMany({ email: { $in: SEED_USERS.map((u) => u.email) } });
  await RefreshToken.deleteMany({});

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

    console.log(`[SEED] Created ${user.role.toUpperCase()}: ${user.email} (Badge: ${user.badgeNumber})`);
  }

  console.log('\n======================================================');
  console.log('✅ OFFICIAL SEED ACCOUNTS READY (Passwords: <Role>SecurePass123!)');
  console.log('1. Officer:  officer@police.gov.in      | TOTP Secret: KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD');
  console.log('2. Verifier: verifier@forensics.gov.in  | TOTP Secret: JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP');
  console.log('3. Admin:    admin@investigation.gov.in | TOTP Secret: MZXW6YTBOI2G63TOMZXW6YTBOI2G63TO');
  console.log('4. Auditor:  auditor@judiciary.gov.in   | TOTP Secret: NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP');
  console.log('======================================================\n');

  await disconnectDB();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
