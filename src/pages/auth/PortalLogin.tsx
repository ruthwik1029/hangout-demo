import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Button } from '../../components/common/Button';
import { Shield, ArrowRight, UserCheck, CheckCircle2, ArrowLeft } from 'lucide-react';

export const PortalLogin: React.FC = () => {
  const { currentUser, isDemoSession, loginAsRole, signInWithSupabaseAuth, logout, availableDemoUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [authEmail, setAuthEmail] = React.useState('');
  const [authPassword, setAuthPassword] = React.useState('');
  const [provisioningCode, setProvisioningCode] = React.useState('');
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState('');
  const [showRealLogin, setShowRealLogin] = React.useState(false);

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail.trim() || !authPassword) return;
    setAuthLoading(true);
    setAuthError('');

    const res = await signInWithSupabaseAuth(authEmail.trim(), authPassword, provisioningCode.trim());
    setAuthLoading(false);
    if (!res.success) {
      setAuthError(res.error || 'Login failed. Please check your credentials.');
    } else {
      navigate('/admin');
    }
  };

  const handleSelectRole = (role: UserRole) => {
    loginAsRole(role);
    // If coming from a protected route, go back there
    const state = location.state as { from?: { pathname: string; search?: string } };
    if (state?.from?.pathname) {
      navigate(`${state.from.pathname}${state.from.search || ''}`);
    } else {
      if (role === 'admin' || role === 'manager') {
        navigate('/admin');
      } else if (role === 'cashier') {
        navigate('/staff?tab=takeaway');
      } else {
        navigate('/staff?tab=tables');
      }
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
          HANGOUT role-based authorization foundation. Select a persona to test access permissions for Admin, Manager, Cashier, or Staff.
        </p>
      </div>

      {/* Current Active Status */}
      {currentUser && (
        <div className="p-4 rounded-2xl bg-brand-soft-yellow/50 border border-brand-yellow/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center font-heading font-black text-sm">
              {currentUser.full_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-brand-black">
                  Signed in as <span className="uppercase text-brand-charcoal">{currentUser.role_id}</span>
                </p>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isDemoSession
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {isDemoSession ? 'Demo Persona (Local Mode)' : 'Verified Supabase Auth'}
                </span>
              </div>
              <p className="text-[11px] text-brand-muted">
                {currentUser.full_name} ({currentUser.email})
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-xs font-bold text-red-600 hover:text-red-700 underline px-2 py-1 self-start sm:self-center"
          >
            Sign Out
          </button>
        </div>
      )}

      {/* Production Supabase Auth Access Toggle */}
      <div className="p-5 rounded-3xl bg-white border border-brand-border shadow-card-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-bold text-sm text-brand-black">
              Production Staff Authentication
            </h3>
            <p className="text-[11px] text-brand-muted">
              Sign in with your verified Supabase Auth credentials to access authoritative remote database orders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRealLogin(!showRealLogin)}
            className="text-xs font-bold text-brand-black underline px-2 py-1"
          >
            {showRealLogin ? 'Hide Form' : 'Staff Sign In'}
          </button>
        </div>

        {showRealLogin && (
          <form onSubmit={handleSupabaseLogin} className="pt-3 border-t border-brand-border space-y-3">
            {authError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {authError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-brand-muted mb-1 uppercase">Staff Email</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="admin@hangout.in"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border focus:border-brand-black focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-brand-muted mb-1 uppercase">Password</label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border focus:border-brand-black focus:outline-none"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-brand-muted mb-1 uppercase">
                Staff Invitation Code <span className="text-[10px] text-brand-charcoal/50 font-normal lowercase">(required only when claiming a staff invitation)</span>
              </label>
              <input
                type="text"
                value={provisioningCode}
                onChange={(e) => setProvisioningCode(e.target.value)}
                placeholder="Enter staff invitation code"
                className="w-full px-3 py-2 text-xs rounded-xl border border-brand-border focus:border-brand-black focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="sm" disabled={authLoading}>
                {authLoading ? 'Verifying...' : 'Sign In via Supabase Auth'}
              </Button>
            </div>
          </form>
        )}
      </div>

      <div className="border-t border-brand-border pt-4">
        <h2 className="font-heading font-extrabold text-base text-brand-black mb-1">
          Demo Persona Showcase (Local Offline Mode)
        </h2>
        <p className="text-xs text-brand-muted mb-4">
          Select a role below to simulate the customer or staff dashboard UI in your local browser sandbox.
        </p>
      </div>

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
                        : user.role_id === 'manager'
                        ? 'bg-blue-100 text-blue-900'
                        : user.role_id === 'cashier'
                        ? 'bg-teal-100 text-teal-900'
                        : 'bg-emerald-100 text-emerald-900'
                    }`}
                  >
                    Role: {user.role_id === 'waiter' ? 'staff' : user.role_id}
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
                  {user.role_id === 'admin' && 'Full system control, restaurant settings, GST rates & menu management.'}
                  {user.role_id === 'manager' && 'Restaurant operations, reporting & order oversight.'}
                  {user.role_id === 'cashier' && 'Counter billing, payment collection & cash settlements.'}
                  {user.role_id === 'waiter' && 'Table service, floor status, customer order coordination & KDS kitchen operations.'}
                </p>
              </div>

              <div className="pt-2 border-t border-brand-border flex items-center justify-between">
                <span className="text-[11px] text-brand-muted">
                  Path:{' '}
                  <code className="text-brand-black font-semibold">
                    {user.role_id === 'admin' || user.role_id === 'manager'
                      ? '/admin'
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

