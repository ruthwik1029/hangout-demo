import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Button } from '../components/common/Button';
import { ShieldAlert, ArrowLeft, LogIn } from 'lucide-react';

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles, children }) => {
  const { currentUser, isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/auth/portal-login" state={{ from: location }} replace />;
  }

  if (!hasRole(allowedRoles)) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-brand-border shadow-card-subtle text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="font-heading font-bold text-xl text-brand-black">
          Role Permission Required
        </h2>
        <p className="text-xs text-brand-muted mt-2 mb-4 leading-relaxed">
          You are currently signed in as <strong className="text-brand-black font-semibold uppercase">{currentUser.role_id}</strong> ({currentUser.full_name}). This route requires one of the following roles:{' '}
          <span className="font-mono text-brand-charcoal">{allowedRoles.join(', ')}</span>.
        </p>
        <div className="flex flex-col gap-2.5">
          <Link to="/auth/portal-login">
            <Button variant="primary" size="md" className="w-full" leftIcon={<LogIn className="w-4 h-4" />}>
              Switch Staff Role
            </Button>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="md" className="w-full" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Customer Website
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
