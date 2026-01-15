/**
 * Authentication Context
 * 
 * Provides current user and organization information throughout the app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { wireApi } from '../api/client';
import { isWireApiError, WireApiError } from '../api/errors';
import type { OrgUser, Org } from '../types/wire';

interface AuthContextType {
  user: OrgUser | null;
  organization: Org | null;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  refreshOrganization: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<OrgUser | null>(null);
  const [organization, setOrganization] = useState<Org | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      // If no token, treat as signed out
      const token = localStorage.getItem('wire_auth_token');
      if (!token) {
        setUser(null);
        return;
      }

      const me = await wireApi.getMe();
      setUser(me.user);
      // Keep org in sync here too (single source of truth)
      setOrganization(me.organization as Org);
      setError(null); // Clear any previous errors on success
    } catch (err) {
      // 401/AUTH_REQUIRED is expected when not logged in - don't treat as error
      if (isWireApiError(err) && (err.status === 401 || err.code === 'AUTH_REQUIRED')) {
        setUser(null);
        setError(null);
        // Clear invalid token
        localStorage.removeItem('wire_auth_token');
        return;
      }
      // Only set error for unexpected errors
      console.error('Failed to load user:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user');
    }
  }, []);

  const refreshOrganization = useCallback(async () => {
    try {
      const token = localStorage.getItem('wire_auth_token');
      if (!token) {
        setOrganization(null);
        return;
      }
      const org = await wireApi.getCurrentOrganization();
      setOrganization(org as Org);
    } catch (err) {
      // 401/AUTH_REQUIRED is expected when not logged in - don't log as error
      if (isWireApiError(err) && (err.status === 401 || err.code === 'AUTH_REQUIRED')) {
        setOrganization(null);
        return;
      }
      console.error('Failed to load organization:', err);
      // Don't set error for org, it's not critical
    }
  }, []);

  const logout = async () => {
    try {
      await wireApi.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear local state
      setUser(null);
      setOrganization(null);
      localStorage.removeItem('wire_auth_token');
      // Redirect to home/login
      window.location.href = '/v2/login';
    }
  };

  useEffect(() => {
    const loadAuth = async () => {
      setIsLoading(true);
      setError(null);
      
      // Load auth data - errors are handled within refreshUser/refreshOrganization
      await Promise.all([
        refreshUser(),
        refreshOrganization(),
      ]);
      
      setIsLoading(false);
    };

    loadAuth();
  }, [refreshUser, refreshOrganization]);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        isLoading,
        error,
        refreshUser,
        refreshOrganization,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
