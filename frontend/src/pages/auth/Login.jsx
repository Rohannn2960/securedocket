import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Alert } from '../../components/common/Alert';

export function Login() {
  const navigate = useNavigate();
  const { login, loginAsDemo } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both official email and security credentials.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await login(email, password);
      if (res?.data?.require2FA) {
        navigate('/verify-2fa', { state: { userId: res.data.tempSessionUserId } });
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err?.message || 'Authentication rejected by security gateway.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (role) => {
    loginAsDemo(role);
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-semibold mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>OFFICER AUTHENTICATION GATEWAY</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-100">Sign in to Case Vault</h2>
        <p className="text-xs text-slate-400 mt-1">
          Provide your official credentials or select a role preset below.
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Official Email Address"
          type="email"
          icon={Mail}
          placeholder="officer.badge@police.gov.in"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Passphrase / Security Key"
          type="password"
          icon={Lock}
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" variant="primary" icon={ArrowRight} isLoading={loading} className="w-full">
          Authenticate & Verify Credentials
        </Button>
      </form>

      {/* Quick Demo Access Buttons for SIH Jury & Testing */}
      <div className="pt-6 border-t border-slate-800/80 space-y-3">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold flex items-center justify-between">
          <span>Prototype Role Presets</span>
          <span className="text-[10px] text-cyan-400 font-mono">1-Click Launch</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={UserCheck}
            onClick={() => handleQuickDemo('officer')}
            className="text-xs"
          >
            Lead Officer
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={UserCheck}
            onClick={() => handleQuickDemo('verifier')}
            className="text-xs"
          >
            OCR Verifier
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={UserCheck}
            onClick={() => handleQuickDemo('auditor')}
            className="text-xs"
          >
            Audit Officer
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={UserCheck}
            onClick={() => handleQuickDemo('admin')}
            className="text-xs"
          >
            System Admin
          </Button>
        </div>
      </div>
    </div>
  );
}
