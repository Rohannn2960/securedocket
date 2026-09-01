import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/common/Button';

export function Unauthorized() {
  return (
    <div className="min-h-screen bg-defense-950 flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full glass-panel border border-rose-500/40 p-8 rounded-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-rose-950/60 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
          <Lock className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-mono text-rose-400 font-bold tracking-widest uppercase">403 ACCESS DENIED</div>
          <h2 className="text-2xl font-bold text-slate-100">Insufficient Clearance</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Your current user role does not possess the requisite security clearance level to access this judicial dossier or audit module.
        </p>
        <Link to="/dashboard" className="block">
          <Button variant="secondary" icon={ArrowLeft} className="w-full">
            Back to Authorized Portal
          </Button>
        </Link>
      </div>
    </div>
  );
}
