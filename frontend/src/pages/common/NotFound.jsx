import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/common/Button';

export function NotFound() {
  return (
    <div className="min-h-screen bg-defense-950 flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full glass-panel border border-slate-800 p-8 rounded-2xl text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-cyan-400">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <div className="text-xs font-mono text-cyan-400 font-bold tracking-widest uppercase">404 NOT FOUND</div>
          <h2 className="text-2xl font-bold text-slate-100">Resource Unavailable</h2>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          The requested investigation dossier or endpoint does not exist in the digital vault index.
        </p>
        <Link to="/dashboard" className="block">
          <Button variant="primary" icon={ArrowLeft} className="w-full">
            Return to Case Vault
          </Button>
        </Link>
      </div>
    </div>
  );
}
