import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, UserPlus, Shield, ShieldCheck, UserX, CheckCircle, Search, RefreshCw, KeyRound } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Alert } from '../../components/common/Alert';
import { Spinner } from '../../components/common/Spinner';
import { userService } from '../../services/authService';
import { formatDate } from '../../utils/formatters';

export function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Create User Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'officer',
    badgeNumber: '',
    department: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createdUserData, setCreatedUserData] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userService.getUsers({ search });
      setUsers(res.data || []);
    } catch (err) {
      setError(err?.message || 'Failed to retrieve system users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setError(null);
    try {
      const res = await userService.createUser(createForm);
      setCreatedUserData(res.data);
      fetchUsers();
    } catch (err) {
      setError(err?.message || 'Failed to create user account');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      await userService.updateUserStatus(user._id, !user.isActive);
      fetchUsers();
    } catch (err) {
      alert(err?.message || 'Failed to change user status');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await userService.updateUserRole(userId, newRole);
      fetchUsers();
    } catch (err) {
      alert(err?.message || 'Failed to update clearance role');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-cyan-400" />
            Personnel & Access Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Admin oversight of investigating officers, forensic verifiers, and judicial auditors with mandatory 2FA enrollment.
          </p>
        </div>
        <Button variant="primary" icon={UserPlus} onClick={() => { setCreatedUserData(null); setIsCreateOpen(true); }}>
          Enroll New Officer
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* User Roster Table */}
      <Card
        title="Active Official Accounts"
        subtitle="Role clearances, badge identifiers, and 2FA status"
        action={
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={fetchUsers}>
            Refresh
          </Button>
        }
      >
        {loading ? (
          <div className="py-12 text-center">
            <Spinner size="lg" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No personnel accounts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-3 px-3">Officer / Official</th>
                  <th className="py-3 px-3">Clearance Role</th>
                  <th className="py-3 px-3">Badge / Dept</th>
                  <th className="py-3 px-3">2FA Status</th>
                  <th className="py-3 px-3">Account Status</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-defense-900/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="text-slate-100 font-semibold">{u.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="bg-defense-950 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                      >
                        <option value="officer">Officer</option>
                        <option value="verifier">Verifier</option>
                        <option value="admin">Admin</option>
                        <option value="auditor">Auditor</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-slate-300 font-mono">
                      <div>{u.badgeNumber || '—'}</div>
                      <div className="text-[10px] text-slate-500">{u.department || '—'}</div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={u.totpEnabled ? 'verified' : 'pending'} size="xs">
                        {u.totpEnabled ? '2FA ACTIVE' : 'PENDING ENROLL'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={u.isActive ? 'cyan' : 'tampered'} size="xs">
                        {u.isActive ? 'ACTIVE' : 'SUSPENDED'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant={u.isActive ? 'ghost' : 'secondary'}
                        size="sm"
                        className={u.isActive ? 'text-rose-400 text-xs' : 'text-emerald-400 text-xs'}
                        onClick={() => handleToggleStatus(u)}
                      >
                        {u.isActive ? 'Suspend' : 'Reactivate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create User & 2FA Onboarding Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={createdUserData ? '2FA Credentials Generated' : 'Enroll New Official Account'}
        maxWidth="max-w-lg"
      >
        {createdUserData ? (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-slate-100">Account Enrolled Successfully</h4>
              <p className="text-xs text-slate-400 mt-1">
                Provide the officer with their initial login passphrase and have them scan this QR code on their authenticator device.
              </p>
            </div>

            <div className="p-4 bg-white rounded-xl inline-block shadow-xl">
              <img
                src={createdUserData.totpSetup.qrCodeDataUrl}
                alt="2FA QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>

            <div className="p-3 bg-defense-950 rounded-xl border border-slate-800 text-left font-mono text-xs space-y-1">
              <div className="text-slate-400 text-[11px]">Manual Setup Secret:</div>
              <div className="text-emerald-300 break-all select-all font-bold">
                {createdUserData.totpSetup.secret}
              </div>
            </div>

            <Button variant="primary" onClick={() => setIsCreateOpen(false)} className="w-full">
              Done & Return to Roster
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateUser} className="space-y-4">
            <Input
              label="Official Full Name"
              placeholder="e.g. Sub-Inspector R. K. Varma"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
            <Input
              label="Official Email Address"
              type="email"
              placeholder="officer.varma@police.gov.in"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              required
            />
            <Input
              label="Initial Temporary Passphrase"
              type="password"
              placeholder="Min 8 characters"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5 block">
                  Clearance Role
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full bg-defense-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                >
                  <option value="officer">Officer (Case Investigation)</option>
                  <option value="verifier">Verifier (Forensic Validation)</option>
                  <option value="auditor">Auditor (Judicial Oversight)</option>
                  <option value="admin">Admin (System Manager)</option>
                </select>
              </div>
              <Input
                label="Badge Number"
                placeholder="CCB-4412"
                value={createForm.badgeNumber}
                onChange={(e) => setCreateForm({ ...createForm, badgeNumber: e.target.value })}
              />
            </div>

            <Input
              label="Department / Unit"
              placeholder="Central Cyber Crime Division"
              value={createForm.department}
              onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
            />

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" isLoading={createLoading}>
                Generate 2FA Onboarding
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
