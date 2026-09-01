import React from 'react';
import { Briefcase, FileText, Link2, Sparkles, ShieldCheck, ArrowUpRight, CheckCircle2, AlertTriangle, Lock } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { StatusIndicator } from '../../components/common/StatusIndicator';
import { Button } from '../../components/common/Button';
import { Link } from 'react-router-dom';
import { truncateHash, formatDate } from '../../utils/formatters';

export function Overview() {
  const stats = [
    {
      title: 'Active Case Files',
      value: '42',
      change: '+4 this week',
      icon: Briefcase,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-500/30',
    },
    {
      title: 'Secured Documents',
      value: '289',
      change: '100% SSE-S3 Encrypted',
      icon: FileText,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-500/30',
    },
    {
      title: 'Audit Blocks Chained',
      value: '1,420',
      change: 'Zero Tamper Alerts',
      icon: Link2,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/40 border-indigo-500/30',
    },
    {
      title: 'AI OCR Extractions',
      value: '98.4%',
      change: 'Avg. Confidence Score',
      icon: Sparkles,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-500/30',
    },
  ];

  const recentCases = [
    {
      caseNumber: 'CR/2026/0891-BLR',
      title: 'Cyber Heist & Fake Invoicing Scheme',
      status: 'under_investigation',
      documentsCount: 14,
      lastUpdated: '2026-08-30T14:22:00Z',
    },
    {
      caseNumber: 'CR/2026/0877-DEL',
      title: 'Narcotics Seizure & Forensic Ballistics',
      status: 'pending_trial',
      documentsCount: 28,
      lastUpdated: '2026-08-29T11:15:00Z',
    },
    {
      caseNumber: 'CR/2026/0862-MUM',
      title: 'Land Record Tampering & Forgery Syndicate',
      status: 'open',
      documentsCount: 9,
      lastUpdated: '2026-08-28T09:40:00Z',
    },
  ];

  const recentAudits = [
    {
      action: 'DOCUMENT_UPLOAD',
      user: 'Inspector Vikram Singh',
      doc: 'FIR-0891-Certified.pdf',
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      time: '12 mins ago',
      status: 'verified',
    },
    {
      action: 'DOCUMENT_VERIFY',
      user: 'Forensic Verifier Sharma',
      doc: 'Ballistics-Report-V2.pdf',
      hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      time: '45 mins ago',
      status: 'verified',
    },
    {
      action: 'USER_LOGIN',
      user: 'Auditor Rao',
      doc: '—',
      hash: 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9',
      time: '1 hour ago',
      status: 'verified',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            Investigation Operations Overview
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status of legal case records, cryptographic verification chain, and AI extraction pipelines.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/documents">
            <Button size="sm" variant="primary" icon={ArrowUpRight}>
              Upload Legal Document
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className={`glass-panel p-5 rounded-2xl border ${stat.bg} space-y-2`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{stat.title}</span>
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="text-2xl font-bold text-slate-100 font-mono">{stat.value}</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>{stat.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Recent Cases & Audit Hash Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <Card
          title="Active Investigation Cases"
          subtitle="Latest crime reference dossiers assigned to investigation team"
          action={
            <Link to="/dashboard/cases">
              <Button variant="ghost" size="sm" className="text-xs text-cyan-400">
                View All
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {recentCases.map((c, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-cyan-400">{c.caseNumber}</span>
                    <Badge variant="default" size="xs">
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs font-medium text-slate-200">{c.title}</div>
                  <div className="text-[11px] text-slate-400">{c.documentsCount} Vault Documents</div>
                </div>
                <Link to="/dashboard/documents">
                  <Button size="sm" variant="ghost" icon={ArrowUpRight} />
                </Link>
              </div>
            ))}
          </div>
        </Card>

        {/* Cryptographic Audit Hash Stream */}
        <Card
          title="Cryptographic Audit Hash Trail"
          subtitle="Real-time chained event blocks with SHA-256 integrity"
          action={
            <Link to="/dashboard/audit">
              <Button variant="ghost" size="sm" className="text-xs text-indigo-400">
                Audit Chain
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {recentAudits.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-defense-900/60 border border-slate-800/80 space-y-1.5"
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
                  <span className="text-slate-400 truncate max-w-[200px]">{item.doc}</span>
                  <span className="text-emerald-400 text-[11px] font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    {truncateHash(item.hash, 6, 6)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
