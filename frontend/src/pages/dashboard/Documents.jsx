import React, { useState } from 'react';
import { FileText, Upload, ShieldCheck, ShieldAlert, Sparkles, Download, CheckCircle, Search, Filter, Eye } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { truncateHash, formatBytes, formatDate } from '../../utils/formatters';

export function Documents() {
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filterType, setFilterType] = useState('ALL');

  const [documents] = useState([
    {
      id: 'doc-001',
      title: 'Certified First Information Report (FIR No. 891/26)',
      caseNumber: 'CR/2026/0891-BLR',
      documentType: 'FIR',
      s3Key: 'cases/CR-0891/FIR_891_certified.pdf',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      ocrConfidence: 97.4,
      fileSize: 2451920,
      status: 'verified',
      uploadedBy: 'Inspector Vikram Singh',
      uploadedAt: '2026-08-30T10:14:00Z',
      extractedFields: {
        policeStation: 'Cyber Crime PS, Bengaluru',
        acts: ['IPC 420 (Cheating)', 'IT Act Sec 66D'],
        complainant: 'Nodal Officer, Apex Bank',
      },
    },
    {
      id: 'doc-002',
      title: 'Witness Statement under Section 161 CrPC - Branch Manager',
      caseNumber: 'CR/2026/0891-BLR',
      documentType: 'statement',
      s3Key: 'cases/CR-0891/statement_manager_161.pdf',
      sha256Hash: 'a7b3c299e5f88421098bca12095e7293a401b9f65d3a9856f84930129bc56a81',
      ocrConfidence: 93.8,
      fileSize: 1842000,
      status: 'ocr_completed',
      uploadedBy: 'Sub-Inspector Ananya Rao',
      uploadedAt: '2026-08-30T15:20:00Z',
      extractedFields: {
        witnessName: 'K. S. Narayanan',
        recordedBy: 'Inspector Vikram Singh',
      },
    },
    {
      id: 'doc-003',
      title: 'Digital Forensic Hard Drive Mirror & MD5/SHA256 Image Log',
      caseNumber: 'CR/2026/0891-BLR',
      documentType: 'forensic_report',
      s3Key: 'cases/CR-0891/forensic_drive_image.pdf',
      sha256Hash: 'f4b23c98aa291845bb0293847561928374650192837465019283746501928374',
      ocrConfidence: 99.1,
      fileSize: 8492019,
      status: 'verified',
      uploadedBy: 'Forensic Verifier Sharma',
      uploadedAt: '2026-08-31T09:00:00Z',
      extractedFields: {
        labName: 'Central Forensic Science Laboratory',
        examiner: 'Dr. R. K. Mittal',
      },
    },
  ]);

  const filteredDocs = filterType === 'ALL' ? documents : documents.filter((d) => d.documentType === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Secured Document Vault
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cryptographically sealed investigation records with SHA-256 integrity verification, S3 SSE-S3 encrypted storage, and AI OCR metadata.
          </p>
        </div>
        <Button variant="primary" icon={Upload} onClick={() => setIsUploadOpen(true)}>
          Upload & Seal Document
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
        {['ALL', 'FIR', 'statement', 'chargesheet', 'evidence', 'forensic_report'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              filterType === type
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-defense-900'
            }`}
          >
            {type.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Documents List */}
      <div className="space-y-4">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="glass-panel p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="cyan" size="xs">
                  {doc.documentType}
                </Badge>
                <Badge variant={doc.status === 'verified' ? 'verified' : 'pending'} size="xs">
                  {doc.status.replace('_', ' ')}
                </Badge>
                <span className="text-xs font-mono text-cyan-400 font-semibold">{doc.caseNumber}</span>
              </div>

              <h4 className="text-sm font-semibold text-slate-100">{doc.title}</h4>

              {/* SHA-256 Cryptographic Hash Seal */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  SHA-256 Seal:
                </span>
                <span className="bg-defense-950 px-2 py-0.5 rounded text-emerald-300 border border-emerald-500/30">
                  {doc.sha256Hash}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <span>Size: {formatBytes(doc.fileSize)}</span>
                <span>•</span>
                <span>Uploaded by: {doc.uploadedBy}</span>
                <span>•</span>
                <span>Date: {formatDate(doc.uploadedAt)}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-300 font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  OCR Score: {doc.ocrConfidence}%
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                icon={Eye}
                onClick={() => setSelectedDoc(doc)}
              >
                Inspect OCR Data
              </Button>
              <Button
                variant="emerald"
                size="sm"
                icon={Download}
                onClick={() => alert(`Presigned S3 download initiated for sealed object: ${doc.s3Key}`)}
              >
                Download (S3)
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Inspect OCR Extracted Entities Modal */}
      {selectedDoc && (
        <Modal
          isOpen={Boolean(selectedDoc)}
          onClose={() => setSelectedDoc(null)}
          title={`Extracted Intelligence: ${selectedDoc.title}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-defense-950 rounded-xl border border-slate-800 space-y-1.5 font-mono">
              <div className="text-cyan-400 font-semibold">CRYPTOGRAPHIC INTEGRITY PROOF</div>
              <div className="text-slate-300 break-all">Hash: {selectedDoc.sha256Hash}</div>
              <div className="text-slate-400">AWS S3 Object Key: {selectedDoc.s3Key} (SSE-S3 AES-256)</div>
            </div>

            <div>
              <h5 className="font-semibold text-slate-200 mb-2 uppercase tracking-wider text-[11px]">
                Server-Side Gemini Vision Extracted Entities
              </h5>
              <div className="bg-defense-900 p-4 rounded-xl border border-slate-800 space-y-2">
                <pre className="text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedDoc.extractedFields, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setSelectedDoc(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Upload Document Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload & Cryptographically Seal Document"
        maxWidth="max-w-lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsUploadOpen(false);
          }}
          className="space-y-4"
        >
          <Input label="Case Reference" placeholder="CR/2026/0891-BLR" required />
          <Input label="Document Title" placeholder="Ballistics Forensic Examination Report" required />

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 block">
              Document Classification Type
            </label>
            <select className="w-full bg-defense-900 border border-slate-700/80 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-cyan-500">
              <option value="FIR">First Information Report (FIR)</option>
              <option value="statement">Witness / Accused Statement (Sec 161/164)</option>
              <option value="chargesheet">Police Report / Chargesheet</option>
              <option value="evidence">Material Evidence / Seizure Memo</option>
              <option value="forensic_report">Forensic Laboratory Report</option>
            </select>
          </div>

          <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors">
            <Upload className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-200">Select PDF or Scanned Legal Record</p>
            <p className="text-[11px] text-slate-400 mt-1">
              File will be hashed client-side & server-side, uploaded to S3 (SSE-S3), and indexed for AI extraction.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Upload & Seal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
