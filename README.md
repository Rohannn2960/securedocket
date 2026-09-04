# SecureDocket — Secure Digital Document Management System (SIH Problem Statement 26190)

A high-integrity, tamper-evident digital document management platform engineered for **law enforcement agencies, legal departments, courts, and forensic investigation units**.

SecureDocket provides end-to-end evidentiary custody for legal case documents, featuring cryptographic SHA-256 sealing, server-side IP address tracking sealed in a hash chain, field-level AES-256-GCM encryption, bilingual AI OCR with human-in-the-loop verification, authorized semantic vector search, and cross-case similarity intelligence.

---

## 🏛️ System Architecture

```
                    ┌─────────────────────────┐
                    │  React + Vite Frontend  │
                    │   Tailwind + Router v6  │
                    └────────────┬────────────┘
                                 │ HTTPS (withCredentials: true)
                                 ▼
                    ┌─────────────────────────┐
                    │  Express.js API Gateway │
                    │                         │
                    │ • Strict RBAC & TOTP    │
                    │ • Server-Side IP Audit  │
                    │ • AES-256-GCM Encryption│
                    │ • Cryptographic Hashing │
                    │ • AI OCR & Anti-Spoofing│
                    │ • Cross-Case Intel      │
                    │ • Vector Search Engine  │
                    └──────────┬──────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌────────────────────────┐             ┌────────────────────────┐
│     MongoDB Atlas      │             │  Encrypted File Vault  │
│                        │             │                        │
│ • Case Dossiers        │             │ • SSE-S3 / Local Vault │
│ • Document Metadata    │             │ • AES-256 Storage      │
│ • SHA-256 Signatures   │             │ • Presigned Streaming  │
│ • Hash-Chained Audits  │             │ • Zero DB File Bloat   │
│ • Extracted Entities   │             └────────────────────────┘
│ • Vector Embeddings    │
└────────────────────────┘
```

---

## 🔐 Core Security & Compliance Model

1. **Defense-in-Depth Authentication & Session Security**:
   - Short-lived JWT Access Tokens (15m window).
   - Refresh Token Rotation in `httpOnly`, `secure`, `sameSite=strict` cookies with automatic family revocation upon replay attack detection.
   - Password hashing via `bcrypt` with **12 salt rounds**.
   - Mandatory Two-Factor Authentication (**TOTP**) with RFC 6238 compliant verification and time-step drift tolerance.

2. **Zero Raw File Storage in Database**:
   - MongoDB stores **only** document metadata, extracted structured fields, and SHA-256 cryptographic signatures.
   - Files are stored in an encrypted vault (AWS S3 with SSE-S3 AES-256 or local encrypted filesystem abstraction) accessible only via short-lived (5-minute) HMAC-signed presigned URLs.

3. **Field-Level Encryption at Rest (AES-256-GCM)**:
   - Sensitive extracted metadata (accused names, financial identifiers, complainant details) are encrypted at rest using AES-256-GCM with unique 12-byte IVs and 16-byte authentication tags.
   - Plaintext values are never leaked in unauthenticated contexts.

4. **Cryptographic Hash-Chained Audit Trail with Server-Side IP Tracking**:
   - Every system event (`CASE_CREATE`, `DOCUMENT_UPLOAD`, `DOCUMENT_VERIFY`, `DOCUMENT_VIEW`, `DOCUMENT_FIELD_CORRECT`, `DOCUMENT_TAMPER_FLAG`, `DOCUMENT_NEW_VERSION`, `USER_LOGIN`) is sealed in a continuous SHA-256 hash chain:
     $$\text{currentHash} = \text{SHA-256}(\text{previousHash} \parallel \text{canonicalJSON}(payload))$$
   - **Server-Derived IP Tracking**: The client's IP address is derived server-side via Express `trust proxy` and sealed directly into the audit block hash. Any database modification to an IP address or event payload causes `verifyAuditChainIntegrity()` to detect tampering immediately.

5. **Strict Role-Based Access Control (RBAC)**:
   - **`officer`**: Register legal cases, upload evidence, view assigned dossiers, create document revisions. Officers are strictly isolated to assigned cases and cannot discover unassigned cases.
   - **`verifier`**: Review OCR extractions, approve verified document hashes, flag anomalies, correct extracted fields.
   - **`admin`**: User lifecycle management, department assignments, global case access, system health monitoring.
   - **`auditor`**: Independent judicial oversight with read-only audit log access and cryptographic chain verification.

---

## 🧠 AI & Investigation Intelligence Pipeline

1. **Multilingual AI OCR & Anti-Gibberish Validation**:
   - Google Gemini Vision (`gemini-3.6-flash`) with structured schema output for FIRs, charge sheets, witness statements, and forensic reports.
   - Local fallback extractor ensures high availability when external APIs are unreachable.
   - Anti-gibberish heuristic prevents low-quality scans or noise from fabricating legal facts.
   - Supports bilingual English and Indic scripts (e.g. Malayalam, Hindi).

2. **Semantic Search with Case-Level Authorization**:
   - Computes text embeddings using configured Gemini embedding model (`gemini-embedding-001`) with deterministic fallback.
   - Performs cosine similarity ranking across vaulted documents while strictly enforcing case access boundaries.

3. **Chronological Timeline & Entity Linking**:
   - Generates unified chronological timelines from multi-document dates, flagging uncertain or low-confidence dates rather than inventing timestamps.
   - Discovers cross-document entities (accused persons, organizations, locations) using canonical key normalization.

4. **Cross-Case Similarity Intelligence**:
   - Computes deterministic similarity scores ($0.0 - 1.0$) between authorized cases based on:
     - Shared entities & aliases (35% weight)
     - Shared incident locations & jurisdictions (20% weight)
     - Shared statutory offences & legal sections (20% weight)
     - Evidentiary document text semantic vectors (25% weight)
   - Documents relevance threshold ($\ge 25\%$) to filter noise.
   - Strictly scopes comparisons to authorized cases server-side.

> [!IMPORTANT]
> **Authenticity & Decision-Support Disclaimers:**
> - **Intake Authentication**: AI extraction confidence measures text fidelity against scanned pixels; it does **NOT** certify physical evidentiary validity or legal authenticity prior to digital intake.
> - **Cross-Case Intelligence**: Potential case relationships and similarity scores are AI-assisted analytical aids computed from authorized profile signals. They do **NOT** represent factual or legal proof of real-world connection and remain subject to independent investigator review.

---

## 📁 Repository Structure

```
securedocket/
├── backend/
│   ├── src/
│   │   ├── config/              # MongoDB, env validator, security, logger
│   │   ├── constants/           # Roles, document types, actions, HTTP codes
│   │   ├── controllers/         # Auth, case, document, audit, verification, search
│   │   ├── middleware/          # Auth, RBAC, audit context, upload validation
│   │   ├── models/              # User, Case, Document, AuditLog, RefreshToken
│   │   ├── routes/              # Express API router (v1 endpoints)
│   │   ├── services/            # Auth, Case, Document, Audit, S3, OCR, Vector, Intelligence
│   │   └── utils/               # AES-256-GCM, SHA-256, ApiError, ApiResponse
│   ├── tests/                   # Jest integration & security test suites
│   ├── .env.example             # Backend environment template
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Common UI, modals, layout, verification review
│   │   ├── context/             # AuthContext, ThemeContext
│   │   ├── pages/               # CaseDetail, Documents, AuditLogs, Search, Queue, Dashboards
│   │   ├── services/            # Axios API clients
│   │   └── styles/              # Tailwind GovTech defense design tokens
│   ├── .env.example             # Frontend environment template
│   └── package.json
├── README.md                    # System documentation
└── package.json                 # Monorepo root scripts
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v18.0+ or v20.0+
- **npm**: v9.0+
- **MongoDB**: Local instance (`mongodb://localhost:27017`) or MongoDB Atlas

### 1. Environment Configuration

#### Backend Setup:
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` with your parameters:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/secure_dms_dev
JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_characters_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_characters_here
MASTER_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
BCRYPT_SALT_ROUNDS=12
TRUST_PROXY=1
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL_NAME=gemini-3.6-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
```

#### Frontend Setup:
```bash
cd ../frontend
cp .env.example .env
```
```ini
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### 2. Seed Deterministic Demo Accounts
Populate pre-configured test accounts for all four roles:
```bash
cd backend
node src/scripts/seedUsers.js
```

**Seed Credentials (Password: `<Role>SecurePass123!`):**
| Role | Email | Password | TOTP Secret (Authenticator) |
|---|---|---|---|
| **Officer** | `officer@police.gov.in` | `OfficerSecurePass123!` | `KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRLD` |
| **Verifier** | `verifier@forensics.gov.in` | `VerifierSecurePass123!` | `JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP` |
| **Admin** | `admin@investigation.gov.in` | `AdminSecurePass123!` | `MZXW6YTBOI2G63TOMZXW6YTBOI2G63TO` |
| **Auditor** | `auditor@judiciary.gov.in` | `AuditorSecurePass123!` | `NBSWY3DPEHPK3PXPNBSWY3DPEHPK3PXP` |

### 3. Run Locally

**Backend Server:**
```bash
cd backend
npm run dev
# Starts on http://localhost:5000 (Health Check: http://localhost:5000/api/v1/health)
```

**Frontend Portal:**
```bash
cd frontend
npm run dev
# Starts on http://localhost:5173
```

---

## 🧪 Comprehensive Test Suite

Run the complete test suite across all security and intelligence modules:

```bash
# Backend Automated Tests
cd backend
npm test

# Focused Module Tests
npx jest tests/audit.test.js              # Hash chain, tampering, and server-side IP tracking
npx jest tests/security_hardening.test.js # Token replay, AES-256-GCM, anti-fabrication
npx jest tests/intelligence.test.js      # Timeline, entity linking, and case similarity
npx jest tests/search.test.js            # Semantic vector search and case isolation
npx jest tests/versioning.test.js        # Document revisions and visual comparison
npx jest tests/encryption.test.js        # Field-level cryptographic sealing

# Frontend Production Build Validation
cd ../frontend
npm run build
```

---

## ⚖️ Technology Distinctions & Known Boundaries

- **Storage Vault**: Operates on a local encrypted filesystem abstraction in development; activates AWS S3 SSE-S3 encryption when AWS credentials and bucket are configured in production.
- **AI Connectivity**: Uses Google Gemini Vision & Embedding models when an API key is provided; gracefully falls back to deterministic local legal extraction and vector projection when offline.
- **Integrations**: Standalone secure repository designed to conform to SIH 26190 specifications; does not interface with proprietary live state CCTNS networks without authorized government integration gateways.
