import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { OfficerDashboard } from './roles/OfficerDashboard';
import { VerifierDashboard } from './roles/VerifierDashboard';
import { AdminDashboard } from './roles/AdminDashboard';
import { AuditorDashboard } from './roles/AuditorDashboard';

export function Overview() {
  const { user } = useAuth();
  const role = user?.role || 'officer';

  switch (role) {
    case 'verifier':
      return <VerifierDashboard user={user} />;
    case 'admin':
      return <AdminDashboard user={user} />;
    case 'auditor':
      return <AuditorDashboard user={user} />;
    case 'officer':
    default:
      return <OfficerDashboard user={user} />;
  }
}
