import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AdminNav } from '../../components/admin/AdminNav';
import {
  fetchOrders,
  fetchAdminCustomers,
  fetchCafeSettings,
  updateCafeSettings,
  fetchAdminActivityLogs,
  recordAdminAction,
} from '../../lib/supabase';
import { useRealtimeOperationalSync } from '../../lib/realtime';
import { Order, Customer, CafeSettings, AdminActivityLog } from '../../types';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  ArrowRight,
  Flame,
  Calendar,
  AlertTriangle,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  Tag,
  QrCode,
  Activity,
  Filter,
  RefreshCw,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([]);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'all'>('today');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<string>('ALL');
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const loadData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const [allOrders, allCustomers, cafeSettings, logs] = await Promise.all([
        fetchOrders(),
        fetchAdminCustomers(),
        fetchCafeSettings(),
        fetchAdminActivityLogs(),
      ]);
      setOrders(allOrders);
      setCustomers(allCustomers);
      setSettings(cafeSettings);
      setActivityLogs(logs);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // 1. Periodic background refresh every 10 seconds to sync authoritative state across devices
    const interval = setInterval(() => {
      loadData();
    }, 10000);

    // 2. Refresh immediately when window/tab regains focus or visibility (e.g. switching back on mobile)
    const handleFocus = () => {
      loadData();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadData]);

  // 3. Operational Realtime Synchronization: trigger data refresh on any incoming business event
  useRealtimeOperationalSync(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Filter orders by time window
  const filteredOrders = useMemo(() => {
    if (timeFilter === 'all') return orders;
    const now = new Date();
    return orders.filter((o) => {
      const orderDate = new Date(o.created_at);
      if (timeFilter === 'today') {
        return (
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }
      // 'week' (last 7 days)
      const diffMs = now.getTime() - orderDate.getTime();
      return diffMs <= 7 * 24 * 60 * 60 * 1000;
    });
  }, [orders, timeFilter]);

  // Aggregate Metrics (Honest Financial Accounting)
  const metrics = useMemo(() => {
    // Settled Revenue = ONLY orders that have been paid and not cancelled/rejected
    const settledOrders = filteredOrders.filter(
      (o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    );

    const totalRevenue = settledOrders.reduce((acc, o) => acc + o.total_amount, 0);

    const validOrders = filteredOrders.filter(
      (o) => o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    );

    const pendingCount = filteredOrders.filter((o) => o.status === 'PENDING').length;
    const completedCount = filteredOrders.filter((o) => o.status === 'COMPLETED').length;
    const cancelledCount = filteredOrders.filter(
      (o) => o.status === 'CANCELLED' || o.status === 'REJECTED'
    ).length;

    const paidOrders = settledOrders;
    const aov = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

    // Best seller item
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const o of validOrders) {
      for (const it of o.items || []) {
        if (!itemSales[it.item_name_snapshot]) {
          itemSales[it.item_name_snapshot] = {
            name: it.item_name_snapshot,
            quantity: 0,
            revenue: 0,
          };
        }
        itemSales[it.item_name_snapshot].quantity += it.quantity;
        itemSales[it.item_name_snapshot].revenue += it.total_price;
      }
    }

    const sortedItems = Object.values(itemSales).sort((a, b) => b.quantity - a.quantity);
    const mostOrderedItem = sortedItems.length > 0 ? sortedItems[0] : null;

    return {
      totalRevenue,
      totalOrders: filteredOrders.length,
      pendingCount,
      completedCount,
      cancelledCount,
      aov,
      totalCustomers: customers.length,
      mostOrderedItem,
      bestSellers: sortedItems.slice(0, 5),
    };
  }, [filteredOrders, customers]);

  // Quick Action: Pause / Resume Online Ordering
  const handleToggleOnlineOrdering = async () => {
    if (!settings) return;
    setIsTogglingPause(true);
    const nextPaused = !settings.is_online_ordering_paused;
    const updatedSettings: CafeSettings = {
      ...settings,
      is_online_ordering_paused: nextPaused,
    };

    try {
      await updateCafeSettings(updatedSettings);
      setSettings(updatedSettings);
      await recordAdminAction({
        actor: 'Administrator',
        action: nextPaused ? 'Paused online ordering' : 'Resumed online ordering',
        category: 'ORDERS',
        details: nextPaused
          ? 'Online ordering paused from quick action banner.'
          : 'Online ordering resumed from quick action banner.',
      });
      const updatedLogs = await fetchAdminActivityLogs();
      setActivityLogs(updatedLogs);

      showToast({
        type: nextPaused ? 'warning' : 'success',
        title: nextPaused ? 'Ordering Paused' : 'Ordering Resumed',
        message: nextPaused
          ? 'Online checkout is now paused for customers.'
          : 'Online checkout is now open for new orders.',
      });
    } catch (err) {
      console.error('Failed to toggle ordering pause:', err);
      showToast({
        type: 'error',
        title: 'Action Failed',
        message: 'Could not update operational status.',
      });
    } finally {
      setIsTogglingPause(false);
    }
  };

  // Filtered activity logs
  const filteredActivityLogs = useMemo(() => {
    if (activityCategoryFilter === 'ALL') return activityLogs.slice(0, 12);
    return activityLogs
      .filter((l) => l.category === activityCategoryFilter)
      .slice(0, 12);
  }, [activityLogs, activityCategoryFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      <AdminNav
        title="Admin Command Centre"
        subtitle="Real-time pulse, honest sales metrics, ordering controls, and audit feed."
      />

      {/* Operational Emergency Alert / Quick Pause Banner */}
      {settings && (
        <div
          className={`p-4 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
            settings.is_online_ordering_paused
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-900'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold ${
                settings.is_online_ordering_paused
                  ? 'bg-amber-500 text-white'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {settings.is_online_ordering_paused ? (
                <PauseCircle className="w-6 h-6" />
              ) : (
                <PlayCircle className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading font-black text-sm uppercase tracking-wider">
                  Online Ordering Status:
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    settings.is_online_ordering_paused
                      ? 'bg-amber-200 text-amber-900'
                      : 'bg-emerald-200 text-emerald-900'
                  }`}
                >
                  {settings.is_online_ordering_paused ? 'PAUSED' : 'ACTIVE & ACCEPTING ORDERS'}
                </span>
              </div>
              <p className="text-xs text-brand-muted mt-0.5">
                {settings.is_online_ordering_paused
                  ? 'Customers see an announcement banner; checkout and cart submissions are currently disabled.'
                  : 'Customers can seamlessly browse the menu, customize orders, and place dining or takeaway tickets.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={settings.is_online_ordering_paused ? 'primary' : 'outline'}
              size="sm"
              isLoading={isTogglingPause}
              onClick={handleToggleOnlineOrdering}
              leftIcon={
                settings.is_online_ordering_paused ? (
                  <PlayCircle className="w-4 h-4" />
                ) : (
                  <PauseCircle className="w-4 h-4" />
                )
              }
            >
              {settings.is_online_ordering_paused ? 'Resume Ordering' : 'Pause Ordering'}
            </Button>
          </div>
        </div>
      )}

      {/* Time Filter Controls & Quick Action Shortcuts */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Time Filter Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-brand-border rounded-2xl w-fit shadow-xs">
          <button
            type="button"
            onClick={() => setTimeFilter('today')}
            className={`px-4 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              timeFilter === 'today'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('week')}
            className={`px-4 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              timeFilter === 'week'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            Past 7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeFilter('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              timeFilter === 'all'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            All Time
          </button>
          <span className="text-xs text-brand-muted px-2 flex items-center gap-1 border-l border-brand-border">
            <Calendar className="w-3.5 h-3.5" />
            {filteredOrders.length} orders
          </span>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing || isLoading}
            className="p-1.5 rounded-lg text-brand-muted hover:text-brand-black hover:bg-brand-soft-yellow/50 transition-all border border-transparent hover:border-brand-border"
            title="Synchronize authoritative data from Supabase across all devices"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-black' : ''}`} />
          </button>
        </div>

        {/* Quick Actions Shortcuts */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/menu')}
            leftIcon={<PlusCircle className="w-3.5 h-3.5 text-brand-yellow" />}
          >
            Add Menu Item
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/promotions')}
            leftIcon={<Tag className="w-3.5 h-3.5 text-brand-yellow" />}
          >
            Create Promotion
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/qr')}
            leftIcon={<QrCode className="w-3.5 h-3.5 text-brand-yellow" />}
          >
            Print QR Standee
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid (Exact 8 Requirements) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Revenue */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>{timeFilter === 'today' ? "Today's Revenue" : 'Revenue'}</span>
            <DollarSign className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            ₹{metrics.totalRevenue.toFixed(2)}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Honest total (paid & valid orders)
          </p>
        </div>

        {/* 2. Today's Orders Count */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>{timeFilter === 'today' ? "Today's Orders" : 'Total Orders'}</span>
            <Clock className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {metrics.totalOrders}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            Placed tickets in active window
          </p>
        </div>

        {/* 3. Completed Orders Count */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Completed Orders</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black text-emerald-700">
            {metrics.completedCount}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            Fulfilled & dispatched successfully
          </p>
        </div>

        {/* 4. Pending Orders Count */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Pending Orders</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black text-amber-700">
            {metrics.pendingCount}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            Awaiting cashier/manager acceptance
          </p>
        </div>

        {/* 5. Cancelled Orders Count */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Cancelled Orders</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black text-red-700">
            {metrics.cancelledCount}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            Rejected or customer-cancelled
          </p>
        </div>

        {/* 6. Average Order Value (AOV) */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Average Order Value</span>
            <TrendingUp className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            ₹{metrics.aov.toFixed(2)}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            Calculated across paid receipts
          </p>
        </div>

        {/* 7. Total Customers Count */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Registered Customers</span>
            <Users className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {metrics.totalCustomers}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            Real guest profiles registered
          </p>
        </div>

        {/* 8. Most Ordered Menu Item */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Top Ordered Dish</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <p className="font-heading font-black text-base text-brand-black truncate">
            {metrics.mostOrderedItem ? metrics.mostOrderedItem.name : 'No items ordered yet'}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            {metrics.mostOrderedItem
              ? `${metrics.mostOrderedItem.quantity} portions ordered (₹${metrics.mostOrderedItem.revenue.toFixed(0)})`
              : 'Waiting for orders'}
          </p>
        </div>
      </div>

      {/* Middle Section: Top Dishes & Live Queue Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Top Selling Items */}
        <div className="lg:col-span-5 p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Top Shawarma & Grills</span>
            </h3>
            <span className="text-xs text-brand-muted">By units ordered</span>
          </div>

          {metrics.bestSellers.length === 0 ? (
            <div className="p-8 text-center text-xs text-brand-muted">
              No sales records in selected date range.
            </div>
          ) : (
            <div className="space-y-3">
              {metrics.bestSellers.map((item, idx) => (
                <div
                  key={item.name}
                  className="p-3.5 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-black text-brand-yellow flex items-center justify-center font-bold text-[11px]">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-heading font-bold text-brand-black">{item.name}</p>
                      <p className="text-[11px] text-brand-muted">{item.quantity} portions served</p>
                    </div>
                  </div>
                  <span className="font-heading font-bold text-brand-black">
                    ₹{item.revenue.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Recent Orders Queue */}
        <div className="lg:col-span-7 p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-black" />
              <span>Recent Orders Queue</span>
            </h3>
            <Link
              to="/admin/orders"
              className="text-xs font-bold text-brand-black underline flex items-center gap-1 hover:text-amber-900"
            >
              <span>Manage All ({orders.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-brand-muted">No orders available.</div>
          ) : (
            <div className="divide-y divide-brand-border space-y-2">
              {filteredOrders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-brand-black">
                        #{order.order_number}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          order.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : order.status === 'ACCEPTED'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'PREPARING'
                            ? 'bg-purple-100 text-purple-800'
                            : order.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      {order.customer_name_snapshot} • {order.order_type === 'DINING' ? `Table ${order.table_number_snapshot || 'Assigned'}` : 'Takeaway'} • {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="font-heading font-bold text-brand-black block">
                      ₹{order.total_amount.toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        order.payment_status === 'PAID' ? 'text-emerald-600' : 'text-amber-800'
                      }`}
                    >
                      {order.payment_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Feed: Recent Administrative Operations */}
      <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-brand-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-brand-yellow/20 flex items-center justify-center text-brand-black">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-brand-black">
                Recent Operations & Audit Feed
              </h3>
              <p className="text-xs text-brand-muted">
                Last operations recorded in the command center.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-brand-muted" />
            {['ALL', 'MENU', 'ORDERS', 'BILLING', 'STAFF', 'TABLES'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActivityCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all ${
                  activityCategoryFilter === cat
                    ? 'bg-brand-black text-brand-yellow'
                    : 'bg-brand-warm-white text-brand-muted hover:text-brand-black border border-brand-border'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredActivityLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-brand-muted">
            No activity logged in this category.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredActivityLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-brand-warm-white border border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      log.category === 'MENU'
                        ? 'bg-amber-100 text-amber-800'
                        : log.category === 'ORDERS'
                        ? 'bg-blue-100 text-blue-800'
                        : log.category === 'BILLING'
                        ? 'bg-purple-100 text-purple-800'
                        : log.category === 'STAFF'
                        ? 'bg-emerald-100 text-emerald-800'
                        : log.category === 'TABLES'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {log.category}
                  </span>
                  <div>
                    <p className="font-heading font-bold text-brand-black">{log.action}</p>
                    {log.details && (
                      <p className="text-[11px] text-brand-muted mt-0.5">{log.details}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-brand-muted self-end sm:self-center">
                  <span className="font-medium text-brand-black">{log.actor}</span>
                  <span>•</span>
                  <span>{new Date(log.timestamp).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 text-center">
          <Link
            to="/admin/activity"
            className="text-xs font-bold text-brand-black underline hover:text-amber-900 inline-flex items-center gap-1"
          >
            <span>View Full Audit Log History</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};
