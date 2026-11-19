import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { PaymentMethod, PaymentTransaction } from '../../types';
import { Button } from '../common/Button';
import { processSimulatedPayment } from '../../lib/supabase';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Smartphone,
  Wallet,
} from 'lucide-react';

interface PaymentGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  amount: number;
  paymentMethod: PaymentMethod;
  guestAccessToken?: string;
  onPaymentSuccess: (transaction: PaymentTransaction) => void;
  onPaymentFailure: (errorMsg: string) => void;
}

export const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({
  isOpen,
  onClose,
  orderId,
  orderNumber,
  amount,
  paymentMethod,
  guestAccessToken,
  onPaymentSuccess,
  onPaymentFailure,
}) => {
  const [step, setStep] = useState<'input' | 'processing' | 'result'>('input');
  const [shouldSimulateFailure, setShouldSimulateFailure] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Simulated card inputs
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');

  // Simulated UPI input
  const [upiId, setUpiId] = useState('customer@okhdfcbank');

  const handleProcessPayment = async () => {
    setStep('processing');
    setErrorMessage(null);

    // Realistic delay for bank simulation
    setTimeout(async () => {
      const res = await processSimulatedPayment({
        orderId,
        amount,
        paymentMethod,
        guestAccessToken,
        shouldFail: shouldSimulateFailure,
      });

      if (res.success && res.transaction) {
        setStep('result');
        setTimeout(() => {
          onPaymentSuccess(res.transaction);
        }, 800);
      } else {
        setStep('input');
        const err = res.error || 'Payment gateway simulation failed';
        setErrorMessage(err);
        onPaymentFailure(err);
      }
    }, 1800);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={step === 'processing' ? () => {} : onClose}
      title="HANGOUT Simulated Gateway"
      subtitle={`Processing payment for Order ${orderNumber}`}
      maxWidth="md"
      showCloseButton={step !== 'processing'}
    >
      <div className="space-y-5">
        {/* DEMO NOTICE WARNING */}
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="font-bold text-amber-950 uppercase tracking-wide block text-[11px]">
              Simulated Payment Mode — Zero Real Money
            </strong>
            This is a mock transaction sandbox for demonstration purposes. No card or UPI account will be debited.
          </div>
        </div>

        {/* Amount Banner */}
        <div className="p-4 rounded-2xl bg-brand-charcoal text-white flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-brand-muted block">
              Total Payable Amount
            </span>
            <span className="font-heading font-black text-2xl text-brand-yellow">
              ₹{amount.toFixed(2)}
            </span>
          </div>
          <span className="text-xs font-semibold bg-white/10 px-2.5 py-1 rounded-xl text-gray-200">
            Method: {paymentMethod}
          </span>
        </div>

        {/* Processing State */}
        {step === 'processing' && (
          <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-brand-yellow/20 flex items-center justify-center text-brand-black animate-pulse">
              <Loader2 className="w-8 h-8 text-brand-black animate-spin" />
            </div>
            <div>
              <h4 className="font-heading font-bold text-lg text-brand-black">
                Simulating Gateway Authentication...
              </h4>
              <p className="text-xs text-brand-muted mt-1 max-w-xs mx-auto">
                Validating mock token, verifying bank handshake and generating audit reference.
              </p>
            </div>
          </div>
        )}

        {/* Input State */}
        {step === 'input' && (
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {paymentMethod === 'UPI' && (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-white border border-brand-border flex items-center gap-4">
                  <div className="w-20 h-20 bg-brand-warm-white border border-brand-border rounded-xl flex items-center justify-center shrink-0">
                    <QrCode className="w-12 h-12 text-brand-black" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted block">
                      Scan Demo UPI QR
                    </span>
                    <p className="text-xs text-brand-black font-semibold mt-0.5">
                      Open Google Pay, PhonePe, or Paytm simulator
                    </p>
                    <p className="text-[10px] text-brand-muted mt-1">
                      UPI ID: <code className="font-mono text-brand-black">hangout@upi</code>
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                    Or Enter Mock VPA / UPI ID
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'CARD' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                    Demo Card Number
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                      Expiry
                    </label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1">
                      CVV
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs font-mono text-center focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                  </div>
                </div>
              </div>
            )}

            {paymentMethod === 'CASH_AT_COUNTER' && (
              <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border text-center space-y-2">
                <Wallet className="w-8 h-8 mx-auto text-brand-black" />
                <h4 className="font-heading font-bold text-sm text-brand-black">
                  Pay at Cashier Counter
                </h4>
                <p className="text-xs text-brand-muted leading-relaxed">
                  Your order will be verified and forwarded to the kitchen. Please present Order #{orderNumber} at the counter.
                </p>
              </div>
            )}

            {/* Test Failure Toggle for QA Verification */}
            <div className="p-3 bg-brand-warm-white rounded-xl border border-brand-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-brand-black block">QA Failure Simulation</span>
                <span className="text-[10px] text-brand-muted">
                  Toggle to test gateway failure handling
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={shouldSimulateFailure}
                  onChange={(e) => setShouldSimulateFailure(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-brand-border">
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant={shouldSimulateFailure ? 'secondary' : 'primary'}
                size="md"
                onClick={handleProcessPayment}
              >
                {shouldSimulateFailure ? 'Simulate Payment Failure' : `Authorize Demo Payment ₹${amount.toFixed(2)}`}
              </Button>
            </div>
          </div>
        )}

        {/* Result State */}
        {step === 'result' && (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="font-heading font-bold text-lg text-brand-black">
              Demo Payment Authorized!
            </h4>
            <p className="text-xs text-brand-muted">
              Redirecting to your order confirmation receipt...
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};

