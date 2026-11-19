import React, { useState, useEffect, useMemo } from 'react';
import { Order, BillSplit, BillSplitType, PaymentMethod } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchBillSplits,
  createBillSplits,
  settleBillSplit,
  closeCompletedOrder,
  roundMoney,
} from '../../lib/supabase';
import {
  Users,
  UtensilsCrossed,
  CheckCircle2,
  CreditCard,
  QrCode,
  DollarSign,
  Receipt,
  Sparkles,
  Printer,
} from 'lucide-react';
import { CashierReceiptModal } from './CashierReceiptModal';

interface BillSplittingModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (order: Order) => void;
}

export const BillSplittingModal: React.FC<BillSplittingModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [activeMode, setActiveMode] = useState<BillSplitType>('EQUAL');
  const [equalCount, setEqualCount] = useState<number>(order?.guest_count || 2);
  const [customAmounts, setCustomAmounts] = useState<number[]>([0, 0]);
  const [itemAssignments, setItemAssignments] = useState<Record<number, string[]>>({ 1: [], 2: [] });
  const [splits, setSplits] = useState<BillSplit[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  // Load existing splits if already created
  useEffect(() => {
    if (!order) return;
    fetchBillSplits(order.id).then((loaded) => {
      setSplits(loaded);
      if (loaded.length > 0) {
        setActiveMode(loaded[0].split_type);
      }
    });
  }, [order]);

  // Outstanding Balance Calculation
  const paidSplitsTotal = useMemo(() => {
    return roundMoney(
      splits.filter((s) => s.payment_status === 'PAID').reduce((sum, s) => sum + s.amount, 0)
    );
  }, [splits]);

  const outstandingBalance = useMemo(() => {
    if (!order) return 0;
    if (splits.length === 0) {
      return order.payment_status === 'PAID' ? 0 : order.total_amount;
    }
    return roundMoney(Math.max(0, order.total_amount - paidSplitsTotal));
  }, [order, splits, paidSplitsTotal]);

  // Generate / Reset Splits
  const handleGenerateSplits = async (type: BillSplitType) => {
    if (!order) return;
    setIsProcessing(true);
    try {
      let created: BillSplit[] = [];
      if (type === 'EQUAL') {
        created = await createBillSplits(order.id, 'EQUAL', { splitCount: equalCount });
      } else if (type === 'CUSTOM') {
        created = await createBillSplits(order.id, 'CUSTOM', { customAmounts });
      } else if (type === 'ITEMS') {
        created = await createBillSplits(order.id, 'ITEMS', { itemAssignments });
      }
      setSplits(created);
      showToast({
        type: 'success',
        title: 'Bill Split Configured',
        message: `Created ${created.length} split bill shares totaling ₹${order.total_amount.toFixed(2)}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate split bills';
      showToast({
        type: 'error',
        title: 'Split Calculation Error',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Settle individual split
  const handleSettleSplit = async (splitId: string, method: PaymentMethod) => {
    setIsProcessing(true);
    try {
      const { split, order: updatedOrder } = await settleBillSplit(
        splitId,
        method,
        currentUser?.full_name || 'Staff'
      );
      setSplits((prev) => prev.map((s) => (s.id === split.id ? split : s)));
      onOrderUpdated(updatedOrder);

      showToast({
        type: 'success',
        title: 'Share Paid',
        message: `${split.label} paid ₹${split.amount.toFixed(2)} via ${method} (Ref: ${split.transaction_reference})`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Settlement failed';
      showToast({
        type: 'error',
        title: 'Payment Settlement Error',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Close Order after full payment
  const handleCloseOrder = async () => {
    if (!order) return;
    setIsProcessing(true);
    try {
      const completed = await closeCompletedOrder(order.id, currentUser?.full_name || 'Staff');
      showToast({
        type: 'success',
        title: 'Table Order Closed',
        message: `Order #${completed.order_number} marked completed. Table set to cleaning.`,
      });
      onOrderUpdated(completed);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not close order';
      showToast({
        type: 'error',
        title: 'Closure Blocked',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!order) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Table ${order.table_number_snapshot || 'Dining'} • Bill & Bill Splitting`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Bill Overview Banner */}
        <div className="bg-brand-black text-white p-4 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-heading font-bold text-brand-yellow">
              <Receipt className="w-4 h-4" />
              <span>Order #{order.order_number}</span>
            </div>
            <p className="text-xl font-heading font-black mt-1">
              Total Payable: ₹{order.total_amount.toFixed(2)}
            </p>
            <p className="text-xs text-white/70">
              Subtotal: ₹{order.subtotal.toFixed(2)} • GST: ₹{order.tax_amount.toFixed(2)}
            </p>
          </div>

          <div className="sm:text-right bg-white/10 p-3 rounded-2xl border border-white/10">
            <p className="text-[10px] uppercase font-bold tracking-wider text-brand-yellow">
              Outstanding Balance
            </p>
            <p
              className={`font-mono text-2xl font-black ${outstandingBalance === 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}
            >
              ₹{outstandingBalance.toFixed(2)}
            </p>
            <p className="text-[10px] text-white/70 mt-0.5">
              {outstandingBalance === 0 ? '✓ Fully Settled' : '● Unpaid balance remaining'}
            </p>
          </div>
        </div>

        {/* Split Mode Selector */}
        {splits.length === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-heading font-bold text-brand-black uppercase tracking-wider">
                Select Bill Splitting Method:
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setActiveMode('EQUAL')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${activeMode === 'EQUAL'
                    ? 'border-brand-black bg-brand-soft-yellow/50 shadow-sm ring-1 ring-brand-black'
                    : 'border-brand-border bg-white hover:border-brand-charcoal/40'
                  }`}
              >
                <Users className="w-5 h-5 text-brand-black mb-1.5" />
                <p className="font-heading font-bold text-xs text-brand-black">1. Equal Split</p>
                <p className="text-[10px] text-brand-muted mt-0.5">
                  Split evenly between N dining guests
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('ITEMS')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${activeMode === 'ITEMS'
                    ? 'border-brand-black bg-brand-soft-yellow/50 shadow-sm ring-1 ring-brand-black'
                    : 'border-brand-border bg-white hover:border-brand-charcoal/40'
                  }`}
              >
                <UtensilsCrossed className="w-5 h-5 text-brand-black mb-1.5" />
                <p className="font-heading font-bold text-xs text-brand-black">2. Split by Items</p>
                <p className="text-[10px] text-brand-muted mt-0.5">
                  Assign specific dishes to each guest
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveMode('CUSTOM')}
                className={`p-3.5 rounded-2xl border text-left transition-all ${activeMode === 'CUSTOM'
                    ? 'border-brand-black bg-brand-soft-yellow/50 shadow-sm ring-1 ring-brand-black'
                    : 'border-brand-border bg-white hover:border-brand-charcoal/40'
                  }`}
              >
                <DollarSign className="w-5 h-5 text-brand-black mb-1.5" />
                <p className="font-heading font-bold text-xs text-brand-black">3. Custom Split</p>
                <p className="text-[10px] text-brand-muted mt-0.5">
                  Enter custom amounts adding to total
                </p>
              </button>
            </div>

            {/* Mode-Specific Configuration Controls */}
            {activeMode === 'EQUAL' && (
              <div className="p-4 bg-brand-warm-white rounded-2xl border border-brand-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-black">Number of Guests to Split:</span>
                  <div className="flex items-center gap-2">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setEqualCount(num)}
                        className={`w-8 h-8 rounded-xl font-heading font-black text-xs transition-colors ${equalCount === num
                            ? 'bg-brand-black text-brand-yellow'
                            : 'bg-white border border-brand-border text-brand-black hover:bg-brand-soft-yellow'
                          }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-brand-muted flex items-center justify-between pt-2 border-t border-brand-border/60">
                  <span>Each Guest Pays:</span>
                  <span className="font-mono font-bold text-brand-black text-sm">
                    ~₹{roundMoney(((order.outstanding_balance ?? order.total_amount) / equalCount)).toFixed(2)}
                  </span>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleGenerateSplits('EQUAL')}
                  disabled={isProcessing}
                >
                  Generate {equalCount}-Way Equal Split
                </Button>
              </div>
            )}

            {activeMode === 'CUSTOM' && (
              <div className="p-4 bg-brand-warm-white rounded-2xl border border-brand-border space-y-3">
                <p className="text-xs text-brand-muted">
                  Enter custom amounts for each guest. Total must equal ₹{(order.outstanding_balance ?? order.total_amount).toFixed(2)}.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {customAmounts.map((amt, idx) => (
                    <div key={idx}>
                      <label className="block text-[11px] font-bold text-brand-black mb-1">
                        Guest {idx + 1} Amount (₹):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={amt || ''}
                        onChange={(e) => {
                          const updated = [...customAmounts];
                          updated[idx] = parseFloat(e.target.value) || 0;
                          setCustomAmounts(updated);
                        }}
                        className="w-full text-xs p-2 rounded-xl border border-brand-border font-mono font-bold"
                        placeholder="0.00"
                      />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setCustomAmounts((prev) => [...prev, 0])}
                  className="text-xs font-bold text-brand-black underline"
                >
                  + Add another guest
                </button>

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleGenerateSplits('CUSTOM')}
                  disabled={isProcessing}
                >
                  Confirm Custom Split
                </Button>
              </div>
            )}

            {activeMode === 'ITEMS' && (
              <div className="p-4 bg-brand-warm-white rounded-2xl border border-brand-border space-y-3">
                <p className="text-xs text-brand-muted">
                  Distribute the {order.items?.length || 0} order dishes between Guest 1 and Guest 2:
                </p>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {order.items?.map((it) => (
                    <div
                      key={it.id}
                      className="p-2.5 rounded-xl border border-brand-border bg-white text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-bold text-brand-black">{it.item_name_snapshot}</p>
                        <p className="font-mono text-brand-muted text-[11px]">₹{it.total_price.toFixed(2)}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-bold">
                          <input
                            type="checkbox"
                            checked={(itemAssignments[1] || []).includes(it.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setItemAssignments((prev) => ({
                                ...prev,
                                1: checked
                                  ? [...(prev[1] || []), it.id]
                                  : (prev[1] || []).filter((id) => id !== it.id),
                              }));
                            }}
                            className="mr-1 accent-brand-black"
                          />
                          Guest 1
                        </label>
                        <label className="text-[11px] font-bold">
                          <input
                            type="checkbox"
                            checked={(itemAssignments[2] || []).includes(it.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setItemAssignments((prev) => ({
                                ...prev,
                                2: checked
                                  ? [...(prev[2] || []), it.id]
                                  : (prev[2] || []).filter((id) => id !== it.id),
                              }));
                            }}
                            className="mr-1 accent-brand-black"
                          />
                          Guest 2
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleGenerateSplits('ITEMS')}
                  disabled={isProcessing}
                >
                  Generate Item Split Bills
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Existing Splits Settlement List */}
        {splits.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-bold text-brand-black uppercase tracking-wider">
                Split Shares ({splits.length} Guests):
              </span>
              {outstandingBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setSplits([])}
                  className="text-xs text-brand-muted hover:text-brand-black underline"
                >
                  Reconfigure Splits
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {splits.map((split) => {
                const isPaid = split.payment_status === 'PAID';
                return (
                  <div
                    key={split.id}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${isPaid
                        ? 'border-emerald-300 bg-emerald-50/40'
                        : 'border-brand-border bg-white shadow-card-subtle'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-bold text-sm text-brand-black">
                        {split.label}
                      </span>
                      <span
                        className={`text-[10px] font-heading font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${isPaid
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                      >
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-brand-muted">Payable Share:</span>
                      <span className="font-mono text-xl font-black text-brand-black">
                        ₹{split.amount.toFixed(2)}
                      </span>
                    </div>

                    {isPaid ? (
                      <div className="pt-2 border-t border-emerald-200 text-[11px] text-emerald-800 space-y-0.5">
                        <p className="flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Paid via {split.payment_method}</span>
                        </p>
                        <p className="font-mono text-[10px] text-emerald-700 truncate">
                          Ref: {split.transaction_reference}
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-brand-border/60 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSettleSplit(split.id, 'UPI')}
                          disabled={isProcessing}
                          className="flex-1 py-1 px-2 rounded-lg bg-brand-black hover:bg-brand-charcoal text-brand-yellow font-heading font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>UPI</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSettleSplit(split.id, 'CARD')}
                          disabled={isProcessing}
                          className="flex-1 py-1 px-2 rounded-lg bg-brand-yellow hover:bg-brand-yellow/80 text-brand-black font-heading font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Card</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSettleSplit(split.id, 'CASH')}
                          disabled={isProcessing}
                          className="flex-1 py-1 px-2 rounded-lg bg-white border border-brand-border hover:bg-brand-warm-white text-brand-black font-heading font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Cash</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Order Settlement & Closure */}
        <div className="pt-4 border-t border-brand-border flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
            Done / Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReceiptModal(true)}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print Bill
            </Button>

            {outstandingBalance === 0 && order.order_status !== 'COMPLETED' && (
              <Button
                variant="primary"
                size="md"
                onClick={handleCloseOrder}
                disabled={isProcessing}
                leftIcon={<Sparkles className="w-4 h-4" />}
              >
                Complete Order & Mark Table Cleaning
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Cashier Receipt Modal from Split Modal */}
      <CashierReceiptModal
        order={order}
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
      />
    </Modal>
  );
};
