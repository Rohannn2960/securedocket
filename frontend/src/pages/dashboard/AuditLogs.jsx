import React, { useState, useEffect } from 'react';
import { Link2, ShieldCheck, CheckCircle2, RefreshCw, AlertTriangle, User, Clock, Terminal } from 'lucide-react';
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
          title={chainStatus.valid ? 'Chain Integrity Verified' : 'Chain Integrity Compromised'}
        >
          {chainStatus.valid ? (
            `Verified ${chainStatus.checkedEntries} sequential cryptographic entries. All previous-to-current block SHA-256 links match zero modifications or deletions. Verified at ${formatDate(chainStatus.verifiedAt)}.`
          ) : (
            `Failed verification at entry ${chainStatus.firstBrokenEntry}. Reason: ${chainStatus.reason}.`
          )}
        </Alert>
      )}

      {/* Chained Blocks Timeline */}
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-800 before:to-transparent">
        {auditLogs.map((log, index) => (
          <div
            key={log._id}
            className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 hover:border-indigo-500/40 transition-all relative overflow-hidden"
          >
            {/* Block Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-3">
                <Badge variant="indigo" size="sm">
                  {log.action}
                </Badge>
                <span className="text-xs font-semibold text-slate-200">
                  {log.documentId ? (log.documentId.title || 'Document') : (log.caseId?.title || 'System Event')}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatDate(log.timestamp)}
                </span>
                <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  IP: {log.ipAddress || 'unknown'}
                </span>
              </div>
            </div>

            {/* Actor & Action Details */}
            <div className="text-xs text-slate-300 flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span>Actor:</span>
              {log.userId ? (
                <>
                  <span className="font-semibold text-slate-100">{log.userId.name}</span>
                  <Badge variant="default" size="xs">
                    {log.userId.role}
                  </Badge>
                </>
              ) : (
                <span className="font-semibold text-slate-400 italic">System</span>
              )}
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
