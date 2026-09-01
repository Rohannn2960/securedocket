import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Filter,
  Eye,
} from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Spinner } from '../../../components/common/Spinner';
import { caseService } from '../../../services/caseService';

export function VerifierDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVerifierData() {
      try {
        const [statsRes, casesRes] = await Promise.all([
          caseService.getCaseStatistics(),
          caseService.getCases({ limit: 6 }),
        ]);
        setStats(statsRes.data);
        setCases(casesRes.data || []);
      } catch (err) {
        console.error('Failed to load verifier dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadVerifierData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const verifierStats = [
    {
      title: 'Pending Forensic Queue',
      value: '7',
      change: 'Awaiting OCR / Signature Review',
      icon: FileCheck2,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-500/30',
    },
    {
      title: 'Forensic Verification Passed',
      value: '142',
      change: '100% SHA-256 Validated',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-500/30',
    },
    {
      title: 'Cases Under Review',
      value: stats?.activeInvestigations || 0,
      change: 'Active Dossiers with Evidence',
      icon: Eye,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-500/30',
    },
    {
      title: 'Tamper / Anomaly Flags',
      value: '0',
      change: 'Zero Integrity Violations',
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-950/40 border-rose-500/30',
    },
  ];

  const verificationQueue = [
    {
      docName: 'FIR-2026-0891-Certified.pdf',
      caseNumber: 'CR/2026/0891-BLR',
      officer: 'Inspector Vikram Singh',
      ocrConfidence: '98.8%',
      status: 'pending_review',
      time: '15 mins ago',
    },
    {
      docName: 'Forensic-Ballistics-Match-Report.pdf',
      caseNumber: 'CR/2026/0877-DEL',
      officer: 'ACP Rajesh Malhotra',
      ocrConfidence: '99.4%',
      status: 'pending_review',
      time: '42 mins ago',
    },
    {
      docName: 'Mutation-Register-Archive-Page42.pdf',
      caseNumber: 'CR/2026/0862-MUM',
      officer: 'Inspector Priya Nair',
      ocrConfidence: '87.2%',
      status: 'flagged_low_confidence',
      time: '2 hours ago',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Verifier Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-defense-900 to-defense-950 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-semibold mb-1">
            <FileCheck2 className="w-4 h-4" />
            <span>CENTRAL FORENSIC SCIENCE LABORATORY (CFSL) VERIFICATION CONSOLE</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            Forensic Desk: {user?.name || 'Dr. Neha Sharma'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Clearance: <span className="text-emerald-400 font-bold">FORENSIC VERIFIER</span> • Badge:{' '}
            <span className="text-slate-200">{user?.badgeNumber || 'CFSL-4412'}</span>
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {verifierStats.map((stat, i) => {
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

      {/* Verification Queue & Active Case Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verification Queue */}
        <Card
          title="Document Verification Backlog"
          subtitle="Evidence documents awaiting forensic OCR review and digital stamp certification"
        >
          <div className="space-y-3">
            {verificationQueue.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 hover:border-amber-500/40 transition-all flex items-center justify-between"
              >
                <div className="space-y-1 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-cyan-400">{item.caseNumber}</span>
                    <Badge
                      variant={item.status === 'flagged_low_confidence' ? 'tampered' : 'pending'}
                      size="xs"
                    >
                      {item.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{item.docName}</div>
                  <div className="text-[11px] text-slate-400">
                    Uploaded by {item.officer} • <span className="font-mono text-emerald-400">OCR: {item.ocrConfidence}</span>
                  </div>
                </div>
                <Button size="sm" variant="secondary" className="text-xs">
                  Review
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Active Cases Relevant for Verification */}
        <Card
          title="Active Case Dossiers"
          subtitle="Legal investigation records with linked evidentiary documents"
          action={
            <Link to="/dashboard/cases">
              <Button variant="ghost" size="sm" className="text-xs text-cyan-400">
                View All Cases →
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
                    <Badge variant="cyan" size="xs">
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs text-slate-300 truncate">{c.title}</div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Inspect <ArrowUpRight className="w-3.5 h-3.5" />
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
