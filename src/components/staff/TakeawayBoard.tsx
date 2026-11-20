import React, { useState, useMemo } from 'react';
import { Order, OrderStatus } from '../../types';
import { updateOrderStatus } from '../../lib/supabase';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { ThermalPrinterAnimation } from '../receipt/ThermalPrinterAnimation';
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Check,
  X,
  Printer,
  Search,
  Banknote,
  Phone,
  MessageCircle,
  Flame,
  PackageCheck,
  User,
} from 'lucide-react';

interface TakeawayBoardProps {
  orders: Order[];
  onRefresh: () => void;
}

type TakeawayTab = 'pending' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export const TakeawayBoard: React.FC<TakeawayBoardProps> = ({ orders, onRefresh }) => {
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<TakeawayTab>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<Order | null>(null);

  // Rejection modal
  const [rejectOrderTarget, setRejectOrderTarget] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Status update loader state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Filter only Takeaway orders
  const takeawayOrders = useMemo(() => {
    return orders.filter((o) => o.order_type === 'TAKEAWAY');
  }, [orders]);

  // Group by status
  const groupedOrders = useMemo(() => {
    const pending = takeawayOrders.filter((o) => o.status === 'PENDING');
    const accepted = takeawayOrders.filter((o) => o.status === 'ACCEPTED');
    const preparing = takeawayOrders.filter((o) => o.status === 'PREPARING');
    const ready = takeawayOrders.filter((o) => o.status === 'READY_FOR_PICKUP');
    const completed = takeawayOrders.filter((o) => o.status === 'COMPLETED');
    const cancelled = takeawayOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED');

    return {
      pending,
      accepted,
      preparing,
      ready,
      completed,
      cancelled,
    };
  }, [takeawayOrders]);

  // Filter by search query
  const currentTabOrders = useMemo(() => {
    const list = groupedOrders[activeTab] || [];
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name_snapshot && o.customer_name_snapshot.toLowerCase().includes(q)) ||
        (o.customer_mobile_snapshot && o.customer_mobile_snapshot.includes(q))
    );
  }, [groupedOrders, activeTab, searchQuery]);

  // Handle status transition
  const handleTransition = async (order: Order, nextStatus: OrderStatus, notes?: string) => {
    setActionLoadingId(order.id);
    try {
      await updateOrderStatus(
        order.id,
        nextStatus,
        notes || `Takeaway status changed to ${nextStatus}`,
        undefined,
        currentUser?.full_name || 'Counter Staff'
      );
      showToast({
        type: 'success',
        title: 'Status Updated',
        message: `Order #${order.order_number} moved to ${nextStatus.replace(/_/g, ' ')}.`,
      });
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update order status';
      showToast({ type: 'error', title: 'Update Failed', message: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Settle Cash / Mark Paid
  const handleMarkPaid = async (order: Order) => {
    setActionLoadingId(order.id);
    try {
      await updateOrderStatus(
        order.id,
        order.status,
        'PAID',
        'PAID',
        currentUser?.full_name || 'Cashier'
      );
      showToast({
        type: 'success',
        title: 'Payment Recorded',
        message: `Order #${order.order_number} settled in cash / paid at counter.`,
      });
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment';
      showToast({ type: 'error', title: 'Payment Error', message: msg });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Confirm Reject
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectOrderTarget) return;
    if (!rejectReason.trim()) {
      showToast({ type: 'error', title: 'Reason Required', message: 'Please provide a cancellation/rejection reason.' });
      return;
    }

    setIsRejecting(true);
    try {
      await updateOrderStatus(
        rejectOrderTarget.id,
        'REJECTED',
        rejectReason.trim(),
        undefined,
        currentUser?.full_name || 'Manager'
      );
      showToast({
        type: 'info',
        title: 'Order Rejected',
        message: `Order #${rejectOrderTarget.order_number} has been rejected.`,
      });
      setRejectOrderTarget(null);
      setRejectReason('');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      showToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setIsRejecting(false);
    }
  };

  const tabsConfig = [
    { key: 'pending' as const, label: 'New Orders', count: groupedOrders.pending.length, color: 'bg-amber-100 text-amber-900 border-amber-300' },
    { key: 'accepted' as const, label: 'Confirmed', count: groupedOrders.accepted.length, color: 'bg-blue-100 text-blue-900 border-blue-300' },
    { key: 'preparing' as const, label: 'Preparing', count: groupedOrders.preparing.length, color: 'bg-purple-100 text-purple-900 border-purple-300' },
    { key: 'ready' as const, label: 'Ready for Pickup', count: groupedOrders.ready.length, countPulse: true, color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    { key: 'completed' as const, label: 'Completed', count: groupedOrders.completed.length, color: 'bg-gray-100 text-gray-800 border-gray-300' },
    { key: 'cancelled' as const, label: 'Cancelled / Rejected', count: groupedOrders.cancelled.length, color: 'bg-red-50 text-red-800 border-red-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-brand-border shadow-card-subtle">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-yellow text-brand-black flex items-center justify-center shadow-xs">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-extrabold text-xl text-brand-black">
                Takeaway Counter Operations
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-warm-white border border-brand-border text-brand-muted uppercase">
                Self-Pickup Only
              </span>
            </div>
            <p className="text-xs text-brand-muted">
              Live counter ticket board. Accept incoming pickup orders, manage kitchen handovers, and collect counter payments.
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64 relative">
          <Search className="w-4 h-4 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Order # or Mobile..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-brand-border text-xs focus:ring-2 focus:ring-brand-yellow focus:outline-none"
          />
        </div>
      </div>

      {/* Categorized Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabsConfig.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-heading font-bold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-brand-black text-brand-yellow border-brand-black shadow-sm'
                  : 'bg-white text-brand-charcoal hover:bg-brand-warm-white border-brand-border'
              }`}
            >
              <span>{t.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive
                    ? 'bg-brand-yellow text-brand-black'
                    : t.count > 0
                    ? t.color
                    : 'bg-gray-100 text-gray-500'
                } ${t.countPulse && t.count > 0 && !isActive ? 'animate-bounce' : ''}`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      {currentTabOrders.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-brand-border space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-warm-white flex items-center justify-center mx-auto text-brand-muted">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="font-heading font-bold text-base text-brand-black">
            No Orders in {tabsConfig.find((t) => t.key === activeTab)?.label}
          </h3>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            {searchQuery
              ? `No takeaway orders matched "${searchQuery}".`
              : 'New orders will automatically appear here when placed by customers.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentTabOrders.map((ord) => {
            const isLoading = actionLoadingId === ord.id;
            const isPaid = ord.payment_status === 'PAID';

            return (
              <div
                key={ord.id}
                className="bg-white rounded-3xl border border-brand-border hover:border-brand-charcoal/30 shadow-card-subtle flex flex-col justify-between overflow-hidden transition-all"
              >
                {/* Ticket Top */}
                <div className="p-5 space-y-4">
                  {/* Order Ref & Time Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-brand-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-black text-xl text-brand-black font-mono">
                          #{ord.order_number}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            ord.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-900'
                              : ord.status === 'ACCEPTED'
                              ? 'bg-blue-100 text-blue-900'
                              : ord.status === 'PREPARING'
                              ? 'bg-purple-100 text-purple-900'
                              : ord.status === 'READY_FOR_PICKUP'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {ord.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[10px] text-brand-muted flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(ord.created_at).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="font-heading font-extrabold text-base text-brand-black block">
                        ₹{ord.total_amount.toFixed(2)}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md inline-block ${
                          isPaid
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 animate-pulse'
                        }`}
                      >
                        {isPaid ? 'PAID' : 'UNPAID'}
                      </span>
                    </div>
                  </div>

                  {/* Customer & Pickup Details */}
                  <div className="bg-brand-warm-white p-3 rounded-2xl border border-brand-border space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-brand-black flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-brand-muted" />
                        {ord.customer_name_snapshot || 'Guest Customer'}
                      </span>
                      {ord.customer_mobile_snapshot && (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${ord.customer_mobile_snapshot}`}
                            className="p-1 rounded bg-white hover:bg-gray-100 text-brand-black"
                            title="Call customer"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <a
                            href={`https://wa.me/91${ord.customer_mobile_snapshot.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-white hover:bg-gray-100 text-emerald-600"
                            title="WhatsApp message"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-brand-muted pt-0.5 border-t border-brand-border/60">
                      <span>Pickup Slot:</span>
                      <span className="font-bold text-brand-black">
                        {ord.pickup_slot_snapshot || 'Counter Pickup'}
                      </span>
                    </div>
                  </div>

                  {/* Itemized List */}
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {ord.items?.map((item) => (
                      <div key={item.id} className="text-xs flex justify-between items-start">
                        <div className="flex-1 pr-2">
                          <span className="font-bold text-brand-black">
                            {item.quantity}× {item.item_name_snapshot}
                          </span>
                          {item.variant_name_snapshot && (
                            <span className="text-[10px] text-brand-muted block pl-4">
                              • {item.variant_name_snapshot}
                            </span>
                          )}
                          {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                            <span className="text-[10px] text-brand-muted block pl-4">
                              • Add: {item.addon_names_snapshot.join(', ')}
                            </span>
                          )}
                          {item.special_instructions && (
                            <span className="text-[10px] italic text-amber-800 block pl-4">
                              Note: {item.special_instructions}
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-xs font-bold text-brand-charcoal">
                          ₹{item.total_price.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Special Notes Callout if present */}
                  {ord.special_instructions && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                      <strong>Customer Note:</strong> {ord.special_instructions}
                    </div>
                  )}
                </div>

                {/* Ticket Action Footer */}
                <div className="p-4 bg-brand-warm-white/70 border-t border-brand-border space-y-2">
                  {/* Payment settlement button if unpaid */}
                  {!isPaid && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-emerald-800 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100"
                      onClick={() => handleMarkPaid(ord)}
                      isLoading={isLoading}
                      leftIcon={<Banknote className="w-3.5 h-3.5 text-emerald-700" />}
                    >
                      Collect Cash & Mark Paid
                    </Button>
                  )}

                  {/* Primary Stage Transition Controls */}
                  <div className="flex items-center gap-2">
                    {ord.status === 'PENDING' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleTransition(ord, 'ACCEPTED')}
                          isLoading={isLoading}
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                        >
                          Accept Order
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setRejectOrderTarget(ord)}
                          leftIcon={<X className="w-3.5 h-3.5" />}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {ord.status === 'ACCEPTED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                        onClick={() => handleTransition(ord, 'PREPARING')}
                        isLoading={isLoading}
                        leftIcon={<Flame className="w-3.5 h-3.5" />}
                      >
                        Start Preparing (KDS)
                      </Button>
                    )}

                    {ord.status === 'PREPARING' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleTransition(ord, 'READY_FOR_PICKUP')}
                        isLoading={isLoading}
                        leftIcon={<PackageCheck className="w-3.5 h-3.5" />}
                      >
                        Mark Ready for Pickup
                      </Button>
                    )}

                    {ord.status === 'READY_FOR_PICKUP' && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full bg-brand-black text-brand-yellow hover:bg-gray-900"
                        onClick={() => handleTransition(ord, 'COMPLETED')}
                        isLoading={isLoading}
                        leftIcon={<CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      >
                        Hand Over & Complete
                      </Button>
                    )}

                    {ord.status === 'COMPLETED' && (
                      <div className="w-full py-1.5 text-center text-[11px] font-bold text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200">
                        Order Collected & Finished
                      </div>
                    )}

                    {/* Receipt print shortcut */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrderForBill(ord)}
                      className="p-2 rounded-xl bg-white border border-brand-border hover:bg-brand-warm-white text-brand-charcoal transition-colors shrink-0"
                      title="Print or view digital bill"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Order Reason Modal */}
      {rejectOrderTarget && (
        <Modal
          isOpen={Boolean(rejectOrderTarget)}
          onClose={() => setRejectOrderTarget(null)}
          title={`Reject Takeaway Order #${rejectOrderTarget.order_number}`}
        >
          <form onSubmit={handleConfirmReject} className="space-y-4">
            <p className="text-xs text-brand-muted">
              Please specify why this takeaway order cannot be fulfilled:
            </p>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Items out of stock, kitchen busy, counter closing..."
              rows={3}
              className="w-full p-3 rounded-xl border border-brand-border text-xs focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => setRejectOrderTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isRejecting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Rejection
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Bill & Thermal Receipt Animation Modal */}
      {selectedOrderForBill && (
        <ThermalPrinterAnimation
          order={selectedOrderForBill}
          isOpen={Boolean(selectedOrderForBill)}
          onClose={() => setSelectedOrderForBill(null)}
        />
      )}
    </div>
  );
};
