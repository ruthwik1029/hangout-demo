import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useCustomer } from '../../context/CustomerContext';
import { Button } from '../common/Button';
import { User, Mail, ShieldCheck, Sparkles } from 'lucide-react';

export const CustomerRegisterModal: React.FC = () => {
  const { isRegisterModalOpen, closeRegisterModal, registerCustomer, validateMobile } = useCustomer();

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileError, setMobileError] = useState<string | null>(null);

  const handleMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMobileNumber(val);
    if (val.length > 0) {
      const res = validateMobile(val);
      setMobileError(res.isValid ? null : res.error || null);
    } else {
      setMobileError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = validateMobile(mobileNumber);
    if (!val.isValid) {
      setMobileError(val.error || 'Invalid mobile number');
      return;
    }

    setIsSubmitting(true);
    const success = await registerCustomer(fullName, mobileNumber, email);
    setIsSubmitting(false);

    if (success) {
      setFullName('');
      setMobileNumber('');
      setEmail('');
    }
  };

  return (
    <Modal
      isOpen={isRegisterModalOpen}
      onClose={closeRegisterModal}
      title="Welcome to HANGOUT"
      subtitle="Quick customer check-in for dining and self-pickup orders."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-muted">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-black transition-all"
            />
          </div>
        </div>

        {/* Mobile Number */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-muted">
              <span className="text-xs font-bold text-brand-black pr-1 border-r border-brand-border">
                +91
              </span>
            </div>
            <input
              type="tel"
              required
              maxLength={10}
              value={mobileNumber}
              onChange={handleMobileChange}
              placeholder="9876543210"
              className={`w-full pl-14 pr-4 py-2.5 bg-white border rounded-xl text-sm font-sans focus:outline-none focus:ring-2 transition-all ${
                mobileError
                  ? 'border-red-400 focus:ring-red-300'
                  : 'border-brand-border focus:ring-brand-yellow focus:border-brand-black'
              }`}
            />
          </div>
          {mobileError ? (
            <p className="text-[11px] text-red-500 mt-1">{mobileError}</p>
          ) : (
            <p className="text-[11px] text-brand-muted mt-1">
              Enter 10-digit mobile number for order status updates.
            </p>
          )}
        </div>

        {/* Optional Email */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
            Email Address <span className="text-xs text-brand-muted font-normal">(Optional for digital bills)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-muted">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="aarav@example.com"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-border rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-black transition-all"
            />
          </div>
        </div>

        {/* Demo Note */}
        <div className="p-3 bg-brand-soft-yellow/40 rounded-xl border border-brand-yellow/30 flex items-start gap-2.5 text-xs text-brand-charcoal">
          <ShieldCheck className="w-4 h-4 text-brand-black shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-brand-black">Frictionless Fast Demo</p>
            <p className="text-[11px] text-brand-muted">
              No OTP or password required for this demo. A safe cryptographic session token is issued to link your orders securely.
            </p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="md" onClick={closeRegisterModal}>
            Skip for now
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Continue Ordering
          </Button>
        </div>
      </form>
    </Modal>
  );
};
