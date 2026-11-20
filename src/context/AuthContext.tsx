import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { UserProfile, UserRole } from '../types';
import { DEMO_PROFILES } from '../lib/mockData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useToast } from './ToastContext';

interface AuthContextType {
  currentUser: UserProfile | null;
  currentRole: UserRole | null;
  isAuthenticated: boolean;
  isDemoSession: boolean;
  loginAsRole: (role: UserRole) => void;
  signInWithSupabaseAuth: (email: string, password: string, provisioningCode?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasRole: (allowedRoles: UserRole[]) => boolean;
  availableDemoUsers: UserProfile[];
}

const STORAGE_STAFF_USER = 'hangout_staff_session';
const STORAGE_DEMO_FLAG = 'hangout_is_demo_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STAFF_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDemoSession, setIsDemoSession] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_DEMO_FLAG) === 'true';
    } catch {
      return true;
    }
  });

  // Check existing Supabase Auth session on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const { data: profileRes, error } = await supabase.rpc('bind_staff_auth_user');
          if (!error && profileRes && profileRes.success) {
            const staffProfile: UserProfile = {
              id: profileRes.profile_id || data.session.user.id,
              email: profileRes.email || data.session.user.email || '',
              full_name: profileRes.full_name || 'Staff User',
              role_id: profileRes.role_id,
              is_active: true,
            };
            setCurrentUser(staffProfile);
            setIsDemoSession(false);
            localStorage.setItem(STORAGE_STAFF_USER, JSON.stringify(staffProfile));
            localStorage.setItem(STORAGE_DEMO_FLAG, 'false');
          }
        }
      } catch {
        // ignore
      }
    };

    checkSession();
  }, []);

  const loginAsRole = useCallback(
    (role: UserRole) => {
      const profile = DEMO_PROFILES.find((p) => p.role_id === role) || {
        id: `demo-${role}`,
        email: `${role}@hangout.in`,
        full_name: `${role.toUpperCase()} User`,
        role_id: role,
        is_active: true,
      };

      setCurrentUser(profile);
      setIsDemoSession(true);
      localStorage.setItem(STORAGE_STAFF_USER, JSON.stringify(profile));
      localStorage.setItem(STORAGE_DEMO_FLAG, 'true');

      showToast({
        type: 'info',
        title: `Demo Persona: ${profile.role_id.toUpperCase()}`,
        message: `Active in local demo showcase mode (${profile.full_name}).`,
      });
    },
    [showToast]
  );

  const signInWithSupabaseAuth = useCallback(
    async (email: string, password: string, provisioningCode?: string): Promise<{ success: boolean; error?: string }> => {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          error: 'Remote Supabase instance is not configured in this environment.',
        };
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error || !data.user) {
          return { success: false, error: error?.message || 'Authentication failed' };
        }

        const { data: profileRes, error: profileErr } = await supabase.rpc('bind_staff_auth_user', {
          p_provisioning_code: provisioningCode?.trim() || null,
        });
        if (profileErr || !profileRes || !profileRes.success) {
          await supabase.auth.signOut();
          return {
            success: false,
            error: profileRes?.message || profileErr?.message || 'Authenticated user does not have an active internal staff role assignment.',
          };
        }

        const staffProfile: UserProfile = {
          id: profileRes.profile_id || data.user.id,
          email: profileRes.email || data.user.email || email,
          full_name: profileRes.full_name || 'Staff User',
          role_id: profileRes.role_id,
          is_active: true,
        };

        setCurrentUser(staffProfile);
        setIsDemoSession(false);
        localStorage.setItem(STORAGE_STAFF_USER, JSON.stringify(staffProfile));
        localStorage.setItem(STORAGE_DEMO_FLAG, 'false');

        showToast({
          type: 'success',
          title: `Verified Staff Signed In (${staffProfile.role_id.toUpperCase()})`,
          message: `Welcome, ${staffProfile.full_name}. Authoritative backend access active.`,
        });

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Login failed';
        return { success: false, error: message };
      }
    },
    [showToast]
  );

  const logout = useCallback(() => {
    if (isSupabaseConfigured()) {
      void supabase.auth.signOut();
    }
    setCurrentUser(null);
    setIsDemoSession(false);
    localStorage.removeItem(STORAGE_STAFF_USER);
    localStorage.removeItem(STORAGE_DEMO_FLAG);
    showToast({
      type: 'info',
      title: 'Portal Signed Out',
      message: 'Staff session terminated.',
    });
  }, [showToast]);

  const hasRole = useCallback(
    (allowedRoles: UserRole[]): boolean => {
      if (!currentUser) return false;
      if (currentUser.role_id === 'admin') return true; // Super admin has access across portals
      return allowedRoles.includes(currentUser.role_id);
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole: currentUser?.role_id || null,
        isAuthenticated: Boolean(currentUser),
        isDemoSession,
        loginAsRole,
        signInWithSupabaseAuth,
        logout,
        hasRole,
        availableDemoUsers: DEMO_PROFILES,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

