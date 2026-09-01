import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from '../pages/Landing';
import { AuthLayout } from '../components/layout/AuthLayout';
import { Login } from '../pages/auth/Login';
import { TwoFactorVerify } from '../pages/auth/TwoFactorVerify';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Overview } from '../pages/dashboard/Overview';
import { Cases } from '../pages/dashboard/Cases';
import { CaseDetail } from '../pages/dashboard/CaseDetail';
import { Documents } from '../pages/dashboard/Documents';
import { VerificationQueue } from '../pages/dashboard/VerificationQueue';
import { AuditLogs } from '../pages/dashboard/AuditLogs';
import { Search } from '../pages/dashboard/Search';
import { Users } from '../pages/dashboard/Users';
import { NotFound } from '../pages/common/NotFound';
import { Unauthorized } from '../pages/common/Unauthorized';
import { ProtectedRoute } from './ProtectedRoute';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Landing & Auth Routes */}
      <Route path="/" element={<Landing />} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-2fa" element={<TwoFactorVerify />} />
      </Route>

      {/* Protected Dashboard Routes with Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Overview />} />
          <Route path="/dashboard/cases" element={<Cases />} />
          <Route path="/dashboard/cases/:id" element={<CaseDetail />} />
          <Route path="/dashboard/documents" element={<Documents />} />
          
          {/* Forensic Verification Queue Restricted to Verifiers, Admins, Auditors */}
          <Route
            element={<ProtectedRoute allowedRoles={['verifier', 'admin', 'auditor']} />}
          >
            <Route path="/dashboard/verification" element={<VerificationQueue />} />
          </Route>

          <Route path="/dashboard/search" element={<Search />} />

          {/* Audit Chain Restricted to Auditors, Admins, and Officers */}
          <Route
            element={<ProtectedRoute allowedRoles={['auditor', 'admin', 'officer']} />}
          >
            <Route path="/dashboard/audit" element={<AuditLogs />} />
          </Route>

          {/* User Management Restricted Strictly to System Admins */}
          <Route
            element={<ProtectedRoute allowedRoles={['admin']} />}
          >
            <Route path="/dashboard/users" element={<Users />} />
          </Route>
        </Route>
      </Route>

      {/* System Feedback Pages */}
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/404" element={<NotFound />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
