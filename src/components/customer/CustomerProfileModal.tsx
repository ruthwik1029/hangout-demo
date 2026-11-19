import React from 'react';
import { Modal } from '../common/Modal';
import { useCustomer } from '../../context/CustomerContext';
import { useOrderMode } from '../../context/OrderModeContext';
import { Button } from '../common/Button';
import { User, Phone, Mail, Key, LogOut, Utensils, ShoppingBag } from 'lucide-react';

interface CustomerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentCustomer, currentSession, logoutCustomer, openRegisterModal } = useCustomer();
  const { mode, currentTable } = useOrderMode();

  if (!currentCustomer) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Customer Profile"
        subtitle="Sign in or register to track your orders."
      >
        <div className="text-center py-6">
          <div className="w-16 h-16 rounded-3xl bg-brand-soft-yellow/80 mx-auto flex items-center justify-center text-brand-black mb-3">
            <User className="w-8 h-8" />
          </div>
          <h4 className="font-heading font-bold text-lg text-brand-black">No Active Session</h4>
          <p className="text-xs text-brand-muted max-w-xs mx-auto mt-1 mb-5">
            Register with your name and mobile number to preserve your dining orders or self-pickup status.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              onClose();
              openRegisterModal();
            }}
          >
            Check In / Register
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Profile"
      subtitle="Your active guest profile & order session."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Profile Card */}
        <div className="p-4 rounded-2xl bg-white border border-brand-border flex items-center gap-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-brand-yellow flex items-center justify-center font-heading font-black text-xl text-brand-black shadow-sm">
            {currentCustomer.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-heading font-bold text-base text-brand-black truncate">
              {currentCustomer.full_name}
            </h4>
            <div className="flex items-center gap-2 text-xs text-brand-muted mt-0.5">
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" /> +91 {currentCustomer.mobile_number}
              </span>
              {currentCustomer.email && (
                <span className="flex items-center gap-1 truncate">
                  • <Mail className="w-3 h-3" /> {currentCustomer.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Current Ordering State */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="p-3 rounded-xl bg-brand-warm-white border border-brand-border">
            <span className="text-[10px] uppercase font-bold text-brand-muted block">
              Active Mode
            </span>
            <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-brand-black">
              {mode === 'dining' ? (
                <>
                  <Utensils className="w-3.5 h-3.5 text-brand-black" /> Dining In
                </>
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 text-brand-black" /> Self-Pickup
                </>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-brand-warm-white border border-brand-border">
            <span className="text-[10px] uppercase font-bold text-brand-muted block">
              Table / Context
            </span>
            <div className="text-xs font-bold text-brand-black mt-1">
              {mode === 'dining' && currentTable
                ? `Table ${currentTable.table_number}`
                : mode === 'dining'
                ? 'Table Not Selected'
                : 'HANGOUT Pickup'}
            </div>
          </div>
        </div>

        {/* Safe Session Info */}
        <div className="p-3.5 rounded-xl bg-brand-charcoal text-white text-xs space-y-1">
          <div className="flex items-center justify-between text-brand-yellow font-semibold">
            <span className="flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> Safe Session Token
            </span>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded">Active</span>
          </div>
          <p className="font-mono text-[11px] text-gray-300 truncate">
            {currentSession?.session_token ? `${currentSession.session_token.slice(0, 18)}...` : 'None'}
          </p>
          <p className="text-[10px] text-gray-400">
            Validated without treating mobile number alone as proof of identity.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-brand-border">
          <button
            onClick={() => {
              logoutCustomer();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out Session
          </button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
