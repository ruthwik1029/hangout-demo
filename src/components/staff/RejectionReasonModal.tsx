import React, { useState } from 'react';
import { Order } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { AlertCircle, XCircle } from 'lucide-react';

interface RejectionReasonModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReject: (orderId: string, reason: string) => void;
  isProcessing?: boolean;
}

const COMMON_REASONS = [
  'Item 86 / Ingredients temporarily unavailable',
  'Kitchen at peak capacity / High preparation delay',
  'Guest no longer seated at designated table',
  'Duplicate order submitted by customer',
  'Special preparation request cannot be fulfilled safely',
];

export const RejectionReasonModal: React.FC<RejectionReasonModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmReject,
  isProcessing = false,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [error, setError] = useState<string>('');

  if (!order) return null;

  const handleConfirm = () => {
    const finalReason = customReason.trim() || selectedPreset;
    if (!finalReason.trim()) {
      setError('A mandatory rejection reason must be documented for the customer & audit log.');
      return;
    }
    setError('');
    onConfirmReject(order.id, finalReason.trim());
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Reject Dining Order #${order.order_number}`}
      size="md"
    >
      <div className="space-y-4">
        <div className="p-3 bg-red-50 rounded-2xl border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Order Rejection Safeguard</p>
            <p className="text-[11px] text-red-800 mt-0.5 leading-relaxed">
              Rejecting this order will mark it as <strong>REJECTED</strong> and prevent items from reaching the kitchen. A mandatory operational reason is required for staff audits.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-heading font-bold text-brand-black mb-2">
            Select Common Operational Reason:
          </label>
          <div className="space-y-1.5">
            {COMMON_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  selectedPreset === reason
                    ? 'border-brand-black bg-brand-soft-yellow/40 font-bold text-brand-black'
                    : 'border-brand-border bg-white text-brand-charcoal hover:bg-brand-warm-white'
                }`}
              >
                <input
                  type="radio"
                  name="rejection_preset"
                  checked={selectedPreset === reason}
                  onChange={() => {
                    setSelectedPreset(reason);
                    setCustomReason('');
                    setError('');
                  }}
                  className="accent-brand-black"
                />
                <span>{reason}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-heading font-bold text-brand-black mb-1">
            Or Enter Specific Reason:
          </label>
          <textarea
            rows={2}
            value={customReason}
            onChange={(e) => {
              setCustomReason(e.target.value);
              setSelectedPreset('');
              setError('');
            }}
            placeholder="Explain specifically why this order cannot be accepted..."
            className="w-full text-xs p-3 rounded-xl border border-brand-border focus:border-brand-black outline-none transition-colors"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-border/60">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            Confirm Rejection
          </Button>
        </div>
      </div>
    </Modal>
  );
};
