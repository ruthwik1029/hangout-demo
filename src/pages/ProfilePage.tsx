import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import { useOrderMode } from '../context/OrderModeContext';
import { Button } from '../components/common/Button';
import {
  User,
  Phone,
  Mail,
  ShoppingBag,
  Utensils,
  LogOut,
  ArrowLeft,
  Key,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { currentCustomer, currentSession, isAuthenticated, openRegisterModal, logoutCustomer } =
    useCustomer();
  const { mode, currentTable } = useOrderMode();
  const navigate = useNavigate();

  if (!isAuthenticated || !currentCustomer) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-brand-border shadow-card-subtle text-center">
        <div className="w-16 h-16 rounded-3xl bg-brand-soft-yellow flex items-center justify-center mx-auto mb-4 text-brand-black">
          <User className="w-8 h-8" />
        </div>
        <h1 className="font-heading font-extrabold text-2xl text-brand-black">
          Customer Check-In
        </h1>
        <p className="text-xs text-brand-muted mt-2 mb-6 leading-relaxed font-sans">
          Register or check in with your mobile number to link your dining table orders or track self-pickup items.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={openRegisterModal}>
            Register / Check In
          </Button>
          <Button variant="ghost" size="md" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 pb-24">
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Customer Website</span>
      </button>

      {/* Main Profile Card */}
      <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-yellow flex items-center justify-center font-heading font-black text-2xl text-brand-black shadow-sm">
              {currentCustomer.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-brand-black">
                {currentCustomer.full_name}
              </h1>
              <p className="text-xs text-brand-muted mt-0.5 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> +91 {currentCustomer.mobile_number}
                </span>
                {currentCustomer.email && (
                  <span className="flex items-center gap-1">
                    • <Mail className="w-3.5 h-3.5" /> {currentCustomer.email}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              logoutCustomer();
              navigate('/');
            }}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold p-2 rounded-xl hover:bg-red-50"
            title="End session"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Current Ordering Context */}
        <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center">
              {mode === 'dining' ? (
                <Utensils className="w-5 h-5" />
              ) : (
                <ShoppingBag className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-brand-black">
                Active Order Mode: {mode === 'dining' ? 'Dining In' : 'Self-Pickup'}
              </p>
              <p className="text-[11px] text-brand-muted">
                {mode === 'dining' && currentTable
                  ? `Assigned to Table ${currentTable.table_number} (${currentTable.section})`
                  : mode === 'dining'
                  ? 'Table not selected yet'
                  : 'Counter Collection at HANGOUT'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/menu')}>
            Order Now
          </Button>
        </div>

        {/* Safe Session Security Card */}
        <div className="p-4 rounded-2xl bg-brand-charcoal text-white text-xs space-y-2">
          <div className="flex items-center justify-between text-brand-yellow font-heading font-bold">
            <span className="flex items-center gap-1.5">
              <Key className="w-4 h-4" /> Safe Device Session
            </span>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono">Active</span>
          </div>
          <p className="font-mono text-[11px] text-gray-300">
            Token: {currentSession?.session_token}
          </p>
          <p className="text-[11px] text-gray-400">
            Customer identities are protected by unique session bearer tokens rather than treating mobile numbers alone as proof of identity.
          </p>
        </div>
      </div>
    </div>
  );
};
