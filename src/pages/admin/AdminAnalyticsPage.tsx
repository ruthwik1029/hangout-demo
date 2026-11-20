import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchOrders } from '../../lib/supabase';
import { useRealtimeOperationalSync } from '../../lib/realtime';
import { Order } from '../../types';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  UtensilsCrossed,
  Calendar,
  CreditCard,
  Smartphone,
  Banknote,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const AdminAnalyticsPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateFilter, setDateFilter] = useState<'today' | '7days' | '30days' | 'this_month' | 'all'>('7days');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (err) {
      console.error('Failed to load analytics orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();

    const interval = setInterval(() => {
      loadOrders();
    }, 10000);

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

  // Filter orders based on selected period
  const filteredOrders = useMemo(() => {
    const now = new Date();
    return orders.filter((o) => {
      const orderDate = new Date(o.created_at);

      if (isCustomDate && customStart) {
        const start = new Date(customStart);
        const end = customEnd ? new Date(customEnd + 'T23:59:59') : now;
        return orderDate >= start && orderDate <= end;
      }

      if (dateFilter === 'today') {
        return (
          orderDate.getDate() === now.getDate() &&
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }

      if (dateFilter === '7days') {
        const diffMs = now.getTime() - orderDate.getTime();
        return diffMs <= 7 * 24 * 60 * 60 * 1000;
      }

      if (dateFilter === '30days') {
        const diffMs = now.getTime() - orderDate.getTime();
        return diffMs <= 30 * 24 * 60 * 60 * 1000;
      }

      if (dateFilter === 'this_month') {
        return (
          orderDate.getMonth() === now.getMonth() &&
          orderDate.getFullYear() === now.getFullYear()
        );
      }

      return true; // 'all'
    });
  }, [orders, dateFilter, isCustomDate, customStart, customEnd]);

  // Aggregate Metrics (Honest: verified completed payments only)
  const metrics = useMemo(() => {
    const settledOrders = filteredOrders.filter(
      (o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    );

    const totalRevenue = settledOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    const totalTaxCollected = settledOrders.reduce((sum, o) => sum + (o.tax_amount || 0), 0);
    const totalOrdersCount = filteredOrders.length;
    const completedCount = filteredOrders.filter((o) => o.status === 'COMPLETED').length;
    const cancelledCount = filteredOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED').length;
    const avgOrderValue = settledOrders.length > 0 ? totalRevenue / settledOrders.length : 0;

    // Payment method breakdown
    let upiRevenue = 0;
    let cardRevenue = 0;
    let cashRevenue = 0;
    let upiCount = 0;
    let cardCount = 0;
    let cashCount = 0;

    settledOrders.forEach((o) => {
      const method = (o.payment_method || '').toUpperCase();
      if (method.includes('UPI')) {
        upiRevenue += o.total_amount;
        upiCount++;
      } else if (method.includes('CARD')) {
        cardRevenue += o.total_amount;
        cardCount++;
      } else {
        cashRevenue += o.total_amount;
        cashCount++;
      }
    });

    // Order type breakdown
    const diningCount = filteredOrders.filter((o) => o.order_type === 'DINING').length;
    const takeawayCount = filteredOrders.filter((o) => o.order_type === 'TAKEAWAY').length;

    // Best sellers
    const itemMap: Record<string, { name: string; quantity: number; revenue: number }> = {};
    settledOrders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const key = it.item_name_snapshot;
        if (!itemMap[key]) {
          itemMap[key] = { name: key, quantity: 0, revenue: 0 };
        }
        itemMap[key].quantity += it.quantity;
        itemMap[key].revenue += it.total_price;
      });
    });

    const topSellingItems = Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 6);

    // Peak Hours Breakdown (12 PM - 12 AM)
    const hourDistribution: number[] = new Array(12).fill(0); // Index 0 = 12 PM, index 11 = 11 PM
    filteredOrders.forEach((o) => {
      const hour = new Date(o.created_at).getHours();
      if (hour >= 12 && hour < 24) {
        hourDistribution[hour - 12]++;
      }
    });

    return {
      totalRevenue,
      totalTaxCollected,
      totalOrdersCount,
      completedCount,
      cancelledCount,
      avgOrderValue,
      upiRevenue,
      cardRevenue,
      cashRevenue,
      upiCount,
      cardCount,
      cashCount,
      diningCount,
      takeawayCount,
      topSellingItems,
      hourDistribution,
      settledOrdersCount: settledOrders.length,
    };
  }, [filteredOrders]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Navigation Header */}
      <AdminNav
        title="Revenue & Performance Analytics"
        subtitle="Visual command analytics across sales, payment methods, order channels, and peak kitchen hours."
      />

      {/* Date Filter & Time Scope Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-brand-border shadow-card-subtle">
        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={() => {
              setIsCustomDate(false);
              setDateFilter('today');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              !isCustomDate && dateFilter === 'today'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black bg-brand-warm-white'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => {
              setIsCustomDate(false);
              setDateFilter('7days');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              !isCustomDate && dateFilter === '7days'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black bg-brand-warm-white'
            }`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              setIsCustomDate(false);
              setDateFilter('30days');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              !isCustomDate && dateFilter === '30days'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black bg-brand-warm-white'
            }`}
          >
            Last 30 Days
          </button>
          <button
            onClick={() => {
              setIsCustomDate(false);
              setDateFilter('this_month');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              !isCustomDate && dateFilter === 'this_month'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black bg-brand-warm-white'
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => {
              setIsCustomDate(false);
              setDateFilter('all');
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              !isCustomDate && dateFilter === 'all'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black bg-brand-warm-white'
            }`}
          >
            All Time
          </button>
          <button
            onClick={() => setIsCustomDate(!isCustomDate)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              isCustomDate
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black bg-brand-warm-white'
            }`}
          >
            Custom Range
          </button>
        </div>

        {isCustomDate && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-brand-border bg-brand-warm-white text-brand-black"
            />
            <span className="text-brand-muted">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-brand-border bg-brand-warm-white text-brand-black"
            />
          </div>
        )}

        <div className="text-xs text-brand-muted flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-black" />
          <span>Analyzing {filteredOrders.length} records</span>
        </div>
      </div>

      {/* Honest Accounting Banner */}
      <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-950">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            <strong>Authoritative Accounting:</strong> Revenue includes completed payments only. Pending, unpaid, and cancelled orders are excluded from financial totals.
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
          SIMULATED REVENUE
        </span>
      </div>

      {/* KPI Cards Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Settled Revenue */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Settled Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-2xl text-brand-black">
            ₹{metrics.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-brand-muted">
            From {metrics.settledOrdersCount} settled transactions
          </p>
        </div>

        {/* Total Orders & Completed */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Total Orders</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-2xl text-brand-black">
            {metrics.totalOrdersCount}
          </div>
          <p className="text-[11px] text-brand-muted">
            {metrics.completedCount} completed • {metrics.cancelledCount} cancelled
          </p>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted">
            <span className="text-xs font-bold uppercase tracking-wider">Average Order Value</span>
            <div className="w-8 h-8 rounded-xl bg-brand-yellow/20 text-brand-black flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-2xl text-brand-black">
            ₹{metrics.avgOrderValue.toFixed(2)}
          </div>
          <p className="text-[11px] text-brand-muted">
            Per completed checkout
          </p>
        </div>

        {/* GST Tax Collected */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted">
            <span className="text-xs font-bold uppercase tracking-wider">GST Tax Recorded</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-heading font-black text-2xl text-brand-black">
            ₹{metrics.totalTaxCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-brand-muted">
            5.0% centralized GST breakdown
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">Loading Analytics...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-brand-border space-y-3">
          <AlertCircle className="w-12 h-12 text-brand-muted mx-auto" />
          <h3 className="font-heading font-bold text-lg text-brand-black">No Order Data in Selected Period</h3>
          <p className="text-xs text-brand-muted max-w-md mx-auto">
            There are no customer orders recorded within this date window. Switch to "All Time" to review historic demo activity.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. Payment Methods Breakdown Chart */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-base text-brand-black">Payment Method Share</h3>
                <p className="text-xs text-brand-muted">Settlement volume by payment channel</p>
              </div>
              <CreditCard className="w-5 h-5 text-brand-muted" />
            </div>

            {metrics.totalRevenue === 0 ? (
              <p className="text-xs text-brand-muted py-8 text-center">No paid transactions in this window.</p>
            ) : (
              <div className="space-y-4">
                {/* Horizontal Segmented Bar */}
                <div className="h-6 rounded-full overflow-hidden flex bg-gray-100 p-0.5">
                  {metrics.upiRevenue > 0 && (
                    <div
                      style={{ width: `${(metrics.upiRevenue / metrics.totalRevenue) * 100}%` }}
                      className="bg-emerald-500 rounded-l-full h-full transition-all"
                      title={`UPI: ₹${metrics.upiRevenue.toFixed(2)}`}
                    />
                  )}
                  {metrics.cardRevenue > 0 && (
                    <div
                      style={{ width: `${(metrics.cardRevenue / metrics.totalRevenue) * 100}%` }}
                      className="bg-brand-yellow h-full transition-all"
                      title={`Card: ₹${metrics.cardRevenue.toFixed(2)}`}
                    />
                  )}
                  {metrics.cashRevenue > 0 && (
                    <div
                      style={{ width: `${(metrics.cashRevenue / metrics.totalRevenue) * 100}%` }}
                      className="bg-brand-black rounded-r-full h-full transition-all"
                      title={`Cash: ₹${metrics.cashRevenue.toFixed(2)}`}
                    />
                  )}
                </div>

                {/* Legend & Details */}
                <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold mb-1">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>UPI Demo</span>
                    </div>
                    <div className="font-extrabold text-sm text-emerald-950">₹{metrics.upiRevenue.toFixed(0)}</div>
                    <span className="text-[10px] text-emerald-700">{metrics.upiCount} orders</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold mb-1">
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Card Demo</span>
                    </div>
                    <div className="font-extrabold text-sm text-amber-950">₹{metrics.cardRevenue.toFixed(0)}</div>
                    <span className="text-[10px] text-amber-700">{metrics.cardCount} orders</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-1.5 text-gray-800 font-bold mb-1">
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Cash</span>
                    </div>
                    <div className="font-extrabold text-sm text-gray-900">₹{metrics.cashRevenue.toFixed(0)}</div>
                    <span className="text-[10px] text-gray-600">{metrics.cashCount} orders</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Order Channel: Dining vs Takeaway */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-base text-brand-black">Order Channel Distribution</h3>
                <p className="text-xs text-brand-muted">Table Dine-In vs Counter Self-Pickup</p>
              </div>
              <UtensilsCrossed className="w-5 h-5 text-brand-muted" />
            </div>

            <div className="space-y-4">
              <div className="h-6 rounded-full overflow-hidden flex bg-gray-100 p-0.5">
                {metrics.diningCount > 0 && (
                  <div
                    style={{
                      width: `${(metrics.diningCount / Math.max(1, metrics.totalOrdersCount)) * 100}%`,
                    }}
                    className="bg-brand-black text-brand-yellow rounded-l-full h-full transition-all"
                  />
                )}
                {metrics.takeawayCount > 0 && (
                  <div
                    style={{
                      width: `${(metrics.takeawayCount / Math.max(1, metrics.totalOrdersCount)) * 100}%`,
                    }}
                    className="bg-brand-yellow rounded-r-full h-full transition-all"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border">
                  <div className="flex items-center gap-2 font-bold text-xs text-brand-black mb-1">
                    <UtensilsCrossed className="w-4 h-4 text-brand-yellow" />
                    <span>Dine-In Orders</span>
                  </div>
                  <div className="text-2xl font-black font-heading text-brand-black">{metrics.diningCount}</div>
                  <p className="text-[11px] text-brand-muted">
                    {metrics.totalOrdersCount > 0
                      ? `${Math.round((metrics.diningCount / metrics.totalOrdersCount) * 100)}% of total orders`
                      : '0%'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border">
                  <div className="flex items-center gap-2 font-bold text-xs text-brand-black mb-1">
                    <ShoppingBag className="w-4 h-4 text-brand-black" />
                    <span>Self-Pickup Orders</span>
                  </div>
                  <div className="text-2xl font-black font-heading text-brand-black">{metrics.takeawayCount}</div>
                  <p className="text-[11px] text-brand-muted">
                    {metrics.totalOrdersCount > 0
                      ? `${Math.round((metrics.takeawayCount / metrics.totalOrdersCount) * 100)}% of total orders`
                      : '0%'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Top Selling Shawarmas & Starters */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-base text-brand-black">Top Selling Products</h3>
                <p className="text-xs text-brand-muted">Ranked by actual quantity ordered and paid</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-brand-muted" />
            </div>

            {metrics.topSellingItems.length === 0 ? (
              <p className="text-xs text-brand-muted py-6 text-center">No product sales recorded in this period.</p>
            ) : (
              <div className="space-y-3">
                {metrics.topSellingItems.map((item, idx) => {
                  const maxQty = Math.max(...metrics.topSellingItems.map((i) => i.quantity), 1);
                  const barWidth = Math.round((item.quantity / maxQty) * 100);

                  return (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 font-bold text-brand-black">
                          <span className="w-5 h-5 rounded-full bg-brand-warm-white border border-brand-border text-center text-[11px] flex items-center justify-center font-black">
                            {idx + 1}
                          </span>
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-brand-muted">
                          <span>{item.quantity} orders</span>
                          <span className="font-bold text-brand-black">₹{item.revenue.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="h-2.5 rounded-full bg-brand-warm-white border border-brand-border overflow-hidden">
                        <div
                          style={{ width: `${barWidth}%` }}
                          className="h-full bg-brand-yellow rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Peak Ordering Periods (12 PM - 12 AM) */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-base text-brand-black">Peak Ordering Windows (12 PM – Midnight)</h3>
                <p className="text-xs text-brand-muted">Order frequency distribution by kitchen operating hours</p>
              </div>
              <Clock className="w-5 h-5 text-brand-muted" />
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 pt-2">
              {metrics.hourDistribution.map((count, idx) => {
                const hourDisplay = idx === 0 ? '12 PM' : idx < 12 ? `${idx} PM` : '12 AM';
                const maxHourOrders = Math.max(...metrics.hourDistribution, 1);
                const barHeight = count > 0 ? Math.max(15, Math.round((count / maxHourOrders) * 80)) : 6;

                return (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-brand-black">{count}</span>
                    <div className="w-full h-24 bg-brand-warm-white rounded-xl flex items-end justify-center p-1 border border-brand-border">
                      <div
                        style={{ height: `${barHeight}%` }}
                        className={`w-full rounded-lg transition-all duration-500 ${
                          count > 0 ? 'bg-brand-black' : 'bg-transparent'
                        }`}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-brand-muted uppercase whitespace-nowrap">
                      {hourDisplay}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
