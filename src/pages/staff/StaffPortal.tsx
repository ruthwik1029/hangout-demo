import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { StaffNav } from '../../components/staff/StaffNav';
import { TableCard } from '../../components/staff/TableCard';
import { TableDetailDrawer } from '../../components/staff/TableDetailDrawer';
import { DiningOrderApprovalCard } from '../../components/staff/DiningOrderApprovalCard';
import { RejectionReasonModal } from '../../components/staff/RejectionReasonModal';
import { WaiterOrderModal } from '../../components/staff/WaiterOrderModal';
import { BillSplittingModal } from '../../components/staff/BillSplittingModal';
import { CashierReceiptModal } from '../../components/staff/CashierReceiptModal';
import { Button } from '../../components/common/Button';
import {
  fetchCafeTables,
  fetchOrders,
  fetchMenuItems,
  fetchMenuCategories,
  approveDiningOrder,
  rejectDiningOrder,
  markOrderServed,
  markTableCleaning,
  markTableAvailable,
} from '../../lib/supabase';
import { useRealtimeOperationalSync } from '../../lib/realtime';
import { CafeTable, Order, MenuItem, MenuCategory, TableStatus } from '../../types';
import {
  UtensilsCrossed,
  Receipt,
  Sparkles,
  Filter,
  CheckCircle2,
  Printer,
} from 'lucide-react';

export const StaffPortal: React.FC = () => {
  const { currentUser, availableDemoUsers } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'tables' | 'approvals' | 'active_orders' | 'billing'>('tables');
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);

  // Filter states
  const [tableStatusFilter, setTableStatusFilter] = useState<'all' | TableStatus>('all');
  const [tableSectionFilter, setTableSectionFilter] = useState<string>('all');

  // Modals & Drawers
  const [selectedTableForDrawer, setSelectedTableForDrawer] = useState<CafeTable | null>(null);
  const [selectedTableForOrder, setSelectedTableForOrder] = useState<CafeTable | null>(null);
  const [orderToReject, setOrderToReject] = useState<Order | null>(null);
  const [selectedOrderForBill, setSelectedOrderForBill] = useState<Order | null>(null);
  const [orderForReceipt, setOrderForReceipt] = useState<Order | null>(null);
  const [existingOrderToAppend, setExistingOrderToAppend] = useState<Order | null>(null);

  // Load all initial operational data
  const loadData = useCallback(async () => {
    try {
      const [tList, oList, mList, cList] = await Promise.all([
        fetchCafeTables(),
        fetchOrders(),
        fetchMenuItems(),
        fetchMenuCategories(),
      ]);
      setTables(tList);
      setOrders(oList);
      setMenuItems(mList);
      setCategories(cList);
    } catch (err) {
      console.error('Staff portal loadData error:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Hook into Realtime operational events
  useRealtimeOperationalSync(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Pending dining approvals (Dining orders in PENDING status)
  const pendingDiningApprovals = useMemo(() => {
    return orders.filter((o) => o.order_type === 'DINING' && o.order_status === 'PENDING');
  }, [orders]);

  // Active dining orders
  const activeDiningOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.order_type === 'DINING' &&
        ['ACCEPTED', 'PREPARING', 'PREPARATION_COMPLETED', 'READY_FOR_SERVICE', 'SERVED'].includes(
          o.order_status
        )
    );
  }, [orders]);

  // Tables with active orders map
  const tableOrderMap = useMemo(() => {
    const map = new Map<string, Order>();
    orders.forEach((o) => {
      if (
        o.table_id &&
        o.order_status !== 'COMPLETED' &&
        o.order_status !== 'CANCELLED' &&
        o.order_status !== 'REJECTED'
      ) {
        map.set(o.table_id, o);
      }
    });
    return map;
  }, [orders]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const totalTables = tables.length;
    const occupiedTables = tables.filter((t) => t.status === 'occupied').length;
    const availableTables = tables.filter((t) => t.status === 'available').length;
    const cleaningTables = tables.filter((t) => t.status === 'cleaning').length;
    const unpaidBillsCount = orders.filter(
      (o) => o.order_type === 'DINING' && o.payment_status !== 'PAID' && o.order_status !== 'CANCELLED'
    ).length;
    const readyForServiceCount = orders.filter((o) => o.order_status === 'READY_FOR_SERVICE').length;

    return {
      totalTables,
      occupiedTables,
      availableTables,
      cleaningTables,
      unpaidBillsCount,
      readyForServiceCount,
    };
  }, [tables, orders]);

  // Filtered tables for grid
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (tableStatusFilter !== 'all' && t.status !== tableStatusFilter) return false;
      if (tableSectionFilter !== 'all' && t.section !== tableSectionFilter) return false;
      return true;
    });
  }, [tables, tableStatusFilter, tableSectionFilter]);

  // Available sections
  const sections = useMemo(() => {
    return Array.from(new Set(tables.map((t) => t.section)));
  }, [tables]);

  // Approve Dining Order
  const handleApproveOrder = async (orderId: string) => {
    try {
      const approved = await approveDiningOrder(
        orderId,
        currentUser?.id || 'u-waiter-01',
        currentUser?.full_name || 'Floor Staff'
      );
      showToast({
        type: 'success',
        title: 'Dining Order Approved',
        message: `Order #${approved.order_number} sent to Kitchen Display System (KDS).`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      showToast({ type: 'error', title: 'Approval Failed', message: msg });
    }
  };

  // Reject Dining Order
  const handleConfirmReject = async (orderId: string, reason: string) => {
    try {
      const rejected = await rejectDiningOrder(
        orderId,
        reason,
        currentUser?.id || 'u-waiter-01',
        currentUser?.full_name || 'Floor Staff'
      );
      showToast({
        type: 'info',
        title: 'Dining Order Rejected',
        message: `Order #${rejected.order_number} rejected: ${reason}`,
      });
      setOrderToReject(null);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rejection failed';
      showToast({ type: 'error', title: 'Rejection Failed', message: msg });
    }
  };

  // Mark Served
  const handleMarkServed = async (orderId: string) => {
    try {
      const updated = await markOrderServed(orderId, currentUser?.full_name || 'Waiter');
      showToast({
        type: 'success',
        title: 'Order Marked Served',
        message: `Table order #${updated.order_number} served to guests.`,
      });
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast({ type: 'error', title: 'Action Failed', message: msg });
    }
  };

  // Quick Table Cleaning Toggle
  const handleMarkCleaning = async (tableId: string) => {
    try {
      await markTableCleaning(tableId, currentUser?.full_name || 'Staff');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast({ type: 'error', title: 'Action Failed', message: msg });
    }
  };

  const handleMarkAvailable = async (tableId: string) => {
    try {
      await markTableAvailable(tableId, currentUser?.full_name || 'Staff');
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast({ type: 'error', title: 'Cannot Mark Available', message: msg });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-28">
      {/* Top Header & Navigation */}
      <StaffNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pendingApprovalsCount={pendingDiningApprovals.length}
        activeOrdersCount={activeDiningOrders.length}
      />

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-brand-border shadow-card-subtle">
          <p className="text-[10px] font-heading font-bold text-brand-muted uppercase">Occupied Tables</p>
          <p className="font-heading font-black text-2xl text-amber-900 mt-1">
            {metrics.occupiedTables} / {metrics.totalTables}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-brand-border shadow-card-subtle">
          <p className="text-[10px] font-heading font-bold text-brand-muted uppercase">Available Tables</p>
          <p className="font-heading font-black text-2xl text-emerald-900 mt-1">
            {metrics.availableTables}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-brand-border shadow-card-subtle">
          <p className="text-[10px] font-heading font-bold text-brand-muted uppercase">Needs Cleaning</p>
          <p className="font-heading font-black text-2xl text-sky-900 mt-1">
            {metrics.cleaningTables}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-brand-border shadow-card-subtle">
          <p className="text-[10px] font-heading font-bold text-brand-muted uppercase">Awaiting Approval</p>
          <p className="font-heading font-black text-2xl text-amber-500 mt-1 animate-pulse">
            {pendingDiningApprovals.length}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-brand-border shadow-card-subtle">
          <p className="text-[10px] font-heading font-bold text-brand-muted uppercase">Ready to Serve</p>
          <p className="font-heading font-black text-2xl text-purple-900 mt-1">
            {metrics.readyForServiceCount}
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-brand-border shadow-card-subtle">
          <p className="text-[10px] font-heading font-bold text-brand-muted uppercase">Unpaid Tabs</p>
          <p className="font-heading font-black text-2xl text-brand-black mt-1">
            {metrics.unpaidBillsCount}
          </p>
        </div>
      </div>

      {/* TAB 1: TABLE & FLOOR MAP */}
      {activeTab === 'tables' && (
        <div className="space-y-6">
          {/* Floor Controls & Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-brand-border shadow-card-subtle">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
              <span className="text-xs font-bold text-brand-muted flex items-center gap-1 shrink-0">
                <Filter className="w-3.5 h-3.5" /> Status:
              </span>
              {(['all', 'available', 'occupied', 'cleaning', 'reserved'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setTableStatusFilter(st)}
                  className={`px-3 py-1 rounded-xl text-xs font-heading font-bold transition-colors capitalize ${
                    tableStatusFilter === st
                      ? 'bg-brand-black text-brand-yellow'
                      : 'bg-brand-warm-white text-brand-charcoal hover:bg-brand-border'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {sections.length > 0 && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-brand-muted">Section:</span>
                <select
                  value={tableSectionFilter}
                  onChange={(e) => setTableSectionFilter(e.target.value)}
                  className="text-xs p-1.5 rounded-xl border border-brand-border bg-brand-warm-white font-medium"
                >
                  <option value="all">All Sections</option>
                  {sections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tables Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTables.map((table) => (
              <TableCard
                key={table.id}
                table={table}
                onSelectTable={(t) => setSelectedTableForDrawer(t)}
                onOpenOrderModal={(t) => {
                  setSelectedTableForOrder(t);
                  setExistingOrderToAppend(tableOrderMap.get(t.id) || null);
                }}
                onMarkCleaning={handleMarkCleaning}
                onMarkAvailable={handleMarkAvailable}
              />
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: INCOMING DINING ORDER APPROVALS */}
      {activeTab === 'approvals' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <div>
              <h2 className="font-heading font-black text-xl text-brand-black">
                Customer Dining Orders Awaiting Approval
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Incoming orders placed by customers at dining tables must be acknowledged by floor crew before being sent to the kitchen.
              </p>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
              {pendingDiningApprovals.length} Pending
            </span>
          </div>

          {pendingDiningApprovals.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-brand-border p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-base text-brand-black">
                All Dining Orders Approved
              </h3>
              <p className="text-xs text-brand-muted max-w-sm mx-auto">
                No orders are currently waiting in the approval queue. New online dining orders will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingDiningApprovals.map((order) => (
                <DiningOrderApprovalCard
                  key={order.id}
                  order={order}
                  onAccept={handleApproveOrder}
                  onReject={(o) => setOrderToReject(o)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE ORDERS & SERVICE */}
      {activeTab === 'active_orders' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <div>
              <h2 className="font-heading font-black text-xl text-brand-black">
                Active Dining Orders & Floor Service
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Monitor kitchen preparation progress, item-level readiness, and mark ready tickets as served.
              </p>
            </div>
            <span className="font-mono text-xs font-bold px-3 py-1 rounded-full bg-brand-black text-brand-yellow">
              {activeDiningOrders.length} Active Tickets
            </span>
          </div>

          {activeDiningOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-brand-border p-12 text-center space-y-2">
              <UtensilsCrossed className="w-8 h-8 text-brand-muted mx-auto opacity-40" />
              <p className="text-xs text-brand-muted">No active dining orders currently in progress.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeDiningOrders.map((order) => {
                const isReadyForService = order.order_status === 'READY_FOR_SERVICE';
                const isServed = order.order_status === 'SERVED';
                return (
                  <div
                    key={order.id}
                    className={`p-5 rounded-3xl border bg-white shadow-card-subtle flex flex-col justify-between space-y-4 ${
                      isReadyForService
                        ? 'border-purple-300 ring-2 ring-purple-300/40'
                        : 'border-brand-border'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-heading font-black text-lg text-brand-black">
                          Table {order.table_number_snapshot || 'Dining'}
                        </span>
                        <span
                          className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isReadyForService
                              ? 'bg-purple-100 text-purple-900 border border-purple-300 animate-pulse'
                              : isServed
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {order.order_status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-brand-muted pb-2 border-b border-brand-border/60">
                        <span className="font-mono">{order.order_number}</span>
                        <span>{order.customer_name_snapshot}</span>
                      </div>

                      {/* Items status preview */}
                      <div className="divide-y divide-brand-border/40 max-h-36 overflow-y-auto pr-1 mt-2">
                        {order.items?.map((it) => (
                          <div
                            key={it.id}
                            className="py-1.5 text-xs flex items-center justify-between gap-2"
                          >
                            <span className="font-medium text-brand-black truncate">
                              {it.quantity}× {it.item_name_snapshot}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                                (it.item_status || it.status) === 'READY'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : (it.item_status || it.status) === 'PREPARING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : (it.item_status || it.status) === 'SERVED'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-zinc-100 text-zinc-700'
                              }`}
                            >
                              {it.item_status || it.status || 'QUEUED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-brand-border/60 flex items-center gap-2">
                      {isReadyForService && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => handleMarkServed(order.id)}
                          leftIcon={<Sparkles className="w-3.5 h-3.5" />}
                        >
                          Mark Served to Table
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedOrderForBill(order)}
                        leftIcon={<Receipt className="w-3.5 h-3.5" />}
                      >
                        Bill / Split (₹{order.total_amount.toFixed(2)})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrderForReceipt(order)}
                        leftIcon={<Printer className="w-3.5 h-3.5" />}
                      >
                        Print Receipt
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: BILLING & SPLIT BILLS */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-brand-border pb-3">
            <div>
              <h2 className="font-heading font-black text-xl text-brand-black">
                Dining Billing & Split Settlements
              </h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Generate split bills, handle equal splits, item assignments, or custom amount settlements.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders
              .filter((o) => o.order_type === 'DINING')
              .map((order) => (
                <div
                  key={order.id}
                  className="p-5 rounded-3xl border border-brand-border bg-white shadow-card-subtle flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-heading font-black text-lg text-brand-black">
                        Table {order.table_number_snapshot || 'Dining'}
                      </span>
                      <span
                        className={`text-[10px] font-heading font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          order.payment_status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {order.payment_status}
                      </span>
                    </div>

                    <p className="text-xs text-brand-muted">
                      Order #{order.order_number} • {order.customer_name_snapshot}
                    </p>

                    <div className="pt-3 border-t border-brand-border/60 mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs text-brand-muted">
                        <span>Total Payable:</span>
                        <span className="font-mono font-bold text-brand-black">
                          ₹{order.total_amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-brand-muted">
                        <span>Remaining Balance:</span>
                        <span
                          className={`font-mono font-bold ${
                            order.payment_status === 'PAID' ? 'text-emerald-700' : 'text-amber-800'
                          }`}
                        >
                          ₹{(order.outstanding_balance ?? (order.payment_status === 'PAID' ? 0 : order.total_amount)).toFixed(2)}
                        </span>
                      </div>
                      {order.is_split_bill && (
                        <p className="text-[11px] font-bold text-purple-700 pt-1">
                          ● Configured with {order.split_count || 2} split shares
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedOrderForBill(order)}
                      leftIcon={<Receipt className="w-3.5 h-3.5" />}
                    >
                      Split Bill
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => setOrderForReceipt(order)}
                      leftIcon={<Printer className="w-3.5 h-3.5" />}
                    >
                      Print Receipt
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Drawer: Table Detail Management */}
      <TableDetailDrawer
        table={selectedTableForDrawer}
        activeOrder={selectedTableForDrawer ? tableOrderMap.get(selectedTableForDrawer.id) : null}
        isOpen={Boolean(selectedTableForDrawer)}
        onClose={() => setSelectedTableForDrawer(null)}
        onOpenOrderModal={(t) => {
          setSelectedTableForDrawer(null);
          setSelectedTableForOrder(t);
          setExistingOrderToAppend(tableOrderMap.get(t.id) || null);
        }}
        onOpenBillModal={(o) => {
          setSelectedTableForDrawer(null);
          setSelectedOrderForBill(o);
        }}
        onTableUpdated={() => {
          loadData();
          setSelectedTableForDrawer(null);
        }}
        crewUsers={availableDemoUsers}
      />

      {/* Modal: Waiter Order Creation */}
      <WaiterOrderModal
        table={selectedTableForOrder}
        existingOrder={existingOrderToAppend}
        isOpen={Boolean(selectedTableForOrder)}
        onClose={() => {
          setSelectedTableForOrder(null);
          setExistingOrderToAppend(null);
        }}
        menuItems={menuItems}
        categories={categories}
        onOrderCreated={() => {
          loadData();
          setSelectedTableForOrder(null);
          setExistingOrderToAppend(null);
        }}
      />

      {/* Modal: Dining Order Rejection Reason */}
      <RejectionReasonModal
        order={orderToReject}
        isOpen={Boolean(orderToReject)}
        onClose={() => setOrderToReject(null)}
        onConfirmReject={handleConfirmReject}
      />

      {/* Modal: Bill Splitting & Settlements */}
      <BillSplittingModal
        order={selectedOrderForBill}
        isOpen={Boolean(selectedOrderForBill)}
        onClose={() => setSelectedOrderForBill(null)}
        onOrderUpdated={() => {
          loadData();
        }}
      />

      {/* Modal: Cashier Bill Receipt & Printing */}
      <CashierReceiptModal
        order={orderForReceipt}
        isOpen={Boolean(orderForReceipt)}
        onClose={() => setOrderForReceipt(null)}
      />
    </div>
  );
};
