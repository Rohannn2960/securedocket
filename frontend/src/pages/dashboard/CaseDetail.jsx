import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Briefcase,
  ArrowLeft,
  UserPlus,
  ShieldCheck,
  FileText,
  Clock,
  User,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  History,
  Lock,
  UploadCloud,
  Sparkles,
  GitCommit,
  Network,
  Users,
  Building2,
  Tag,
  Eye,
  RefreshCw,
  HelpCircle,
  Share2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { caseService } from '../../services/caseService';
import { documentService } from '../../services/documentService';
import { intelligenceService } from '../../services/intelligenceService';
import { DocumentUploadModal } from '../../components/documents/DocumentUploadModal';
import { DocumentDetailModal } from '../../components/documents/DocumentDetailModal';
import { formatDate, truncateHash } from '../../utils/formatters';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'under_investigation', label: 'Under Investigation' },
  { value: 'pending_trial', label: 'Pending Trial' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

export function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Tab: 'dossier' | 'timeline' | 'entities'
  const [activeTab, setActiveTab] = useState('dossier');

  // Case Intelligence state
  const [intelData, setIntelData] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState(null);
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [entityCategoryFilter, setEntityCategoryFilter] = useState('all');

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [availableOfficers, setAvailableOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isDocDetailOpen, setIsDocDetailOpen] = useState(false);

  const fetchCaseDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await caseService.getCaseById(id);
      setCaseData(res.data);
    } catch (err) {
      setError(err?.message || 'Failed to load case dossier');
    } finally {
      setLoading(false);
    }
  };

  const fetchIntelligence = async () => {
    setIntelLoading(true);
    setIntelError(null);
    try {
      const res = await intelligenceService.getCaseIntelligence(id);
      setIntelData(res.data?.data || res.data);
    } catch (err) {
      setIntelError(err?.message || 'Failed to generate case intelligence');
    } finally {
      setIntelLoading(false);
    }
  };

  useEffect(() => {
    fetchCaseDetails();
    fetchIntelligence();
  }, [id]);

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try {
      await caseService.updateCase(id, { status: newStatus });
      fetchCaseDetails();
    } catch (err) {
      alert(err?.message || 'Failed to update case status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleOpenAssignModal = async () => {
    setIsAssignModalOpen(true);
    setAssignError(null);
    try {
      const res = await caseService.getOfficersRoster();
      const officersList = res.data || [];
      setAvailableOfficers(officersList);
      if (officersList.length > 0) {
        setSelectedOfficerId(officersList[0]._id);
      }
    } catch (err) {
      setAssignError(err?.message || 'Failed to fetch officer roster');
    }
  };

  const handleAssignOfficerSubmit = async (e) => {
    e.preventDefault();
    if (!selectedOfficerId) return;

    setAssignLoading(true);
    setAssignError(null);
    try {
      await caseService.assignOfficers(id, [selectedOfficerId]);
      setIsAssignModalOpen(false);
      fetchCaseDetails();
    } catch (err) {
      setAssignError(err?.message || 'Failed to assign officer');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleOpenDocDetail = async (doc) => {
    // Enrich with current case info
    const initialDoc = {
      ...doc,
      caseId: {
        _id: caseData._id,
        caseNumber: caseData.caseNumber,
        title: caseData.title,
      },
    };
    setSelectedDoc(initialDoc);
    setIsDocDetailOpen(true);

    const docId = doc._id || doc.id;
    if (docId) {
      try {
        const res = await documentService.getDocumentById(docId);
        const fullDoc = res.data?.document || res.data;
        if (fullDoc) {
          setSelectedDoc({
            ...fullDoc,
            caseId: fullDoc.caseId || initialDoc.caseId,
          });
        }
      } catch (err) {
        console.warn('Failed to load complete document details:', err);
      }
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" icon={ArrowLeft} onClick={() => navigate('/dashboard/cases')}>
          Back to Case Registry
        </Button>
        <Alert variant="error">{error || 'Case not found'}</Alert>
      </div>
    );
  }

  const canEdit = user?.role === 'officer' || user?.role === 'admin';

  // Helper functions for safe rendering
  const getOfficerId = (officer) => {
    if (!officer) return '';
    if (typeof officer === 'object') return officer._id?.toString() || '';
    return officer.toString();
  };

  const getOfficerName = (officer) => {
    if (!officer) return 'Assigned Officer';
    if (typeof officer === 'object') return officer.name || officer.email || 'Assigned Officer';
    return `Officer (${truncateHash(officer.toString(), 4, 4)})`;
  };

  const getOfficerEmail = (officer) => {
    if (!officer) return '—';
    if (typeof officer === 'object') return officer.email || '—';
    return '—';
  };

  const getOfficerBadge = (officer, fallback = 'CCB-XXXX') => {
    if (!officer) return fallback;
    if (typeof officer === 'object') return officer.badgeNumber || fallback;
    return fallback;
  };

  const leadOfficerId = getOfficerId(caseData.leadOfficer);
  const coAssignedOfficers = Array.isArray(caseData.assignedOfficers)
    ? caseData.assignedOfficers.filter((o) => {
        const oId = getOfficerId(o);
        return oId && oId !== leadOfficerId;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/dashboard/cases')}>
          Back to Case Registry
        </Button>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              caseData.metadata?.priority === 'critical'
                ? 'tampered'
                : caseData.metadata?.priority === 'high'
                ? 'pending'
                : 'cyan'
            }
          >
            {caseData.metadata?.priority?.toUpperCase() || 'MEDIUM PRIORITY'}
          </Badge>
          <Badge variant="verified">SSE-S3 ENCRYPTED</Badge>
        </div>
      </div>

      {/* Case Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-defense-900 via-defense-950 to-defense-900 border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono font-bold text-cyan-400">
              {caseData.caseNumber}
            </div>
            <h2 className="text-2xl font-bold text-slate-100">{caseData.title}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono pt-1">
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {caseData.jurisdiction}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Registered: {formatDate(caseData.createdAt)}
              </span>
            </div>
          </div>

          {/* Status Updater */}
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-slate-400">Status:</div>
            {canEdit ? (
              <select
                value={caseData.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updatingStatus}
                className="bg-defense-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs font-semibold text-cyan-300 focus:outline-none focus:border-cyan-500"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <Badge variant="cyan">{caseData.status ? caseData.status.replace('_', ' ') : 'OPEN'}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation: Dossier Overview | Case Timeline | Entity Linking */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('dossier')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'dossier'
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
              : 'text-slate-400 hover:text-slate-200 hover:bg-defense-900/60'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Dossier Overview
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'timeline'
              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-glow-amber'
              : 'text-slate-400 hover:text-slate-200 hover:bg-defense-900/60'
          }`}
        >
          <GitCommit className="w-3.5 h-3.5 text-amber-400" />
          Case Timeline
          {intelData?.summary?.totalEvents > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
              {intelData.summary.totalEvents}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('entities')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'entities'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-glow-emerald'
              : 'text-slate-400 hover:text-slate-200 hover:bg-defense-900/60'
          }`}
        >
          <Network className="w-3.5 h-3.5 text-emerald-400" />
          Entity Linking Graph
          {intelData?.summary?.totalEntities > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
              {intelData.summary.totalEntities}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('relationships')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'relationships'
              ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40 shadow-glow-purple'
              : 'text-slate-400 hover:text-slate-200 hover:bg-defense-900/60'
          }`}
        >
          <Share2 className="w-3.5 h-3.5 text-purple-400" />
          Cross-Case Similarity
          {intelData?.summary?.totalRelatedCases > 0 && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300">
              {intelData.summary.totalRelatedCases}
            </span>
          )}
        </button>

        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            isLoading={intelLoading}
            onClick={fetchIntelligence}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Refresh Intelligence
          </Button>
        </div>
      </div>

      {/* TAB 1: DOSSIER OVERVIEW */}
      {activeTab === 'dossier' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Summary & Linked Documents */}
          <div className="lg:col-span-2 space-y-6">
            {/* Summary */}
            <Card title="Case Dossier Summary" subtitle="Official investigation details and crime notes">
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                {caseData.description || 'No initial summary recorded for this case.'}
              </p>

              {caseData.metadata?.tags?.length > 0 && (
                <div className="pt-4 mt-4 border-t border-slate-800 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-mono text-slate-500">TAGS:</span>
                  {caseData.metadata.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-defense-900 text-slate-300 border border-slate-800"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            {/* Linked Documents Vault */}
            <Card
              title={`Evidentiary Documents (${caseData.documents?.length || 0})`}
              subtitle="Case files secured with SHA-256 client/server cryptographic hashing"
              action={
                canEdit ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={UploadCloud}
                    className="text-xs"
                    onClick={() => setIsUploadModalOpen(true)}
                  >
                    Upload Document
                  </Button>
                ) : null
              }
            >
              {caseData.documents?.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                  <div>No documents attached to this case dossier yet.</div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={UploadCloud}
                      className="text-xs text-cyan-400"
                      onClick={() => setIsUploadModalOpen(true)}
                    >
                      Upload Evidence File Now
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {caseData.documents?.map((doc) => (
                    <div
                      key={doc._id}
                      onClick={() => handleOpenDocDetail(doc)}
                      className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 hover:border-cyan-500/50 hover:bg-defense-900 transition-all cursor-pointer flex items-center justify-between"
                    >
                      <div className="space-y-1 max-w-[70%]">
                        <div className="text-xs font-semibold text-slate-200 truncate">
                          {doc.originalName || doc.fileName}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-400">
                          SHA-256: {truncateHash(doc.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4', 8, 8)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={doc.isTampered ? 'tampered' : 'verified'} size="xs">
                          {doc.status?.replace('_', ' ').toUpperCase() || 'VALID'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right 1 Col: Assigned Investigation Officers */}
          <div className="space-y-6">
            <Card
              title="Assigned Personnel"
              subtitle="Officers with clearance for this dossier"
              action={
                canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={UserPlus}
                    className="text-xs text-cyan-400"
                    onClick={handleOpenAssignModal}
                  >
                    Assign
                  </Button>
                ) : null
              }
            >
              <div className="space-y-3">
                {/* Lead Officer */}
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300">
                      {getOfficerName(caseData.leadOfficer)}
                    </span>
                    <Badge variant="cyan" size="xs">
                      LEAD
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {getOfficerEmail(caseData.leadOfficer)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Badge: {getOfficerBadge(caseData.leadOfficer, 'CCB-9842')}
                  </div>
                </div>

                {/* Co-Assigned Officers */}
                {coAssignedOfficers.map((officer) => {
                  const oId = getOfficerId(officer);
                  return (
                    <div
                      key={oId}
                      className="p-3 rounded-xl bg-defense-900/60 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">
                          {getOfficerName(officer)}
                        </span>
                        <Badge variant="default" size="xs">
                          ASSIGNED
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {getOfficerEmail(officer)}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Badge: {getOfficerBadge(officer, 'CCB-XXXX')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: CASE CHRONOLOGICAL TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* Timeline Metrics Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-defense-900/80 border border-slate-800 space-y-1">
              <div className="text-[11px] font-mono text-slate-400">TOTAL CHRONOLOGICAL EVENTS</div>
              <div className="text-xl font-bold font-mono text-slate-100">
                {intelData?.summary?.totalEvents || 0}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
              <div className="text-[11px] font-mono text-emerald-400">CERTAIN DATED EVENTS</div>
              <div className="text-xl font-bold font-mono text-emerald-300">
                {intelData?.summary?.certainEventsCount || 0}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1">
              <div className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                UNCERTAIN / UNDER REVIEW
              </div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {intelData?.summary?.uncertainEventsCount || 0}
              </div>
            </div>
          </div>

          {/* Timeline Feed */}
          {intelLoading ? (
            <div className="py-16 text-center">
              <Spinner size="lg" className="mx-auto mb-3" />
              <div className="text-xs text-slate-400 font-mono">Synthesizing chronological evidence graph...</div>
            </div>
          ) : !intelData?.timeline || intelData.timeline.length === 0 ? (
            <Card>
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Clock className="w-8 h-8 text-slate-600 mx-auto" />
                <div>No timeline events extracted yet. Upload FIR, Statements, or Forensics reports to populate.</div>
              </div>
            </Card>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-amber-500 before:to-emerald-500">
              {intelData.timeline.map((evt, idx) => (
                <div key={evt.id || idx} className="relative group">
                  {/* Timeline Dot Node */}
                  <div
                    className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 bg-defense-950 transition-transform group-hover:scale-125 ${
                      evt.isUncertain
                        ? 'border-amber-400 shadow-glow-amber'
                        : evt.eventType === 'incident_occurred'
                        ? 'border-red-400 shadow-glow-red'
                        : evt.eventType === 'fir_registered'
                        ? 'border-cyan-400 shadow-glow-cyan'
                        : evt.eventType === 'forensic_examination'
                        ? 'border-purple-400 shadow-glow-purple'
                        : 'border-emerald-400 shadow-glow-emerald'
                    }`}
                  />

                  {/* Event Card */}
                  <div className="p-4 rounded-2xl bg-defense-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            evt.isUncertain
                              ? 'tampered'
                              : evt.eventType === 'incident_occurred'
                              ? 'tampered'
                              : evt.eventType === 'fir_registered'
                              ? 'cyan'
                              : evt.eventType === 'forensic_examination'
                              ? 'verified'
                              : 'default'
                          }
                          size="xs"
                        >
                          {evt.eventType.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {evt.formattedDate}
                        </span>
                        {evt.isUncertain && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Uncertain Date (Pending Review)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400">
                          Confidence: {Math.round(evt.confidence * 100)}%
                        </span>
                        <Badge variant="default" size="xs">
                          {evt.extractedBy === 'human_verified' ? 'VERIFIED' : 'AI EXTRACTED'}
                        </Badge>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-100">{evt.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed">{evt.description}</p>

                    {/* Location & Source Document */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                      {evt.location ? (
                        <span className="flex items-center gap-1 text-slate-400 font-mono text-[11px]">
                          <MapPin className="w-3 h-3 text-cyan-400" />
                          {evt.location}
                        </span>
                      ) : (
                        <span />
                      )}

                      <button
                        onClick={async () => {
                          try {
                            const docRes = await documentService.getDocumentById(evt.sourceDocumentId);
                            handleOpenDocDetail(docRes.data?.document || docRes.data);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Source: {evt.sourceDocumentTitle} ({evt.sourceDocumentType})
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CROSS-DOCUMENT ENTITY LINKING */}
      {activeTab === 'entities' && (
        <div className="space-y-6">
          {/* Header & Category Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Network className="w-4 h-4 text-emerald-400" />
                Cross-Document Entity Knowledge Graph
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically identifies recurring persons, crime scenes, organizations, and evidence across documents within this case.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-defense-900 p-1 rounded-xl border border-slate-800 text-xs">
              {['all', 'person', 'location', 'organization', 'evidence_identifier'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setEntityCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                    entityCategoryFilter === cat
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'all'
                    ? 'All Entities'
                    : cat === 'person'
                    ? 'Persons'
                    : cat === 'location'
                    ? 'Locations'
                    : cat === 'organization'
                    ? 'Organizations'
                    : 'Evidence IDs'}
                </button>
              ))}
            </div>
          </div>

          {/* Entities Grid */}
          {intelLoading ? (
            <div className="py-16 text-center">
              <Spinner size="lg" className="mx-auto mb-3" />
              <div className="text-xs text-slate-400 font-mono">Cross-referencing entities across case dossier...</div>
            </div>
          ) : !intelData?.entities || intelData.entities.length === 0 ? (
            <Card>
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Network className="w-8 h-8 text-slate-600 mx-auto" />
                <div>No entities resolved across documents yet. Ingest documents to initiate entity linking.</div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {intelData.entities
                .filter((ent) => entityCategoryFilter === 'all' || ent.category === entityCategoryFilter)
                .map((ent) => (
                  <div
                    key={ent.id}
                    className="p-5 rounded-2xl bg-defense-900/80 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`p-1.5 rounded-lg ${
                              ent.category === 'person'
                                ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                                : ent.category === 'location'
                                ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                                : ent.category === 'organization'
                                ? 'bg-purple-950 text-purple-400 border border-purple-500/30'
                                : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {ent.category === 'person' ? (
                              <User className="w-4 h-4" />
                            ) : ent.category === 'location' ? (
                              <MapPin className="w-4 h-4" />
                            ) : ent.category === 'organization' ? (
                              <Building2 className="w-4 h-4" />
                            ) : (
                              <Tag className="w-4 h-4" />
                            )}
                          </span>
                          <h4 className="text-sm font-bold text-slate-100">{ent.canonicalName}</h4>
                        </div>
                        <div className="text-[11px] font-mono text-cyan-400 pl-8">
                          Role: {ent.primaryRole}
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        {ent.isMultiDocument ? (
                          <Badge variant="verified" size="xs">
                            {ent.distinctDocumentCount} Documents Linked
                          </Badge>
                        ) : (
                          <Badge variant="default" size="xs">
                            1 Document Mention
                          </Badge>
                        )}
                        <div className="text-[10px] font-mono text-emerald-400">
                          {Math.round(ent.confidence * 100)}% Match Confidence
                        </div>
                      </div>
                    </div>

                    {/* Aliases */}
                    {ent.aliases?.length > 1 && (
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-slate-500">Aliases:</span>
                        {ent.aliases.map((alias, aIdx) => (
                          <span
                            key={aIdx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-defense-950 text-slate-300 border border-slate-800"
                          >
                            {alias}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Linked Documents & Contextual Snippets */}
                    <div className="pt-2 border-t border-slate-800/80 space-y-2">
                      <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                        Linked Evidentiary Context:
                      </div>
                      <div className="space-y-2">
                        {ent.linkedDocuments?.map((ld, ldIdx) => (
                          <div
                            key={ldIdx}
                            className="p-2.5 rounded-xl bg-defense-950/80 border border-slate-800/80 space-y-1.5"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-200 truncate max-w-[70%]">
                                {ld.documentTitle} ({ld.documentType})
                              </span>
                              <button
                                onClick={async () => {
                                  try {
                                    const docRes = await documentService.getDocumentById(ld.documentId);
                                    handleOpenDocDetail(docRes.data?.document || docRes.data);
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" /> Inspect
                              </button>
                            </div>
                            <p className="text-[11px] text-slate-300 italic leading-relaxed">
                              "{ld.snippet}"
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CROSS-CASE SIMILARITY & RELATIONSHIP INTELLIGENCE */}
      {activeTab === 'relationships' && (
        <div className="space-y-6">
          {/* Decision-Support & Authenticity Protocol Banner */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
              <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
              <span>AI INVESTIGATIVE DECISION-SUPPORT PROTOCOL</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Potential case relationships and similarity scores are AI-assisted analytical aids computed from authorized case profile signals (extracted entities, locations, legal statutes, and document semantics). They do <strong className="text-purple-300 font-semibold">NOT</strong> represent factual or legal proof of real-world connection and remain subject to independent investigator review.
            </p>
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 pt-1 border-t border-purple-900/40">
              <span>Threshold: ≥ 25% Relevance Score</span>
              <span>•</span>
              <span>Scope: Strictly authorized cases</span>
              <span>•</span>
              <span>Deterministic Multi-Signal Engine</span>
            </div>
          </div>

          {intelLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Spinner size="md" className="mx-auto mb-3" />
              Computing multi-signal case profile similarities across authorized cases...
            </div>
          ) : !intelData?.relationships || intelData.relationships.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2 rounded-2xl bg-defense-900/40 border border-slate-800">
              <Share2 className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="font-semibold text-slate-300">No Potentially Related Cases Discovered</div>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                No authorized candidate cases meet or exceed the documented relevance threshold (≥ 25%) based on current shared entities, locations, legal statutes, or semantic vectors.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing <strong className="text-slate-200">{intelData.relationships.length}</strong> potentially related candidate case{intelData.relationships.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {intelData.relationships.map((rel, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-defense-900/80 border border-slate-800/80 hover:border-purple-500/40 transition-all space-y-4"
                  >
                    {/* Header with Case Info & Similarity Score */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/cases/${rel.targetCaseId}`}
                            className="text-sm font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5"
                          >
                            <span>{rel.caseNumber}</span>
                            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                          </Link>
                          <Badge variant="default" size="xs">
                            {rel.status?.replace('_', ' ').toUpperCase()}
                          </Badge>
                          {rel.jurisdiction && (
                            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {rel.jurisdiction}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-medium text-slate-200">{rel.title}</h4>
                      </div>

                      {/* Similarity Badge & Confidence */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-base font-bold font-mono ${
                            rel.similarityPercentage >= 70 ? 'text-emerald-400' :
                            rel.similarityPercentage >= 45 ? 'text-amber-400' : 'text-purple-400'
                          }`}>
                            {rel.similarityPercentage}%
                          </span>
                          <Badge
                            variant={
                              rel.confidenceLevel === 'high' ? 'verified' :
                              rel.confidenceLevel === 'medium' ? 'pending' : 'default'
                            }
                            size="xs"
                          >
                            {rel.relationshipType?.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500">
                          Confidence: {rel.confidenceLevel.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Explainable Signals / Reasons */}
                    {rel.reasons?.length > 0 && (
                      <div className="p-3 rounded-xl bg-defense-950/70 border border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                          Intelligence Signals & Correlation Reasons:
                        </span>
                        <ul className="space-y-1">
                          {rel.reasons.map((reason, rIdx) => (
                            <li key={rIdx} className="text-xs text-slate-300 flex items-start gap-2">
                              <span className="text-purple-400 font-bold mt-0.5">•</span>
                              <span>{reason}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Breakdown Badges */}
                    <div className="flex flex-wrap gap-4 pt-1 text-xs">
                      {rel.sharedEntities?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-500">Entities:</span>
                          {rel.sharedEntities.map((ent, eIdx) => (
                            <span
                              key={eIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/50"
                            >
                              {ent.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      )}

                      {rel.sharedLocations?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-500">Locations:</span>
                          {rel.sharedLocations.map((loc, lIdx) => (
                            <span
                              key={lIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50"
                            >
                              {loc.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      )}

                      {rel.sharedSections?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-slate-500">Legal Sections:</span>
                          {rel.sharedSections.map((sec, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50"
                            >
                              {sec.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Assign Officer Modal */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Assign Investigating Officer"
        maxWidth="max-w-md"
      >
        {assignError && <Alert variant="error">{assignError}</Alert>}

        {availableOfficers.length === 0 && !assignError ? (
          <div className="py-6 text-center text-xs text-slate-400">
            <Spinner size="sm" className="mb-2 mx-auto" />
            Loading officer roster...
          </div>
        ) : (
          <form onSubmit={handleAssignOfficerSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 block">
                Select Officer from Active Roster
              </label>
              <select
                value={selectedOfficerId}
                onChange={(e) => setSelectedOfficerId(e.target.value)}
                className="w-full bg-defense-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {availableOfficers.map((o) => (
                  <option key={o._id} value={o._id}>
                    {o.name} ({o.email}) - {o.badgeNumber || 'No Badge'}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={assignLoading} disabled={!selectedOfficerId}>
                Assign to Case
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Upload Document Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        initialCaseId={caseData._id}
        onUploadSuccess={() => {
          fetchCaseDetails();
        }}
      />

      {/* Document Detail Modal */}
      <DocumentDetailModal
        isOpen={isDocDetailOpen}
        onClose={() => setIsDocDetailOpen(false)}
        document={selectedDoc}
        onUpdated={(updated) => {
          setSelectedDoc(updated);
          fetchCaseDetails();
        }}
      />
    </div>
  );
}
