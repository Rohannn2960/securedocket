import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Search, Filter, Shield, User, RefreshCw, ArrowUpRight } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { caseService } from '../../services/caseService';
import { formatDate } from '../../utils/formatters';

const STATUS_FILTERS = [
  { label: 'All Statuses', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'Under Investigation', value: 'under_investigation' },
  { label: 'Pending Trial', value: 'pending_trial' },
  { label: 'Closed / Archived', value: 'closed' },
];

export function Cases() {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Register Case Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);
  const [caseForm, setCaseForm] = useState({
    caseNumber: '',
    title: '',
    description: '',
    jurisdiction: 'Central Cyber Crime Police Station',
    priority: 'medium',
    status: 'open',
  });

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await caseService.getCases({
        search,
        status: selectedStatus || undefined,
      });
      setCases(res.data || []);
    } catch (err) {
      setError(err?.message || 'Failed to retrieve cases');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [selectedStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCases();
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);
    try {
      await caseService.createCase(caseForm);
      setIsModalOpen(false);
      setCaseForm({
        caseNumber: '',
        title: '',
        description: '',
        jurisdiction: 'Central Cyber Crime Police Station',
        priority: 'medium',
        status: 'open',
      });
      fetchCases();
    } catch (err) {
      setFormError(err?.message || 'Failed to register legal case file');
    } finally {
      setFormLoading(false);
    }
  };

  const canRegister = user?.role === 'officer' || user?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header and New Case Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-cyan-400" />
            Legal Case Registry
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {user?.role === 'officer'
              ? 'Authorized case files assigned to your investigation unit.'
              : 'Official repository of state crime records and evidentiary dossiers.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchCases}>
            Refresh
          </Button>
          {canRegister && (
            <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
              Register New Case
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full flex gap-2">
          <Input
            placeholder="Search by case reference (e.g. CR/2026/0891) or title..."
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-defense-900/80 w-full"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-defense-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Case Dossier Cards Grid */}
      {loading ? (
        <div className="py-20 text-center">
          <Spinner size="lg" />
        </div>
      ) : cases.length === 0 ? (
        <div className="py-16 text-center glass-panel rounded-2xl border border-slate-800 space-y-2">
          <Briefcase className="w-8 h-8 text-slate-500 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">No Case Files Found</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {user?.role === 'officer'
              ? 'You do not have any cases currently assigned matching this search filter.'
              : 'No crime records found in registry.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cases.map((caseItem) => (
            <Link key={caseItem._id} to={`/dashboard/cases/${caseItem._id}`} className="block group">
              <Card
                title={caseItem.caseNumber}
                badge={
                  <Badge
                    variant={
                      caseItem.metadata?.priority === 'critical'
                        ? 'tampered'
                        : caseItem.metadata?.priority === 'high'
                        ? 'pending'
                        : 'cyan'
                    }
                    size="xs"
                  >
                    {caseItem.metadata?.priority || 'medium'}
                  </Badge>
                }
                className="hover:border-cyan-500/40 transition-all flex flex-col justify-between h-full group-hover:bg-defense-900/90"
                footer={
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">
                      {caseItem.documentsCount || 0} Vault Documents
                    </span>
                    <span className="font-mono text-cyan-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View Dossier <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        caseItem.status === 'open'
                          ? 'cyan'
                          : caseItem.status === 'under_investigation'
                          ? 'pending'
                          : 'verified'
                      }
                      size="xs"
                    >
                      {caseItem.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                    {caseItem.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{caseItem.jurisdiction}</p>

                  <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-slate-300">
                        Lead: {caseItem.leadOfficer?.name || 'Assigned Officer'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span>Assigned Units:</span>
                      <span className="text-slate-300">
                        {caseItem.assignedOfficers?.length || 1} Officers
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Register Case Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Investigation Case"
        maxWidth="max-w-lg"
      >
        {formError && <Alert variant="error">{formError}</Alert>}

        <form onSubmit={handleCreateCase} className="space-y-4">
          <Input
            label="Case / Crime Number"
            placeholder="e.g. CR/2026/0942-BLR"
            value={caseForm.caseNumber}
            onChange={(e) => setCaseForm({ ...caseForm, caseNumber: e.target.value })}
            required
          />
          <Input
            label="Case Title"
            placeholder="e.g. Digital Banking Fraud & Wire Manipulation"
            value={caseForm.title}
            onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })}
            required
          />
          <Input
            label="Police Station / Jurisdiction"
            placeholder="e.g. Central Cyber Crime Police Station"
            value={caseForm.jurisdiction}
            onChange={(e) => setCaseForm({ ...caseForm, jurisdiction: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 block">
                Priority
              </label>
              <select
                value={caseForm.priority}
                onChange={(e) => setCaseForm({ ...caseForm, priority: e.target.value })}
                className="w-full bg-defense-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="critical">Critical Emergency</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 block">
                Initial Status
              </label>
              <select
                value={caseForm.status}
                onChange={(e) => setCaseForm({ ...caseForm, status: e.target.value })}
                className="w-full bg-defense-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="open">Open</option>
                <option value="under_investigation">Under Investigation</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 block">
              Case Summary / Initial Report
            </label>
            <textarea
              className="w-full bg-defense-900 border border-slate-700/80 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
              rows={3}
              placeholder="Initial details and context of the crime dossier..."
              value={caseForm.description}
              onChange={(e) => setCaseForm({ ...caseForm, description: e.target.value })}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={formLoading}>
              Register Dossier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
