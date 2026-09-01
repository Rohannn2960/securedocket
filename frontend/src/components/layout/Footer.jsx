import React from 'react';
import { Shield, Lock } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-800/80 bg-defense-950 py-4 px-6 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-cyan-500" />
        <span>SIH 26190 Prototype — Secure Digital Document Management Architecture</span>
      </div>
      <div className="flex items-center gap-4 text-[11px] font-mono">
        <span className="flex items-center gap-1 text-slate-400">
          <Lock className="w-3 h-3 text-emerald-400" />
          Zero Raw File Persistence in MongoDB
        </span>
        <span className="text-slate-700">•</span>
        <span>Cryptographic Hash-Chained Audits</span>
      </div>
    </footer>
  );
}
