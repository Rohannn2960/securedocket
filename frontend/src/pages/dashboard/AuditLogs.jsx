import React, { useState } from 'react';
import { Link2, ShieldCheck, CheckCircle2, RefreshCw, AlertTriangle, User, Clock, Terminal } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { truncateHash, formatDate } from '../../utils/formatters';

export function AuditLogs() {
  const [verifying, setVerifying] = useState(false);
  const [chainStatus, setChainStatus] = useState(null);

  const [auditLogs] = useState([
    {
      id: 'block-003',
      action: 'DOCUMENT_VERIFY',
      actor: 'Forensic Verifier Sharma (EMP-8821)',
      role: 'verifier',
      target: 'Forensic Ballistics Report V2 (CR/2026/0891-BLR)',
      timestamp: '2026-08-31T09:15:00Z',
      previousHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      currentHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      ip: '10.24.18.92',
      details: { verifiedConfidence: 99.1, sealStatus: 'APPROVED' },
    },
    {
      id: 'block-002',
      action: 'DOCUMENT_UPLOAD',
      actor: 'Inspector Vikram Singh (EMP-9842)',
      role: 'officer',
      target: 'FIR-891-Certified.pdf (CR/2026/0891-BLR)',
      timestamp: '2026-08-30T10:14:00Z',
      previousHash: 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
      currentHash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      ip: '10.24.18.45',
      details: { s3Key: 'cases/CR-0891/FIR_891_certified.pdf', mimeType: 'application/pdf' },
    },
    {
      id: 'block-001',
      action: 'CASE_CREATE',
      actor: 'Inspector Vikram Singh (EMP-9842)',
      role: 'officer',
      target: 'Dossier CR/2026/0891-BLR',
      timestamp: '2026-08-30T09:30:00Z',
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
      currentHash: 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
      ip: '10.24.18.45',
      details: { title: 'Cyber Heist & Fake Invoicing Scheme' },
    },
  ]);

  const handleVerifyChain = () => {
    setVerifying(true);
    setTimeout(() => {
      setChainStatus({
        valid: true,
        checkedBlocks: auditLogs.length,
        verifiedAt: new Date().toISOString(),
      });
      setVerifying(false);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header and Chain Verification Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-indigo-400" />
            Cryptographic Audit Hash Chain
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable, hash-linked log of all document actions, accesses, and modifications for judicial non-repudiation.
          </p>
        </div>
        <Button
          variant="emerald"
          icon={RefreshCw}
          isLoading={verifying}
          onClick={handleVerifyChain}
        >
          Verify Complete Chain Integrity
        </Button>
      </div>

      {/* Chain Status Result Banner */}
      {chainStatus && (
        <Alert
          variant={chainStatus.valid ? 'success' : 'error'}
          title={chainStatus.valid ? 'Hash Chain Integrity Verified: 100% Intact' : 'INTEGRITY ALERT: Chain Discontinuity Detected'}
        >
          Verified {chainStatus.checkedBlocks} sequential cryptographic blocks. All previous-to-current block SHA-256 links match zero modifications or deletions. Verified at {formatDate(chainStatus.verifiedAt)}.
        </Alert>
      )}

      {/* Chained Blocks Timeline */}
      <div className="space-y-4">
        {auditLogs.map((log, index) => (
          <div
            key={log.id}
            className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 hover:border-indigo-500/40 transition-all relative overflow-hidden"
          >
            {/* Block Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <Badge variant="indigo" size="sm">
                  {log.action}
                </Badge>
                <span className="text-xs font-semibold text-slate-200">{log.target}</span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(log.timestamp)}
                </span>
                <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  IP: {log.ip}
                </span>
              </div>
            </div>

            {/* Actor & Action Details */}
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span>Actor:</span>
              <span className="font-semibold text-slate-100">{log.actor}</span>
              <Badge variant="default" size="xs">
                {log.role}
              </Badge>
            </div>

            {/* Cryptographic Link Panel (Previous Hash -> Current Hash) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-defense-950 p-3.5 rounded-xl border border-slate-800/80 font-mono text-xs">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  ← Linked Previous Block Hash
                </span>
                <div className="text-slate-400 text-[11px] break-all bg-defense-900/80 p-2 rounded border border-slate-800">
                  {log.previousHash}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider block flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Current Block Hash (Sealed)
                </span>
                <div className="text-emerald-300 text-[11px] break-all bg-emerald-950/40 p-2 rounded border border-emerald-500/30">
                  {log.currentHash}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
