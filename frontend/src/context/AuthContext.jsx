import React, { createContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize session by querying /auth/profile (which reads the httpOnly cookie)
  useEffect(() => {
    async function initAuth() {
      try {
        const response = await authService.getProfile();
        if (response?.data?.user) {
          setUser(response.data.user);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async (email, password) => {
    return authService.login(email, password);
  };

  const complete2FA = async (totpCode, tempToken, userId) => {
    const res = await authService.verify2FA(totpCode, tempToken, userId);
    if (res?.data?.user) {
      setUser(res.data.user);
    }
    return res;
  };

  const complete2FASetup = async (totpCode, secret, tempToken) => {
    const res = await authService.verifySetup2FA(totpCode, secret, tempToken);
    if (res?.data?.user) {
      setUser(res.data.user);
    }
    return res;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch {
      // Ignore network errors on logout
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        complete2FA,
        complete2FASetup,
        logout,
        isAuthenticated: Boolean(user),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
