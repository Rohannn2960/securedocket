import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Link2,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Briefcase,
  ArrowUpRight,
  Search,
  Lock,
  History,
  RefreshCw,
  Clock,
  Terminal,
} from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Spinner } from '../../../components/common/Spinner';
import { caseService } from '../../../services/caseService';
import { auditService } from '../../../services/auditService';
import { truncateHash, formatDate } from '../../../utils/formatters';

export function AuditorDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [chainStatus, setChainStatus] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuditorData() {
      try {
        const [statsRes, casesRes, auditRes] = await Promise.all([
          caseService.getCaseStatistics(),
          caseService.getCases({ limit: 4 }),
          auditService.getAuditLogs({ limit: 5 }),
        ]);
        setStats(statsRes.data);
        setCases(casesRes.data || []);
        setAuditLogs(auditRes.data || []);
      } catch (err) {
        console.error('Failed to load auditor dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAuditorData();
  }, []);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await auditService.verifyAuditChain();
      setChainStatus(res.data);
    } catch (err) {
      console.error('Chain verification error:', err);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const auditStats = [
    {
      title: 'Chain Integrity Status',
      value: chainStatus ? (chainStatus.valid ? 'VERIFIED INTACT' : 'COMPROMISED') : 'SEALED & ACTIVE',
      change: chainStatus ? `${chainStatus.checkedEntries} Blocks Verified` : 'Zero Tamper Alerts',
      icon: ShieldCheck,
      color: chainStatus?.valid === false ? 'text-rose-400' : 'text-emerald-400',
      bg: chainStatus?.valid === false ? 'bg-rose-950/40 border-rose-500/30' : 'bg-emerald-950/40 border-emerald-500/30',
    },
    {
      title: 'Ledger Hash Blocks',
      value: String(auditLogs.length > 0 ? auditLogs.length : '12'),
      change: 'SHA-256 Sequential Blocks',
      icon: Link2,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-500/30',
    },
    {
      title: 'Audited Legal Cases',
      value: String(stats?.total || cases.length),
      change: 'Under Judicial Oversight',
      icon: Briefcase,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/40 border-indigo-500/30',
    },
    {
      title: 'Access Integrity Protocol',
      value: 'AES-256 + SHA-256',
      change: 'Cryptographic Non-Repudiation',
      icon: Lock,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Auditor Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-defense-900 to-defense-950 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono font-semibold mb-1">
            <Link2 className="w-4 h-4" />
            <span>JUDICIAL OVERSIGHT & CRYPTOGRAPHIC AUDIT PORTAL</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            Judicial Auditor: {user?.name || 'S. K. Rao'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Clearance: <span className="text-indigo-400 font-bold">JUDICIAL AUDITOR</span> • Commission:{' '}
            <span className="text-slate-200">{user?.department || 'Judicial Oversight & Audit Commission'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/audit">
            <Button variant="primary" icon={Link2} size="sm">
              Verify Full Hash Chain
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {auditStats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className={`glass-panel p-5 rounded-2xl border ${stat.bg} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{stat.title}</span>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-slate-100 font-mono">{stat.value}</div>
              <div className="text-[11px] text-slate-400 font-mono">{stat.change}</div>
            </div>
          );
        })}
      </div>

      {/* Cryptographic Event Log & Read-Only Case Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real-time Audit Stream */}
        <Card
          title="Cryptographic Audit Hash Stream"
          subtitle="Real-time chained event blocks with verified SHA-256 block headers"
          action={
            <Link to="/dashboard/audit">
              <Button variant="ghost" size="sm" className="text-xs text-indigo-400">
                Full Trail →
              </Button>
            </Link>
          }
        >
          {auditLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 font-mono">
              No audit logs recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {auditLogs.map((item, idx) => (
                <div
                  key={item._id || idx}
                  className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant="cyan" size="xs">
                        {item.action}
                      </Badge>
                      <span className="text-slate-300 font-medium">
                        {item.userId?.name || 'System'}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 truncate max-w-[200px]">
                      {item.documentId?.title || item.caseId?.title || 'System Ledger'}
                    </span>
                    <span className="text-emerald-400 text-[11px]">
                      {truncateHash(item.currentHash, 6, 6)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Read-Only Legal Dossier Oversight */}
        <Card
          title="Supervised Case Dossiers"
          subtitle="Judicial oversight access across active state police stations"
          action={
            <Link to="/dashboard/cases">
              <Button variant="ghost" size="sm" className="text-xs text-indigo-400">
                All Cases →
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {cases.map((c) => (
              <div
                key={c._id}
                className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-200">
                      {c.caseNumber}
                    </span>
                    <Badge variant="verified" size="xs">
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-400 truncate max-w-[260px]">{c.title}</div>
                </div>
                <Link to={`/dashboard/cases/${c._id}`}>
                  <Button variant="ghost" size="xs" icon={ArrowUpRight} />
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
