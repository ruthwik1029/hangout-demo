import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchOrders, updateOrderStatus } from '../../lib/supabase';
import { useRealtimeOperationalSync } from '../../lib/realtime';
import { Order, OrderStatus } from '../../types';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { CashierReceiptModal } from '../../components/staff/CashierReceiptModal';
import { TakeawayBoard } from '../../components/staff/TakeawayBoard';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  UtensilsCrossed,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Banknote,
  Eye,
  Check,
  Printer,
} from 'lucide-react';

export const AdminOrdersPage: React.FC = () => {
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'DINING' | 'TAKEAWAY'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Order Drawer
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Reject Reason Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Status Action Loading
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'takeaway_board'>('table');

  const loadOrders = useCallback(async () => {
    const data = await fetchOrders();
    setOrders(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
    const interval = setInterval(() => {
      loadOrders();
    }, 6000);

    const handleFocus = () => loadOrders();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadOrders]);

  useRealtimeOperationalSync(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  // Filtered Orders List
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter === 'unpaid') {
        if (o.payment_status !== 'UNPAID') return false;
      } else if (statusFilter !== 'all') {
        if (o.status !== statusFilter) return false;
      }

      // Order type filter
      if (typeFilter !== 'all' && o.order_type !== typeFilter) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchNum = o.order_number.toLowerCase().includes(query);
        const matchName = o.customer_name_snapshot.toLowerCase().includes(query);
        const matchMobile = o.customer_mobile_snapshot.includes(query);
        if (!matchNum && !matchName && !matchMobile) return false;
      }

      return true;
    });
  }, [orders, statusFilter, typeFilter, searchQuery]);

  // Open Details Drawer
  const handleOpenDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsDrawerOpen(true);
  };

  // Perform Status Transition
  const handleStatusTransition = async (newStatus: OrderStatus, reason?: string) => {
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);

    try {
      const updated = await updateOrderStatus(selectedOrder.id, newStatus, reason);
      if (updated) {
        setSelectedOrder(updated);
        showToast({
          type: 'success',
          title: 'Order Status Updated',
          message: `Order #${updated.order_number} is now ${newStatus.replace(/_/g, ' ')}.`,
        });
        await loadOrders();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      showToast({ type: 'error', title: 'Error', message: msg });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Confirm Rejection with Reason
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      showToast({ type: 'error', title: 'Reason Required', message: 'Please provide a reason for rejecting the order.' });
      return;
    }

    setIsRejecting(true);
    await handleStatusTransition('REJECTED', rejectReason.trim());
    setIsRejecting(false);
    setIsRejectModalOpen(false);
    setRejectReason('');
  };

  // Mark Order as Paid (Counter Settlement)
  const handleMarkAsPaid = async () => {
    if (!selectedOrder) return;
    setIsUpdatingStatus(true);
    try {
      const updated = await updateOrderStatus(selectedOrder.id, selectedOrder.status, undefined, 'PAID');
      if (updated) {
        setSelectedOrder(updated);
        showToast({
          type: 'success',
          title: 'Payment Confirmed',
          message: `Order #${updated.order_number} marked as PAID.`,
        });
        await loadOrders();
      }
    } catch {
      showToast({ type: 'error', title: 'Error', message: 'Failed to record payment.' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      <AdminNav
        title="Live Orders & Order Lifecycle"
        subtitle="Process incoming tickets, state transitions, kitchen queue, and payment settlement."
      />

      {/* View Mode Switcher */}
      <div className="flex items-center justify-between bg-white p-2 rounded-2xl border border-brand-border shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode('table')}
            className={`px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all ${
              viewMode === 'table'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-charcoal hover:bg-brand-warm-white'
            }`}
          >
            All Orders Overview
          </button>
          <button
            onClick={() => setViewMode('takeaway_board')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all ${
              viewMode === 'takeaway_board'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-charcoal hover:bg-brand-warm-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Takeaway Counter Board</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-brand-yellow text-brand-black font-extrabold">
              {orders.filter((o) => o.order_type === 'TAKEAWAY' && ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP'].includes(o.status)).length}
            </span>
          </button>
        </div>
      </div>

      {viewMode === 'takeaway_board' ? (
        <TakeawayBoard orders={orders} onRefresh={loadOrders} />
      ) : (
        <>
          {/* Filter Tabs & Search Bar */}
          <div className="space-y-4">
        {/* Status Tab Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: `All Orders (${orders.length})` },
            { id: 'PENDING', label: `Pending (${orders.filter((o) => o.status === 'PENDING').length})` },
            { id: 'ACCEPTED', label: `Accepted (${orders.filter((o) => o.status === 'ACCEPTED').length})` },
            { id: 'PREPARING', label: `Cooking (${orders.filter((o) => o.status === 'PREPARING').length})` },
            { id: 'READY_FOR_PICKUP', label: `Ready (${orders.filter((o) => o.status === 'READY_FOR_PICKUP').length})` },
            { id: 'COMPLETED', label: `Completed (${orders.filter((o) => o.status === 'COMPLETED').length})` },
            { id: 'unpaid', label: `Unpaid (${orders.filter((o) => o.payment_status === 'UNPAID').length})` },
            { id: 'REJECTED', label: `Rejected (${orders.filter((o) => o.status === 'REJECTED').length})` },
            { id: 'CANCELLED', label: `Cancelled (${orders.filter((o) => o.status === 'CANCELLED').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-brand-black text-brand-yellow shadow-sm'
                  : 'bg-white border border-brand-border text-brand-charcoal hover:bg-brand-warm-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Mode Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by order #, guest name, or mobile number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-brand-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-brand-muted">Mode:</span>
            <div className="flex items-center p-1 bg-white border border-brand-border rounded-xl">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  typeFilter === 'all' ? 'bg-brand-black text-brand-yellow' : 'text-brand-muted'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setTypeFilter('DINING')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  typeFilter === 'DINING' ? 'bg-brand-black text-brand-yellow' : 'text-brand-muted'
                }`}
              >
                Dining
              </button>
              <button
                onClick={() => setTypeFilter('TAKEAWAY')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  typeFilter === 'TAKEAWAY' ? 'bg-brand-black text-brand-yellow' : 'text-brand-muted'
                }`}
              >
                Takeaway
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List Table */}
      {loading ? (
        <div className="p-16 text-center text-xs text-brand-muted">Loading live orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-brand-border text-center space-y-3">
          <p className="text-xs text-brand-muted">No orders found matching the filter criteria.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter('all');
              setTypeFilter('all');
              setSearchQuery('');
            }}
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-border shadow-card-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-border bg-brand-warm-white text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Guest</th>
                  <th className="py-3 px-4">Mode / Table</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Order Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-xs text-brand-charcoal">
                {filteredOrders.map((order) => {
                  const isPaid = order.payment_status === 'PAID';
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-brand-warm-white/60 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetails(order)}
                    >
                      <td className="py-3.5 px-4 font-mono font-extrabold text-brand-black">
                        #{order.order_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-heading font-bold text-brand-black">
                          {order.customer_name_snapshot}
                        </p>
                        <p className="text-[11px] text-brand-muted">+91 {order.customer_mobile_snapshot}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        {order.order_type === 'DINING' ? (
                          <span className="inline-flex items-center gap-1 font-bold text-brand-black">
                            <UtensilsCrossed className="w-3.5 h-3.5 text-brand-yellow" />
                            Table {order.table_number_snapshot || 'Assigned'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-bold text-brand-black">
                            <ShoppingBag className="w-3.5 h-3.5 text-brand-yellow" />
                            {order.pickup_slot_snapshot || 'Takeaway'}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-brand-muted text-[11px]">
                        {new Date(order.created_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs truncate text-brand-muted">
                        {order.items?.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(', ')}
                      </td>
                      <td className="py-3.5 px-4 font-heading font-extrabold text-brand-black">
                        ₹{order.total_amount.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {isPaid ? 'PAID' : 'UNPAID'} ({order.payment_method})
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
                            order.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : order.status === 'ACCEPTED'
                              ? 'bg-blue-100 text-blue-800'
                              : order.status === 'PREPARING'
                              ? 'bg-purple-100 text-purple-800'
                              : order.status === 'READY_FOR_PICKUP'
                              ? 'bg-emerald-100 text-emerald-800'
                              : order.status === 'COMPLETED'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {order.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(order);
                          }}
                          rightIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
        </>
      )}

      {/* Order Details Slide-Out Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedOrder ? `Order #${selectedOrder.order_number}` : 'Order Details'}
        maxWidth="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            {/* Quick Status Bar */}
            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-brand-muted uppercase">Lifecycle Status</span>
                <p className="font-heading font-extrabold text-lg text-brand-black">
                  {selectedOrder.status.replace(/_/g, ' ')}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-brand-muted uppercase">Payment Status</span>
                <p
                  className={`font-heading font-bold text-sm ${
                    selectedOrder.payment_status === 'PAID' ? 'text-emerald-700' : 'text-amber-800'
                  }`}
                >
                  {selectedOrder.payment_status} ({selectedOrder.payment_method})
                </p>
              </div>
            </div>

            {/* Bill Receipt View & Print */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-brand-border">
              <div>
                <span className="text-[10px] font-bold uppercase text-brand-muted block">Digital Receipt & Print</span>
                <span className="text-xs font-semibold text-brand-black">View bill breakdown, reprint copy, or print 80mm thermal receipt</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReceiptModalOpen(true)}
                leftIcon={<Printer className="w-3.5 h-3.5" />}
              >
                View / Print Bill
              </Button>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="p-5 bg-brand-charcoal text-white rounded-3xl space-y-3">
              <span className="text-xs font-bold text-brand-yellow uppercase tracking-wider block">
                Manage Order Stage Transitions
              </span>

              <div className="flex flex-wrap gap-2">
                {selectedOrder.status === 'PENDING' && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isUpdatingStatus}
                      onClick={() => handleStatusTransition('ACCEPTED')}
                      leftIcon={<Check className="w-4 h-4" />}
                    >
                      Accept Order
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 border-red-500/40 hover:bg-red-500/10"
                      onClick={() => setIsRejectModalOpen(true)}
                      leftIcon={<XCircle className="w-4 h-4" />}
                    >
                      Reject Order
                    </Button>
                  </>
                )}

                {selectedOrder.status === 'ACCEPTED' && (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      isLoading={isUpdatingStatus}
                      onClick={() => handleStatusTransition('PREPARING')}
                      leftIcon={<Clock className="w-4 h-4" />}
                    >
                      Dispatch to Kitchen (Cooking)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-400 border-red-500/40 hover:bg-red-500/10"
                      onClick={() => handleStatusTransition('CANCELLED', 'Cancelled by admin')}
                    >
                      Cancel Order
                    </Button>
                  </>
                )}

                {selectedOrder.status === 'PREPARING' && (
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isUpdatingStatus}
                    onClick={() => handleStatusTransition('READY_FOR_PICKUP')}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Mark Ready for Pickup / Table Delivery
                  </Button>
                )}

                {selectedOrder.status === 'READY_FOR_PICKUP' && (
                  <Button
                    variant="primary"
                    size="sm"
                    isLoading={isUpdatingStatus}
                    onClick={() => handleStatusTransition('COMPLETED')}
                    leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    Complete Order (Served / Handed Over)
                  </Button>
                )}

                {selectedOrder.payment_status === 'UNPAID' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-emerald-500 text-emerald-400 hover:bg-emerald-500/10"
                    isLoading={isUpdatingStatus}
                    onClick={handleMarkAsPaid}
                    leftIcon={<Banknote className="w-4 h-4" />}
                  >
                    Settle Payment (Mark as Paid)
                  </Button>
                )}
              </div>
            </div>

            {/* Guest Snapshot */}
            <div className="p-4 rounded-2xl bg-white border border-brand-border space-y-2">
              <span className="text-xs font-heading font-bold text-brand-black flex items-center gap-1.5 uppercase tracking-wider">
                <User className="w-4 h-4 text-brand-black" /> Guest Information
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-brand-muted text-[11px]">Name:</span>
                  <p className="font-bold text-brand-black">{selectedOrder.customer_name_snapshot}</p>
                </div>
                <div>
                  <span className="text-brand-muted text-[11px]">Mobile:</span>
                  <p className="font-mono font-bold text-brand-black">+91 {selectedOrder.customer_mobile_snapshot}</p>
                </div>
                {selectedOrder.customer_email_snapshot && (
                  <div className="col-span-2">
                    <span className="text-brand-muted text-[11px]">Email:</span>
                    <p className="font-mono text-brand-black">{selectedOrder.customer_email_snapshot}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Fulfillment Details */}
            <div className="p-4 rounded-2xl bg-white border border-brand-border space-y-1 text-xs">
              <span className="text-brand-muted text-[11px] font-bold uppercase">Order Mode</span>
              <p className="font-heading font-bold text-sm text-brand-black">
                {selectedOrder.order_type === 'DINING'
                  ? `Dine-In • Table ${selectedOrder.table_number_snapshot || 'Assigned'}`
                  : `Self-Pickup • ${selectedOrder.pickup_slot_snapshot || 'Counter'}`}
              </p>
              {selectedOrder.notes && (
                <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs italic mt-2">
                  Guest Note: {selectedOrder.notes}
                </p>
              )}
            </div>

            {/* Ordered Items List */}
            <div className="space-y-2">
              <span className="text-xs font-heading font-bold text-brand-black uppercase tracking-wider">
                Items ({selectedOrder.items?.length || 0})
              </span>
              <div className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden bg-brand-warm-white">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="p-3 text-xs flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading font-bold text-brand-black">
                        {item.item_name_snapshot} <span className="text-brand-muted">× {item.quantity}</span>
                      </p>
                      {item.variant_name_snapshot && (
                        <p className="text-[11px] text-brand-muted">Option: {item.variant_name_snapshot}</p>
                      )}
                      {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                        <p className="text-[11px] text-brand-muted">
                          Extras: {item.addon_names_snapshot.join(', ')}
                        </p>
                      )}
                      {item.special_instructions && (
                        <p className="italic text-amber-900 text-[11px]">Note: {item.special_instructions}</p>
                      )}
                    </div>
                    <span className="font-heading font-bold text-brand-black">
                      ₹{item.total_price.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill & Tax Breakdown */}
            <div className="p-4 rounded-2xl bg-white border border-brand-border space-y-2 text-xs">
              <div className="flex justify-between text-brand-muted">
                <span>Subtotal</span>
                <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
              </div>
              {selectedOrder.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span>-₹{selectedOrder.discount_amount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-brand-muted">
                <span>CGST ({selectedOrder.tax_breakdown?.cgstRate || 2.5}%)</span>
                <span>₹{(selectedOrder.tax_breakdown?.cgstAmount || selectedOrder.tax_amount / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-brand-muted">
                <span>SGST ({selectedOrder.tax_breakdown?.sgstRate || 2.5}%)</span>
                <span>₹{(selectedOrder.tax_breakdown?.sgstAmount || selectedOrder.tax_amount / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-heading font-extrabold text-base text-brand-black pt-2 border-t border-brand-border">
                <span>Total Amount</span>
                <span>₹{selectedOrder.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Reject Reason Required Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Order"
        subtitle="Please provide an operational reason for rejecting this order."
        maxWidth="md"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
              Reason for Rejection <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Kitchen overloaded during peak rush, or ingredients temporarily out of stock"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-brand-yellow focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setIsRejectModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isRejecting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>

      {/* Cashier Receipt Modal */}
      <CashierReceiptModal
        order={selectedOrder}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
  );
};
