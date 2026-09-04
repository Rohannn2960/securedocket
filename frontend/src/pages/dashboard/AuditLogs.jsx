import React, { useState, useEffect } from 'react';
import { Link2, ShieldCheck, CheckCircle2, RefreshCw, AlertTriangle, User, Clock, Terminal, Globe } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { truncateHash, formatDate } from '../../utils/formatters';
import { auditService } from '../../services/auditService';

export function AuditLogs() {
  const [verifying, setVerifying] = useState(false);
  const [chainStatus, setChainStatus] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const res = await auditService.getAuditLogs({ limit: 50 });
      setAuditLogs(res.data);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    setChainStatus(null);
    try {
      const res = await auditService.verifyAuditChain();
      setChainStatus({
        valid: res.data.valid,
        checkedEntries: res.data.checkedEntries,
        firstBrokenEntry: res.data.firstBrokenEntry,
        reason: res.data.reason,
        verifiedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to verify chain:', error);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400">Loading audit trail...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Link2 className="w-5 h-5 text-cyan-400" />
          Cryptographic Audit Hash Chain
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Immutable, hash-linked cryptographic chain of all document actions, views, and modifications for judicial non-repudiation.
        </p>
      </div>

      {/* Prominent Verification Status Box */}
      <div className={`p-6 rounded-2xl border transition-all ${
        verifying
          ? 'bg-cyan-950/40 border-cyan-500/50 shadow-glow-cyan'
          : !chainStatus
          ? 'bg-defense-900/80 border-slate-800'
          : chainStatus.valid
          ? 'bg-emerald-950/40 border-emerald-500/50 shadow-glow-emerald'
          : 'bg-rose-950/40 border-rose-500/50 shadow-glow-rose'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Cryptographic Chain State:
              </span>
              <Badge
                variant={
                  verifying
                    ? 'cyan'
                    : !chainStatus
                    ? 'default'
                    : chainStatus.valid
                    ? 'verified'
                    : 'tampered'
                }
                size="xs"
              >
                {verifying
                  ? 'VERIFYING...'
                  : !chainStatus
                  ? 'INTEGRITY STATUS UNKNOWN'
                  : chainStatus.valid
                  ? 'CHAIN INTEGRITY VERIFIED'
                  : 'CHAIN INTEGRITY COMPROMISED'}
              </Badge>
            </div>

            <div className="text-sm font-semibold text-slate-100">
              {verifying ? (
                'Executing server-side SHA-256 sequential block verification across entire audit ledger...'
              ) : !chainStatus ? (
                'Integrity status unknown. Click below to compute and verify the cryptographic hash chain.'
              ) : chainStatus.valid ? (
                `CHAIN INTEGRITY VERIFIED: All ${chainStatus.checkedEntries} sequential cryptographic entries mathematically confirmed intact without tampering.`
              ) : (
                `CHAIN INTEGRITY COMPROMISED: Hash mismatch detected at block index ${chainStatus.firstBrokenEntry}. Reason: ${chainStatus.reason}`
              )}
            </div>

            {chainStatus?.verifiedAt && (
              <div className="text-[11px] font-mono text-slate-400">
                Last Verified: {formatDate(chainStatus.verifiedAt)} • Genesis: 00000000...0000
              </div>
            )}
          </div>

          <Button
            variant={chainStatus?.valid ? 'primary' : 'primary'}
            icon={RefreshCw}
            isLoading={verifying}
            onClick={handleVerifyChain}
            className="shrink-0"
          >
            {verifying ? 'Verifying Chain...' : 'Verify Chain Integrity'}
          </Button>
        </div>
      </div>

      {/* Chained Blocks Timeline */}
      <div className="space-y-4">
        {auditLogs.map((log, index) => {
          const isBrokenBlock =
            chainStatus &&
            !chainStatus.valid &&
            (chainStatus.firstBrokenEntry === log._id || chainStatus.brokenIndex === index);

          return (
            <div
              key={log._id}
              className={`p-5 rounded-2xl border transition-all relative overflow-hidden space-y-4 ${
                isBrokenBlock
                  ? 'bg-rose-950/40 border-rose-500/80 shadow-glow-rose ring-1 ring-rose-500/50'
                  : 'glass-panel border-slate-800 hover:border-cyan-500/40'
              }`}
            >
              {isBrokenBlock && (
                <div className="p-2.5 rounded-lg bg-rose-900/60 border border-rose-500/60 flex items-center justify-between text-xs font-mono text-rose-200">
                  <span className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                    🚨 CRYPTOGRAPHIC DISCREPANCY DETECTED AT THIS BLOCK (Index #{index + 1})
                  </span>
                  <span className="text-[11px] bg-rose-950 px-2 py-0.5 rounded border border-rose-700/50">
                    Violation: {chainStatus.reason}
                  </span>
                </div>
              )}

              {/* Block Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-3">
                  <Badge variant={isBrokenBlock ? 'tampered' : 'indigo'} size="sm">
                    {log.action}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-200">
                    {log.documentId ? (log.documentId.title || 'Document') : (log.caseId?.title || 'System Event')}
                  </span>
                  {log.caseId?.caseNumber && (
                    <span className="text-xs font-mono text-cyan-400 font-bold">
                      [{log.caseId.caseNumber}]
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    {formatDate(log.timestamp)}
                  </span>
                  <span className="flex items-center gap-1.5 bg-defense-950 px-2.5 py-1 rounded-lg border border-cyan-500/30 text-cyan-300 font-semibold shadow-sm">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>IP: {log.ipAddress || 'Internal Direct'}</span>
                  </span>
                </div>
              </div>

              {/* Event Metadata Grid (Actor, IP, Timestamp, Context) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-1 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                    Officer / Actor:
                  </span>
                  <div className="flex items-center gap-1.5 text-slate-200">
                    <User className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="font-semibold truncate">
                      {log.userId ? log.userId.name : 'System Service'}
                    </span>
                    {log.userId?.role && (
                      <Badge variant="default" size="xs">
                        {log.userId.role}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                    Source IP Address:
                  </span>
                  <div className="font-mono text-cyan-300 font-semibold flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{log.ipAddress || 'Internal / Socket'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                    Audited Timestamp:
                  </span>
                  <div className="text-slate-300 font-mono text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{formatDate(log.timestamp)}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                    Target Context:
                  </span>
                  <div className="text-slate-300 truncate text-[11px]">
                    {log.caseId?.caseNumber
                      ? `Case ${log.caseId.caseNumber}`
                      : log.documentId?.title || 'System Ledger'}
                  </div>
                </div>
              </div>

              {/* Relevant Details Breakdown */}
              {log.details && Object.keys(log.details).length > 0 && (
                <div className="p-2.5 rounded-lg bg-defense-950/70 border border-slate-800/80 text-xs font-mono space-y-1">
                  <span className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold block">
                    Recorded Parameters:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(log.details).slice(0, 6).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 rounded bg-defense-900 border border-slate-800 text-[11px] text-slate-300"
                      >
                        <strong className="text-slate-400">{k}:</strong>{' '}
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

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
        );
      })}
      </div>
    </div>
  );
}
