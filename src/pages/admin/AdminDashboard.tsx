import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchOrders } from '../../lib/supabase';
import { Order } from '../../types';
import { Button } from '../../components/common/Button';
import {
  DollarSign,
  TrendingUp,
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  ArrowRight,
  Flame,
  Calendar,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'all'>('today');

  useEffect(() => {
    fetchOrders().then(setOrders);
  }, []);

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

  // Aggregate Metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((acc, o) => {
      if (o.status !== 'CANCELLED' && o.status !== 'REJECTED') {
        return acc + o.total_amount;
      }
      return acc;
    }, 0);

    const pendingCount = filteredOrders.filter((o) => o.status === 'PENDING').length;
    const preparingCount = filteredOrders.filter((o) => o.status === 'PREPARING' || o.status === 'ACCEPTED').length;
    const completedCount = filteredOrders.filter((o) => o.status === 'COMPLETED').length;

    const diningCount = filteredOrders.filter((o) => o.order_type === 'DINING').length;
    const takeawayCount = filteredOrders.filter((o) => o.order_type === 'TAKEAWAY').length;

    const paidCount = filteredOrders.filter((o) => o.payment_status === 'PAID').length;
    const unpaidCount = filteredOrders.filter((o) => o.payment_status === 'UNPAID').length;

    // Best sellers
    const itemSales: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const o of filteredOrders) {
      if (o.status === 'CANCELLED' || o.status === 'REJECTED') continue;
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

    const bestSellers = Object.values(itemSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalRevenue,
      totalOrders: filteredOrders.length,
      pendingCount,
      preparingCount,
      completedCount,
      diningCount,
      takeawayCount,
      paidCount,
      unpaidCount,
      bestSellers,
    };
  }, [filteredOrders]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      <AdminNav
        title="Admin Dashboard"
        subtitle="Live sales metrics, order pipeline, and catalog oversight."
      />

      {/* Time Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-white border border-brand-border rounded-2xl w-fit">
          <button
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
            onClick={() => setTimeFilter('all')}
            className={`px-4 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              timeFilter === 'all'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            All Time
          </button>
        </div>

        <span className="text-xs text-brand-muted flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-brand-black" />
          Showing {filteredOrders.length} orders ({timeFilter})
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Total Revenue</span>
            <DollarSign className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            ₹{metrics.totalRevenue.toFixed(2)}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Excludes cancelled/rejected orders
          </p>
        </div>

        {/* Total Orders */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Total Orders</span>
            <Clock className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {metrics.totalOrders}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            {metrics.completedCount} completed • {metrics.pendingCount} pending
          </p>
        </div>

        {/* Dine-In vs Takeaway */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Mode Breakdown</span>
            <UtensilsCrossed className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {metrics.diningCount} <span className="text-sm font-normal text-brand-muted">Dining</span> / {metrics.takeawayCount} <span className="text-sm font-normal text-brand-muted">Takeaway</span>
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            Isolated carts & workflows
          </p>
        </div>

        {/* Payment Health */}
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Payment Settlement</span>
            <CheckCircle2 className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {metrics.paidCount} <span className="text-sm font-normal text-emerald-600">Paid</span> / {metrics.unpaidCount} <span className="text-sm font-normal text-amber-600">Unpaid</span>
          </p>
          <p className="text-[11px] text-brand-muted font-medium">
            UPI/Card Demo & Counter Cash
          </p>
        </div>
      </div>

      {/* Middle Section: Best Sellers & Active Orders Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Top Selling Items */}
        <div className="lg:col-span-5 p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <span>Top Selling Dishes</span>
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
              <span>Recent Orders</span>
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
                        className={`text-[10px] uppercase font-bold px-2 py-0.2 rounded-full ${
                          order.status === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : order.status === 'ACCEPTED'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'PREPARING'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
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

      {/* Quick Access Administrative Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black font-bold">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-lg text-brand-black">
              Menu & Catalog Management
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed font-sans">
              Create and edit categories and dishes, adjust prices, toggle veg/non-veg, upload food photos, and manage item availability.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/admin/menu')}>
            Open Menu Editor
          </Button>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-lg text-brand-black">
              Live Orders & Lifecycle Queue
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed font-sans">
              Accept or reject incoming orders with reasons, dispatch to kitchen, monitor stage transitions, and collect counter payments.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/orders')}>
            View All Orders
          </Button>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-lg text-brand-black">
              GST Rates & Cafe Settings
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed font-sans">
              Configure centralized GST %, CGST/SGST split, takeaway pickup slots, order pause switches, and official self-pickup notices.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/settings')}>
            Configure Settings
          </Button>
        </div>
      </div>
    </div>
  );
};
