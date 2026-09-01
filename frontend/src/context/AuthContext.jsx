import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check existing session profile on boot
  useEffect(() => {
    async function initAuth() {
      try {
        const response = await authService.getProfile();
        if (response?.data?.user) {
          setUser(response.data.user);
        }
      } catch {
        // Fallback for prototype preview demo state if server offline
        const storedDemo = localStorage.getItem('demo_user_session');
        if (storedDemo) {
          try {
            setUser(JSON.parse(storedDemo));
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res?.data?.user) {
      setUser(res.data.user);
      localStorage.setItem('demo_user_session', JSON.stringify(res.data.user));
    }
    return res;
  };

  const loginAsDemo = (role = 'officer') => {
    const demoUser = {
      _id: 'demo-officer-001',
      name: role === 'auditor' ? 'Senior Auditor Rao' : 'Inspector Vikram Singh',
      email: `${role}@investigation.gov.in`,
      role,
      badgeNumber: 'CCB-9842',
      department: 'Central Cyber & Financial Crime Division',
    };
    setUser(demoUser);
    localStorage.setItem('demo_user_session', JSON.stringify(demoUser));
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
    localStorage.removeItem('demo_user_session');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsDemo, logout, isAuthenticated: Boolean(user) }}>
      {children}
    </AuthContext.Provider>
  );
}
