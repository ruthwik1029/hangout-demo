import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Button } from '../../components/common/Button';
import { Shield, ArrowRight, UserCheck, CheckCircle2, ArrowLeft } from 'lucide-react';

export const PortalLogin: React.FC = () => {
  const { currentUser, loginAsRole, logout, availableDemoUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelectRole = (role: UserRole) => {
    loginAsRole(role);
    // If coming from a protected route, go back there
    const state = location.state as { from?: { pathname: string } };
    if (state?.from?.pathname) {
      navigate(state.from.pathname);
    } else {
      if (role === 'admin') navigate('/admin');
      else if (role === 'kitchen') navigate('/kitchen');
      else navigate('/staff');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      {/* Top Header */}
      <div className="text-center space-y-2">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-brand-muted hover:text-brand-black mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to HANGOUT Customer Website</span>
        </button>
        <div className="w-12 h-12 rounded-2xl bg-brand-black text-brand-yellow flex items-center justify-center mx-auto shadow-sm">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="font-heading font-extrabold text-3xl text-brand-black">
          Internal Portals & Roles
        </h1>
        <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
          HANGOUT role-based authorization foundation. Select a persona to test access permissions for Admin, Staff/Waiter, or Kitchen.
        </p>
      </div>

      {/* Current Active Status */}
      {currentUser && (
        <div className="p-4 rounded-2xl bg-brand-soft-yellow/50 border border-brand-yellow/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center font-heading font-black text-sm">
              {currentUser.full_name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-bold text-brand-black">
                Signed in as <span className="uppercase text-brand-charcoal">{currentUser.role_id}</span>
              </p>
              <p className="text-[11px] text-brand-muted">
                {currentUser.full_name} ({currentUser.email})
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs font-bold text-red-600 hover:text-red-700 underline px-2 py-1"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Role Switcher Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {availableDemoUsers.map((user) => {
          const isActive = currentUser?.role_id === user.role_id;
          return (
            <div
              key={user.id}
              className={`p-5 rounded-3xl border transition-all flex flex-col justify-between ${
                isActive
                  ? 'border-brand-black bg-white ring-2 ring-brand-yellow shadow-card-subtle'
                  : 'border-brand-border bg-white hover:border-brand-charcoal/40 shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-heading font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                      user.role_id === 'admin'
                        ? 'bg-purple-100 text-purple-900'
                        : user.role_id === 'kitchen'
                        ? 'bg-amber-100 text-amber-900'
                        : user.role_id === 'manager'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    Role: {user.role_id}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-brand-black">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Active
                    </span>
                  )}
                </div>

                <h3 className="font-heading font-bold text-lg text-brand-black">{user.full_name}</h3>
                <p className="text-xs text-brand-muted mb-4">{user.email}</p>

                <p className="text-xs text-brand-charcoal/80 mb-4 font-sans">
                  {user.role_id === 'admin' && 'Full system control, cafe settings, GST rates & menu management.'}
                  {user.role_id === 'manager' && 'Cafe operational management, reporting & order tracking.'}
                  {user.role_id === 'waiter' && 'Table service, floor status & customer order coordination.'}
                  {user.role_id === 'kitchen' && 'Kitchen Display System (KDS), cooking queue & item preparation.'}
                </p>
              </div>

              <div className="pt-2 border-t border-brand-border flex items-center justify-between">
                <span className="text-[11px] text-brand-muted">
                  Path:{' '}
                  <code className="text-brand-black font-semibold">
                    {user.role_id === 'admin'
                      ? '/admin'
                      : user.role_id === 'kitchen'
                      ? '/kitchen'
                      : '/staff'}
                  </code>
                </span>
                <Button
                  variant={isActive ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => handleSelectRole(user.role_id)}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  {isActive ? 'Enter Portal' : 'Switch & Enter'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info note */}
      <div className="p-4 rounded-2xl bg-brand-charcoal text-white text-xs flex items-center gap-3">
        <UserCheck className="w-5 h-5 text-brand-yellow shrink-0" />
        <p className="text-[11px] text-gray-300 font-sans">
          This portal authentication foundation connects with the database roles and user profiles schema in Supabase. In future batches, Supabase Auth email/password login is directly wired into this architecture.
        </p>
      </div>
    </div>
  );
};
