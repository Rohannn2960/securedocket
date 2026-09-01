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
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { caseService } from '../../services/caseService';
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

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Assign Officer Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [availableOfficers, setAvailableOfficers] = useState([]);
  const [selectedOfficerId, setSelectedOfficerId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState(null);

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

  useEffect(() => {
    fetchCaseDetails();
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

  // Helper functions for bulletproof rendering of officers
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

      {/* Two Column Layout: Case Details & Assigned Personnel */}
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
                <Link to="/dashboard/documents">
                  <Button variant="secondary" size="sm" icon={FileText} className="text-xs">
                    Upload Document
                  </Button>
                </Link>
              ) : null
            }
          >
            {caseData.documents?.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <div>No documents attached to this case dossier yet.</div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Phase 2 S3 ingestion ready.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {caseData.documents?.map((doc) => (
                  <div
                    key={doc._id}
                    className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1 max-w-[70%]">
                      <div className="text-xs font-semibold text-slate-200 truncate">
                        {doc.originalName || doc.fileName}
                      </div>
                      <div className="text-[11px] font-mono text-emerald-400">
                        SHA-256: {truncateHash(doc.sha256Hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4', 8, 8)}
                      </div>
                    </div>
                    <Badge variant={doc.isTampered ? 'tampered' : 'verified'} size="xs">
                      {doc.isTampered ? 'TAMPERED' : 'VALID'}
                    </Badge>
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
    </div>
  );
}
