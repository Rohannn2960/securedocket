import React from 'react';
import { Outlet } from 'react-router-dom';
import { Shield, Lock, FileCheck, Search, KeyRound } from 'lucide-react';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-defense-950 flex flex-col md:flex-row">
      {/* Left Column: Security & System Credentials Banner */}
      <div className="md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/80 bg-gradient-to-br from-defense-900 via-defense-950 to-defense-900">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-900/30">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">DIGITAL CASE VAULT</h1>
              <p className="text-xs font-mono text-cyan-400">SIH PROBLEM STATEMENT ID: 26190</p>
            </div>
          </div>

          <div className="space-y-6 max-w-lg">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-100 leading-tight">
              High-Integrity Document Management for Law Enforcement & Courts
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Tamper-evident legal case file registry with server-side AI OCR extraction, SHA-256 cryptographic chain audits, SSE-S3 encrypted file storage, and role-based clearance.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-3.5 rounded-xl bg-defense-900/80 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                  <Lock className="w-4 h-4" />
                  <span>S3 SSE-S3 Storage</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Zero raw files in MongoDB. Metadata and SHA-256 hashes only.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-defense-900/80 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                  <FileCheck className="w-4 h-4" />
                  <span>Chained Audit Trail</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Hash-linked event logging with instant tamper detection.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-defense-900/80 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                  <Search className="w-4 h-4" />
                  <span>Gemini Vision OCR</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Server-side entity extraction from FIRs and witness statements.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-defense-900/80 border border-slate-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
                  <KeyRound className="w-4 h-4" />
                  <span>Strict RBAC + 2FA</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal">
                  15m JWT rotation, httpOnly cookies, mandatory TOTP.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 text-xs font-mono text-slate-400 border-t border-slate-800/60 mt-8">
          GOVERNMENT & LAW ENFORCEMENT PROTOTYPE ENVIRONMENT
        </div>
      </div>

      {/* Right Column: Dynamic Auth Form Outlet */}
      <div className="md:w-1/2 flex items-center justify-center p-8 md:p-12 lg:p-16 bg-defense-950">
        <div className="w-full max-w-md">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
