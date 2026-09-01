import React, { useState } from 'react';
import { Briefcase, Plus, Search, Filter, Shield, User } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { formatDate } from '../../utils/formatters';

export function Cases() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [cases] = useState([
    {
      id: '1',
      caseNumber: 'CR/2026/0891-BLR',
      title: 'Cyber Heist & Fake Invoicing Scheme',
      status: 'under_investigation',
      jurisdiction: 'Central Cyber Crime Police Station, Bengaluru',
      leadOfficer: 'Inspector Vikram Singh',
      assignedOfficers: ['Inspector Vikram Singh', 'Sub-Inspector Ananya Rao'],
      incidentDate: '2026-08-15',
      priority: 'high',
      docsCount: 14,
    },
    {
      id: '2',
      caseNumber: 'CR/2026/0877-DEL',
      title: 'Narcotics Seizure & Forensic Ballistics Investigation',
      status: 'pending_trial',
      jurisdiction: 'Special Cell, New Delhi',
      leadOfficer: 'ACP Rajesh Malhotra',
      assignedOfficers: ['ACP Rajesh Malhotra', 'Forensic Expert Dr. S. Sen'],
      incidentDate: '2026-07-22',
      priority: 'critical',
      docsCount: 28,
    },
    {
      id: '3',
      caseNumber: 'CR/2026/0862-MUM',
      title: 'Land Record Tampering & Forgery Syndicate',
      status: 'open',
      jurisdiction: 'Economic Offences Wing, Mumbai',
      leadOfficer: 'Inspector Priya Nair',
      assignedOfficers: ['Inspector Priya Nair'],
      incidentDate: '2026-08-01',
      priority: 'medium',
      docsCount: 9,
    },
  ]);

  const filteredCases = cases.filter(
    (c) =>
      c.caseNumber.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase())
  );

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
            Dossiers of active investigations with assigned investigating officers and linked document records.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
          Register New Case
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Input
          placeholder="Search by case reference (e.g. CR/2026/0891) or title..."
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-defense-900/80"
        />
      </div>

      {/* Case Dossier Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCases.map((caseItem) => (
          <Card
            key={caseItem.id}
            title={caseItem.caseNumber}
            badge={
              <Badge
                variant={
                  caseItem.priority === 'critical'
                    ? 'tampered'
                    : caseItem.priority === 'high'
                    ? 'pending'
                    : 'cyan'
                }
                size="xs"
              >
                {caseItem.priority}
              </Badge>
            }
            className="hover:border-cyan-500/30 transition-all flex flex-col justify-between"
            footer={
              <div className="flex items-center justify-between">
                <span>{caseItem.docsCount} Vault Documents</span>
                <span className="font-mono text-cyan-400">View Dossier →</span>
              </div>
            }
          >
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
                {caseItem.title}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-2">{caseItem.jurisdiction}</p>

              <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-slate-300">{caseItem.leadOfficer}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span>Incident Date:</span>
                  <span className="text-slate-300">{caseItem.incidentDate}</span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Register Case Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Investigation Case"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsModalOpen(false);
          }}
          className="space-y-4"
        >
          <Input label="Case / Crime Number" placeholder="CR/2026/0904-BLR" required />
          <Input label="Case Title" placeholder="Digital Extortion & Phishing Operation" required />
          <Input label="Police Station / Jurisdiction" placeholder="Cyber Crime Police Station, North Zone" required />
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 block">
              Case Summary / Initial Report
            </label>
            <textarea
              className="w-full bg-defense-900 border border-slate-700/80 rounded-lg p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30"
              rows={3}
              placeholder="Initial details and context of the investigation..."
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Register Dossier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
