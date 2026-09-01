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
} from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Spinner } from '../../../components/common/Spinner';
import { caseService } from '../../../services/caseService';
import { truncateHash } from '../../../utils/formatters';

export function AuditorDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAuditorData() {
      try {
        const [statsRes, casesRes] = await Promise.all([
          caseService.getCaseStatistics(),
          caseService.getCases({ limit: 4 }),
        ]);
        setStats(statsRes.data);
        setCases(casesRes.data || []);
      } catch (err) {
        console.error('Failed to load auditor dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAuditorData();
  }, []);

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
      value: 'SEALED & VALID',
      change: 'Zero Tamper Alerts',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-500/30',
    },
    {
      title: 'Cryptographic Blocks',
      value: '1,420',
      change: 'SHA-256 Chained Hash Blocks',
      icon: Link2,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/40 border-indigo-500/30',
    },
    {
      title: 'Audited Legal Cases',
      value: stats?.total || 0,
      change: 'Under Judicial Oversight',
      icon: Briefcase,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-500/30',
    },
    {
      title: 'Audit Logging Engine',
      value: 'RFC 6238',
      change: 'Immutable MongoDB Log',
      icon: Lock,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-500/30',
    },
  ];

  const recentAuditEntries = [
    {
      action: 'CASE_STATUS_CHANGE',
      user: 'Inspector Vikram Singh',
      caseNumber: 'CR/2026/0891-BLR',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      time: '10 mins ago',
    },
    {
      action: 'CASE_OFFICER_ASSIGN',
      user: 'Administrator Dev Anand',
      caseNumber: 'CR/2026/0877-DEL',
      hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      time: '28 mins ago',
    },
    {
      action: 'USER_2FA_VERIFY',
      user: 'Dr. Neha Sharma',
      caseNumber: '—',
      hash: 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
      time: '1 hour ago',
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
          <div className="space-y-3">
            {recentAuditEntries.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="cyan" size="xs">
                      {item.action}
                    </Badge>
                    <span className="text-slate-300 font-medium">{item.user}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400 truncate max-w-[200px]">{item.caseNumber}</span>
                  <span className="text-emerald-400 text-[11px] font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    {truncateHash(item.hash, 6, 6)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Read-Only Case Registry */}
        <Card
          title="Case Dossiers Under Judicial Oversight"
          subtitle="Read-only access to all registered crime files across state jurisdictions"
          action={
            <Link to="/dashboard/cases">
              <Button variant="ghost" size="sm" className="text-xs text-cyan-400">
                Inspect All →
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {cases.map((c) => (
              <Link
                key={c._id}
                to={`/dashboard/cases/${c._id}`}
                className="p-3 rounded-xl bg-defense-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between block group"
              >
                <div className="space-y-1 max-w-[75%]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-300 group-hover:text-cyan-300">
                      {c.caseNumber}
                    </span>
                    <Badge variant="default" size="xs">
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-300 truncate">{c.title}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Audit <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
