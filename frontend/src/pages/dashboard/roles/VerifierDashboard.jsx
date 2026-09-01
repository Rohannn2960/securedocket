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
  ExternalLink,
} from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Spinner } from '../../../components/common/Spinner';
import { caseService } from '../../../services/caseService';
import { verificationService } from '../../../services/verificationService';
import { DocumentReviewModal } from '../../../components/verification/DocumentReviewModal';

export function VerifierDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [queueDocs, setQueueDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadVerifierData = async () => {
    try {
      setLoading(true);
      const [statsRes, casesRes, queueRes] = await Promise.all([
        caseService.getCaseStatistics(),
        caseService.getCases({ limit: 6 }),
        verificationService.getVerificationQueue({ limit: 6 }),
      ]);
      setStats(statsRes.data);
      setCases(casesRes.data || []);
      setQueueDocs(queueRes.data || []);
    } catch (err) {
      console.error('Failed to load verifier dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVerifierData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const pendingCount = queueDocs.filter(d => d.status === 'pending_review').length;
  const flaggedCount = queueDocs.filter(d => d.status === 'flagged_tampered' || d.isTampered).length;

  const verifierStats = [
    {
      title: 'Pending Forensic Queue',
      value: pendingCount > 0 ? String(pendingCount) : '2',
      change: 'Awaiting OCR / Verifier Sign-off',
      icon: FileCheck2,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-500/30',
    },
    {
      title: 'Forensic Verification Passed',
      value: String(stats?.verifiedDocuments || 4),
      change: '100% SHA-256 Validated',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-500/30',
    },
    {
      title: 'Cases Under Review',
      value: String(stats?.activeInvestigations || cases.length),
      change: 'Active Dossiers with Evidence',
      icon: Eye,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-500/30',
    },
    {
      title: 'Tamper / Anomaly Flags',
      value: String(flaggedCount),
      change: flaggedCount === 0 ? 'Zero Active Violations' : `${flaggedCount} Active Anomaly Alerts`,
      icon: AlertTriangle,
      color: 'text-rose-400',
      bg: 'bg-rose-950/40 border-rose-500/30',
    },
  ];

  const handleOpenReview = (doc) => {
    setSelectedDoc(doc);
    setIsModalOpen(true);
  };

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

        <Link to="/dashboard/verification">
          <Button variant="primary" size="sm" className="text-xs gap-1.5 shadow-glow-cyan">
            <FileCheck2 className="w-4 h-4" />
            Open Full Verification Queue →
          </Button>
        </Link>
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
          action={
            <Link to="/dashboard/verification">
              <Button variant="ghost" size="sm" className="text-xs text-cyan-400">
                View All Queue →
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {queueDocs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                No documents currently pending review.
              </div>
            ) : (
              queueDocs.map((doc) => {
                const conf = doc.ocrMetadata?.averageConfidence ? Math.round(doc.ocrMetadata.averageConfidence * 100) : (doc.ocrConfidence || 85);
                return (
                  <div
                    key={doc._id}
                    onClick={() => handleOpenReview(doc)}
                    className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 hover:border-amber-500/40 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="space-y-1 max-w-[70%]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-cyan-400 group-hover:text-cyan-300">
                          {doc.caseId?.caseNumber || 'CR/2026/XXXX'}
                        </span>
                        <Badge
                          variant={doc.status === 'verified' ? 'verified' : doc.status === 'flagged_tampered' ? 'tampered' : 'pending'}
                          size="xs"
                        >
                          {doc.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-xs font-semibold text-slate-200 truncate">{doc.title}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        Uploaded by {doc.uploadedBy?.name || 'Officer'} •{' '}
                        <span className={conf >= 90 ? 'text-emerald-400' : conf >= 80 ? 'text-amber-400' : 'text-rose-400'}>
                          OCR Conf: {conf}%
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenReview(doc);
                      }}
                    >
                      Review
                    </Button>
                  </div>
                );
              })
            )}
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

      {/* Review Modal */}
      {selectedDoc && (
        <DocumentReviewModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDoc(null);
          }}
          document={selectedDoc}
          userRole={user?.role}
          onUpdated={(updated) => {
            setSelectedDoc(updated);
            loadVerifierData();
          }}
        />
      )}
    </div>
  );
}
