import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Briefcase,
  ShieldCheck,
  Server,
  UserPlus,
  ArrowUpRight,
  Database,
  Lock,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { Spinner } from '../../../components/common/Spinner';
import { caseService } from '../../../services/caseService';
import { userService } from '../../../services/authService';

export function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [cases, setCases] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const [statsRes, casesRes, usersRes] = await Promise.all([
          caseService.getCaseStatistics(),
          caseService.getCases({ limit: 4 }),
          userService.getUsers({ limit: 5 }),
        ]);
        setStats(statsRes.data);
        setCases(Array.isArray(casesRes.data) ? casesRes.data : casesRes.data?.cases || []);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data?.users || []);
      } catch (err) {
        console.error('Failed to load admin dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Spinner size="lg" />
      </div>
    );
  }

  const adminStats = [
    {
      title: 'Total System Cases',
      value: stats?.total || 0,
      change: 'Global Case Vault',
      icon: Briefcase,
      color: 'text-cyan-400',
      bg: 'bg-cyan-950/40 border-cyan-500/30',
    },
    {
      title: 'Active Personnel',
      value: users.length,
      change: '100% 2FA Enrolled',
      icon: Users,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-500/30',
    },
    {
      title: 'Active Investigations',
      value: stats?.activeInvestigations || 0,
      change: 'Across all Units',
      icon: ShieldCheck,
      color: 'text-indigo-400',
      bg: 'bg-indigo-950/40 border-indigo-500/30',
    },
    {
      title: 'Security Engine',
      value: 'AES-256',
      change: 'SSE-S3 + JWT 15m Rotated',
      icon: Lock,
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-defense-900 to-defense-950 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-semibold mb-1">
            <Server className="w-4 h-4" />
            <span>DIRECTORATE SYSTEM ADMINISTRATION CONSOLE</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            System Administrator: {user?.name || 'Dev Anand'}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Clearance: <span className="text-cyan-400 font-bold">SYSTEM ADMIN</span> • Department:{' '}
            <span className="text-slate-200">{user?.department || 'Digital Evidence Administration Directorate'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/users">
            <Button variant="primary" icon={UserPlus} size="sm">
              Manage Personnel Roster
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {adminStats.map((stat, i) => {
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

      {/* Two Column Layout: Global Case Registry & Personnel Roster */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Global Case Overview */}
        <Card
          title="Global Case Dossiers"
          subtitle="System-wide crime reference records across all regional stations"
          action={
            <Link to="/dashboard/cases">
              <Button variant="ghost" size="sm" className="text-xs text-cyan-400">
                Full Registry →
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {cases.map((c) => (
              <Link
                key={c._id}
                to={`/dashboard/cases/${c._id}`}
                className="p-3.5 rounded-xl bg-defense-900/60 border border-slate-800/80 hover:border-slate-700 transition-all flex items-center justify-between block group"
              >
                <div className="space-y-1 max-w-[70%]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-cyan-400 group-hover:text-cyan-300">
                      {c.caseNumber}
                    </span>
                    <Badge variant="default" size="xs">
                      {c.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 truncate">{c.title}</div>
                  <div className="text-[11px] text-slate-400">
                    Lead: {c.leadOfficer?.name || 'Assigned Officer'}
                  </div>
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

        {/* Personnel Roster Quick View */}
        <Card
          title="Enrolled Official Personnel"
          subtitle="Investigating officers, forensic verifiers, and judicial auditors"
          action={
            <Link to="/dashboard/users">
              <Button variant="ghost" size="sm" className="text-xs text-cyan-400">
                Manage All →
              </Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {users.map((u) => (
              <div
                key={u._id}
                className="p-3 rounded-xl bg-defense-900/60 border border-slate-800/80 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200">{u.name}</span>
                    <Badge
                      variant={
                        u.role === 'admin'
                          ? 'tampered'
                          : u.role === 'auditor'
                          ? 'verified'
                          : u.role === 'verifier'
                          ? 'pending'
                          : 'cyan'
                      }
                      size="xs"
                    >
                      {u.role}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                </div>
                <div className="text-right">
                  <Badge variant={u.totpEnabled ? 'verified' : 'pending'} size="xs">
                    {u.totpEnabled ? '2FA ACTIVE' : 'PENDING'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
