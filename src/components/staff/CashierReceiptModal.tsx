import React, { useState, useEffect } from 'react';
import { Order, CafeSettings } from '../../types';
import { Modal } from '../common/Modal';
import { DigitalReceipt } from '../receipt/DigitalReceipt';
import { ThermalPrinterAnimation } from '../receipt/ThermalPrinterAnimation';
import { Button } from '../common/Button';
import { Printer, Sparkles } from 'lucide-react';

interface CashierReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  cafeSettings?: CafeSettings | null;
}

export const CashierReceiptModal: React.FC<CashierReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
  cafeSettings,
}) => {
  const [layoutMode, setLayoutMode] = useState<'thermal' | 'a4'>('thermal');
  const [reprintCount, setReprintCount] = useState<number>(0);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (!order) return;
    const stored = localStorage.getItem(`hangout_print_count_${order.id}`);
    setReprintCount(stored ? parseInt(stored, 10) : 0);
  }, [order]);

  if (!order) return null;

  const handlePrint = () => {
    const nextCount = reprintCount + 1;
    setReprintCount(nextCount);
    localStorage.setItem(`hangout_print_count_${order.id}`, String(nextCount));
    window.print();
  };

  const isReprint = reprintCount > 0;

  return (
    <>
      <Modal
        isOpen={isOpen && !showAnimation}
        onClose={onClose}
        title={`Cashier Bill Receipt — Order #${order.order_number}`}
        subtitle={`Fulfillment: ${order.order_type === 'DINING' ? `Dine-In (Table ${order.table_number_snapshot || 'N/A'})` : 'Takeaway'}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Cashier Control Toolbar */}
          <div className="p-3 bg-brand-warm-white rounded-2xl border border-brand-border flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-brand-muted">Layout:</span>
              <div className="inline-flex rounded-xl bg-white p-1 border border-brand-border text-xs">
                <button
                  type="button"
                  onClick={() => setLayoutMode('thermal')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    layoutMode === 'thermal'
                      ? 'bg-brand-black text-white'
                      : 'text-brand-muted hover:text-brand-black'
                  }`}
                >
                  80mm Thermal
                </button>
                <button
                  type="button"
                  onClick={() => setLayoutMode('a4')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${
                    layoutMode === 'a4'
                      ? 'bg-brand-black text-white'
                      : 'text-brand-muted hover:text-brand-black'
                  }`}
                >
                  A4 Invoice
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isReprint ? (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300">
                  Reprint Copy #{reprintCount}
                </span>
              ) : (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Original Bill (Copy 0)
                </span>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAnimation(true)}
                leftIcon={<Sparkles className="w-3.5 h-3.5 text-brand-yellow" />}
              >
                Printer Feed Animation
              </Button>
            </div>
          </div>

          {/* Receipt Preview Body */}
          <div className="max-h-[60vh] overflow-y-auto p-4 bg-gray-100 rounded-2xl flex justify-center">
            <DigitalReceipt
              order={order}
              cafeSettings={cafeSettings}
              layoutMode={layoutMode}
              isReprint={isReprint}
              reprintCount={reprintCount}
              showActions={false}
            />
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-brand-border">
            <span className="text-xs text-brand-muted">
              Select "Save as PDF" in system dialog to export PDF.
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="md" onClick={onClose}>
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handlePrint}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                {isReprint ? `Print Duplicate (Copy #${reprintCount + 1})` : 'Print Original Bill'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Optional Thermal Animation Overlay */}
      {showAnimation && (
        <ThermalPrinterAnimation
          order={order}
          cafeSettings={cafeSettings}
          isOpen={showAnimation}
          onClose={() => setShowAnimation(false)}
        />
      )}
    </>
  );
};
