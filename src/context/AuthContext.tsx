import React, { createContext, useContext, useState, useCallback } from 'react';
import { UserProfile, UserRole } from '../types';
import { DEMO_PROFILES } from '../lib/mockData';
import { useToast } from './ToastContext';

interface AuthContextType {
  currentUser: UserProfile | null;
  currentRole: UserRole | null;
  isAuthenticated: boolean;
  loginAsRole: (role: UserRole) => void;
  logout: () => void;
  hasRole: (allowedRoles: UserRole[]) => boolean;
  availableDemoUsers: UserProfile[];
}

const STORAGE_STAFF_USER = 'hangout_staff_session';

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

  const loginAsRole = useCallback(
    (role: UserRole) => {
      const profile = DEMO_PROFILES.find((p) => p.role_id === role) || {
        id: `demo-${role}`,
        email: `${role}@hangoutcafe.com`,
        full_name: `${role.toUpperCase()} User`,
        role_id: role,
        is_active: true,
      };

      setCurrentUser(profile);
      localStorage.setItem(STORAGE_STAFF_USER, JSON.stringify(profile));

      showToast({
        type: 'success',
        title: `Signed in as ${profile.role_id.toUpperCase()}`,
        message: `Welcome, ${profile.full_name}`,
      });
    },
    [showToast]
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_STAFF_USER);
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
        loginAsRole,
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
