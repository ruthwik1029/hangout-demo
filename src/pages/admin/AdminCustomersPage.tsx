import React, { useState, useEffect, useMemo } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchAdminCustomers, fetchCustomerOrders } from '../../lib/supabase';
import { Customer, Order } from '../../types';
import { Button } from '../../components/common/Button';
import { Drawer } from '../../components/common/Drawer';
import {
  Users,
  Search,
  DollarSign,
  Receipt,
  Eye,
} from 'lucide-react';

interface CustomerWithStats extends Customer {
  order_count?: number;
  total_spend?: number;
  last_order_at?: string;
}

export const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected customer for order history drawer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithStats | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    fetchAdminCustomers().then((data) => {
      setCustomers(data);
      setLoading(false);
    });
  }, []);

  const handleOpenCustomerOrders = async (cust: CustomerWithStats) => {
    setSelectedCustomer(cust);
    setIsDrawerOpen(true);
    setLoadingOrders(true);
    const ords = await fetchCustomerOrders(cust.id);
    setCustomerOrders(ords);
    setLoadingOrders(false);
  };

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.mobile_number.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  // Aggregate Metrics
  const totalSpendAll = customers.reduce((acc, c) => acc + (c.total_spend || 0), 0);
  const avgSpend = customers.length > 0 ? totalSpendAll / customers.length : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      <AdminNav
        title="Customer Directory & Profiles"
        subtitle="Guest profiles, lifetime spend, session history, and customer orders."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Total Registered Guests</span>
            <Users className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {customers.length} Guests
          </p>
          <p className="text-[11px] text-brand-muted">Active guest session strategy</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Cumulative Guest Spend</span>
            <DollarSign className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            ₹{totalSpendAll.toFixed(2)}
          </p>
          <p className="text-[11px] text-emerald-600 font-medium">Historical order value</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Average Value / Guest</span>
            <Receipt className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            ₹{avgSpend.toFixed(2)}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">Order basket average</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search guests by name, mobile, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-brand-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
          />
        </div>

        <span className="text-xs text-brand-muted">
          Showing {filteredCustomers.length} of {customers.length} profiles
        </span>
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="p-16 text-center text-xs text-brand-muted">Loading customer directory...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-brand-border text-center space-y-3">
          <p className="text-xs text-brand-muted">No customer profiles found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-border shadow-card-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-brand-border bg-brand-warm-white text-[11px] font-bold text-brand-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Contact Mobile</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Total Orders</th>
                  <th className="py-3 px-4">Total Spend</th>
                  <th className="py-3 px-4">Last Visit</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-xs text-brand-charcoal">
                {filteredCustomers.map((cust) => (
                  <tr
                    key={cust.id}
                    className="hover:bg-brand-warm-white/60 transition-colors cursor-pointer"
                    onClick={() => handleOpenCustomerOrders(cust)}
                  >
                    <td className="py-3.5 px-4 font-heading font-bold text-brand-black flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-yellow font-extrabold text-brand-black flex items-center justify-center text-xs">
                        {cust.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span>{cust.full_name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-brand-black">
                      +91 {cust.mobile_number}
                    </td>
                    <td className="py-3.5 px-4 text-brand-muted">
                      {cust.email || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-heading font-bold text-brand-black">
                      {cust.order_count || 0}
                    </td>
                    <td className="py-3.5 px-4 font-heading font-extrabold text-brand-black">
                      ₹{(cust.total_spend || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-brand-muted text-[11px]">
                      {cust.last_order_at
                        ? new Date(cust.last_order_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'Recent'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCustomerOrders(cust);
                        }}
                        rightIcon={<Eye className="w-3.5 h-3.5" />}
                      >
                        Orders
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Orders Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedCustomer ? `${selectedCustomer.full_name}'s Orders` : 'Customer History'}
        maxWidth="lg"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border space-y-1 text-xs">
              <p className="font-heading font-bold text-base text-brand-black">
                {selectedCustomer.full_name}
              </p>
              <p className="text-brand-muted">Mobile: +91 {selectedCustomer.mobile_number}</p>
              {selectedCustomer.email && (
                <p className="text-brand-muted">Email: {selectedCustomer.email}</p>
              )}
            </div>

            <div className="space-y-3">
              <span className="text-xs font-heading font-bold text-brand-black uppercase tracking-wider block">
                Past Orders ({customerOrders.length})
              </span>

              {loadingOrders ? (
                <div className="p-8 text-center text-xs text-brand-muted">Loading orders...</div>
              ) : customerOrders.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-brand-border text-center text-xs text-brand-muted">
                  No orders recorded for this customer yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {customerOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 rounded-2xl bg-white border border-brand-border space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-brand-black">
                          #{ord.order_number}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ord.payment_status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-800'
                            }`}
                          >
                            {ord.payment_status}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand-warm-white text-brand-black">
                            {ord.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-brand-muted">
                        {new Date(ord.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {ord.order_type === 'DINING' ? `Table ${ord.table_number_snapshot || 'Assigned'}` : 'Takeaway'}
                      </p>

                      <div className="text-[11px] text-brand-charcoal pt-1 border-t border-brand-border/40 flex items-center justify-between">
                        <span className="truncate max-w-xs text-brand-muted">
                          {ord.items?.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(', ')}
                        </span>
                        <span className="font-heading font-extrabold text-brand-black shrink-0">
                          ₹{ord.total_amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
