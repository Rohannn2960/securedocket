# Secure Digital Document Management System (SIH Problem Statement 26190)

A high-integrity, tamper-evident digital document management platform engineered for **law enforcement agencies, legal departments, courts, and forensic investigation units**.

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
                    │ • Strict RBAC & 2FA     │
                    │ • Cryptographic Hashing │
                    │ • AI OCR (Gemini Vision)│
                    │ • Vector Search & RAG   │
                    │ • Centralized Auditing  │
                    └──────────┬──────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌────────────────────────┐             ┌────────────────────────┐
│     MongoDB Atlas      │             │         AWS S3         │
│                        │             │                        │
│ • Case Dossiers        │             │ • Encrypted Raw Files  │
│ • Document Metadata    │             │ • SSE-S3 (AES-256)     │
│ • SHA-256 Signatures   │             │ • Presigned Short TTL  │
│ • Hash-Chained Audits  │             │ • Zero DB File Bloat   │
│ • Extracted AI Entities│             └────────────────────────┘
│ • Vector Embeddings    │
└────────────────────────┘
```

---

## 🔐 Core Security & Compliance Design

1. **Zero Raw File Storage in Database**:
   - MongoDB Atlas stores **only** document metadata, extracted entities, and SHA-256 cryptographic signatures.
   - Raw binary files (PDFs, scans, evidence photos) are streamed directly to **AWS S3 with Server-Side Encryption (SSE-S3 AES-256)** at rest.
2. **Cryptographic Hash-Chained Audit Trail**:
   - Every document action (`UPLOAD`, `VIEW`, `VERIFY`, `DOWNLOAD`, `TAMPER_FLAG`) computes a chained SHA-256 block hash combining the prior block's hash + canonical JSON payload.
   - Any database tampering or unauthorized record deletion immediately invalidates the cryptographic chain, surfacing in real-time integrity checks.
3. **Defense-in-Depth Authentication**:
   - Short-lived JWT Access Tokens (15 minutes).
   - Refresh Token Rotation stored strictly in `httpOnly`, `secure`, `sameSite=strict` cookies.
   - Password hashing via `bcrypt` with minimum **12 salt rounds**.
   - Mandatory Two-Factor Authentication (TOTP).
4. **Server-Side AI Isolation**:
   - Google Gemini Vision API and OCR keys reside **strictly on the backend**. Frontend clients never receive third-party AI tokens.
5. **Strict Role-Based Access Control (RBAC)**:
   - **`officer`**: Register legal cases, upload and seal evidence, view assigned dossiers.
   - **`verifier`**: Review OCR extractions, approve verified document hashes, flag anomalies.
   - **`admin`**: Manage user credentials, department roles, and system configuration.
   - **`auditor`**: Dedicated read-only access to historical cryptographic audit logs and chain verification.

---

## 📁 Repository Structure

```
project/
├── backend/
│   ├── src/
│   │   ├── config/              # MongoDB connection, env validator, security & logger
│   │   ├── constants/           # Roles, document types, HTTP & error codes, actions
│   │   ├── controllers/         # Auth, case, document, audit, and health controllers
│   │   ├── middleware/          # Auth, RBAC, audit interceptor, error handler, rate limiters
│   │   ├── models/              # Mongoose models: User, Case, Document, AuditLog
│   │   ├── routes/              # Express API router (v1 endpoints)
│   │   ├── services/            # Auth, Case, Document, Audit, S3, OCR, and Vector services
│   │   ├── utils/               # ApiError, ApiResponse, crypto hashing, asyncWrapper
│   │   ├── app.js               # Express application pipeline
│   │   └── server.js            # Server entry point with lifecycle management
│   ├── .env.example             # Backend environment template
│   ├── .gitignore               # Backend gitignore
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/          # Common UI components, layout, and feedback elements
│   │   ├── context/             # AuthContext (session state) & ThemeContext
│   │   ├── hooks/               # useAuth, useApi custom hooks
│   │   ├── pages/               # Landing, Login, 2FA, Overview, Cases, Documents, Audit, Search
│   │   ├── routes/              # ProtectedRoute, AppRoutes
│   │   ├── services/            # Axios API clients
│   │   ├── styles/              # Tailwind directives & glassmorphic tokens
│   │   ├── utils/               # Constants and military date/hash formatters
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example             # Frontend environment template
│   ├── .gitignore               # Frontend gitignore
│   ├── tailwind.config.js       # GovTech / Defense custom color tokens
│   ├── vite.config.js           # Vite config with API proxy
│   └── package.json
├── .gitignore                   # Root gitignore
├── README.md                    # System architecture documentation
└── package.json                 # Monorepo scripts
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0+ or v20.0+
- **npm**: v9.0+
- **MongoDB Atlas** or local MongoDB instance (`mongodb://localhost:27017`)

### 1. Environment Setup

#### Backend Configuration:
```bash
cd backend
cp .env.example .env
```
Edit `backend/.env` with your secrets and MongoDB URI:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://localhost:27017/secure_dms_dev
JWT_ACCESS_SECRET=your_jwt_access_secret_min_32_characters_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_min_32_characters_here
AWS_S3_BUCKET_NAME=sih26190-secure-documents-vault
AWS_REGION=ap-south-1
GEMINI_API_KEY=your_gemini_api_key
```

#### Frontend Configuration:
```bash
cd ../frontend
cp .env.example .env
```
```ini
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### 2. Running Locally

#### Run Backend Server:
```bash
cd backend
npm run dev
```
Backend API gateway will start on `http://localhost:5000` (Health Check: `http://localhost:5000/api/v1/health`).

#### Run Frontend Client:
```bash
cd frontend
npm run dev
```
Frontend portal will start on `http://localhost:5173`.

---

## 🛣️ Implementation Roadmap

- [x] **Phase 0: Architectural Foundation & Skeleton** (Current)
  - Monorepo folder separation
  - Environment strategy & validation
  - Mongoose models with validation & indexes
  - Express server with security headers, CORS, rate limiting, and structured logging
  - React + Vite + Tailwind frontend with GovTech design system and RBAC protected routing
- [ ] **Phase 1: Secure Authentication & Mandatory 2FA Flow**
  - Live TOTP QR-code enrollment (`otplib` / `speakeasy`)
  - Refresh token rotation in MongoDB
  - Password hashing tests with 12 salt rounds
- [ ] **Phase 2: AWS S3 SSE-S3 Vault & Client/Server Hashing Pipeline**
  - Direct presigned S3 multipart uploads with SSE-S3 AES-256
  - Client-side and server-side SHA-256 dual verification
- [ ] **Phase 3: Gemini Vision OCR & Structured Entity Extraction**
  - Multimodal prompt engineering for FIRs, charge sheets, and witness statements
  - Confidence scoring and fallback to local Tesseract OCR
- [ ] **Phase 4: Vector Embeddings & Semantic Investigation Search**
  - Document embedding generation and MongoDB Atlas Vector Search / cosine similarity indexing
- [ ] **Phase 5: Immutable Audit Chain & Non-Repudiation Dashboard**
  - Cryptographic block chain verification algorithms with tamper alerting
