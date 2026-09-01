import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Briefcase, FileText, Link2, Sparkles, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { clsx } from 'clsx';

export function Sidebar() {
  const { user } = useAuth();
  const role = user?.role || 'officer';

  const navItems = [
    {
      to: '/dashboard',
      label: 'Mission Overview',
      icon: LayoutDashboard,
      roles: ['officer', 'verifier', 'admin', 'auditor'],
      end: true,
    },
    {
      to: '/dashboard/cases',
      label: 'Case Registry',
      icon: Briefcase,
      roles: ['officer', 'verifier', 'admin', 'auditor'],
    },
    {
      to: '/dashboard/documents',
      label: 'Document Vault',
      icon: FileText,
      badge: 'SHA-256',
      roles: ['officer', 'verifier', 'admin', 'auditor'],
    },
    {
      to: '/dashboard/audit',
      label: 'Audit Hash Chain',
      icon: Link2,
      badge: 'Immutable',
      roles: ['auditor', 'admin', 'officer'],
    },
    {
      to: '/dashboard/search',
      label: 'Semantic AI Search',
      icon: Sparkles,
      badge: 'Gemini',
      roles: ['officer', 'verifier', 'admin', 'auditor'],
    },
    {
      to: '/dashboard/users',
      label: 'Personnel Roster',
      icon: Users,
      badge: 'Admin',
      roles: ['admin'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800/80 bg-defense-950/80 flex flex-col justify-between p-4">
      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold px-3 mb-2">
            Investigation Modules
          </div>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                      isActive
                        ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-defense-900/60'
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Security Diagnostics Widget */}
        <div className="p-3.5 rounded-xl bg-defense-900/80 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              INTEGRITY
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">ACTIVE</span>
          </div>
          <div className="text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between">
              <span>S3 Vault:</span>
              <span className="text-slate-300 font-mono">SSE-S3 (AES-256)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Auth:</span>
              <span className="text-slate-300 font-mono">JWT 15m + 2FA</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Build Signature */}
      <div className="text-[10px] font-mono text-slate-400 text-center border-t border-slate-800/60 pt-3">
        SIH-26190 Prototype v1.0.0
      </div>
    </aside>
  );
}
