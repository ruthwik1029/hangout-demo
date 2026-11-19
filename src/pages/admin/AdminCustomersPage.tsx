import React, { useState, useEffect, useMemo } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchAdminCustomers, fetchCustomerOrders, recordAdminAction } from '../../lib/supabase';
import { Customer, Order } from '../../types';
import { Button } from '../../components/common/Button';
import { Drawer } from '../../components/common/Drawer';
import {
  Users,
  Search,
  DollarSign,
  Receipt,
  Eye,
  Calendar,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  Mail,
  UserCheck,
  Sparkles,
} from 'lucide-react';

type DateFilterOption = 'ALL' | '7D' | '30D' | 'THIS_YEAR';
type StatusFilterOption = 'ALL' | 'ACTIVE' | 'NEW_REGISTERED';
type SortOption =
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'DATE_DESC'
  | 'DATE_ASC'
  | 'ORDERS_DESC'
  | 'ORDERS_ASC'
  | 'SPEND_DESC'
  | 'SPEND_ASC';

export const AdminCustomersPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('DATE_DESC');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected customer for order history drawer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    fetchAdminCustomers().then((data) => {
      setCustomers(data);
      setLoading(false);
    });
  }, []);

  const handleOpenCustomerOrders = async (cust: Customer) => {
    setSelectedCustomer(cust);
    setIsDrawerOpen(true);
    setLoadingOrders(true);

    try {
      // Audit log the customer profile view action
      await recordAdminAction(
        'Administrator',
        `Viewed customer profile for ${cust.full_name}`,
        'CUSTOMERS',
        `ID: ${cust.id}, Mobile: ${cust.mobile_number}`
      );
    } catch {
      // Non-blocking audit log
    }

    const ords = await fetchCustomerOrders(cust.id || cust.mobile_number);
    setCustomerOrders(ords);
    setLoadingOrders(false);
  };

  // Stable reference timestamp for relative date calculations
  const [referenceTime] = useState(() => Date.now());

  // Filter & Search Logic
  const filteredCustomers = useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const currentYear = new Date(referenceTime).getFullYear();

    return customers.filter((cust) => {
      // 1. Text Search (Name, Mobile, Email)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = cust.full_name.toLowerCase().includes(q);
        const matchesPhone = cust.mobile_number.includes(q);
        const matchesEmail = Boolean(cust.email && cust.email.toLowerCase().includes(q));
        if (!matchesName && !matchesPhone && !matchesEmail) {
          return false;
        }
      }

      // 2. Account Status Filter
      if (statusFilter === 'ACTIVE') {
        const isAct = cust.status === 'ACTIVE' || cust.total_orders > 0;
        if (!isAct) return false;
      } else if (statusFilter === 'NEW_REGISTERED') {
        const isNew = cust.status === 'NEW REGISTERED' || cust.total_orders === 0;
        if (!isNew) return false;
      }

      // 3. Registration Date Filter
      if (dateFilter !== 'ALL') {
        const regTime = new Date(cust.created_at).getTime();
        if (dateFilter === '7D' && referenceTime - regTime > 7 * dayMs) {
          return false;
        }
        if (dateFilter === '30D' && referenceTime - regTime > 30 * dayMs) {
          return false;
        }
        if (dateFilter === 'THIS_YEAR') {
          const regYear = new Date(cust.created_at).getFullYear();
          if (regYear !== currentYear) return false;
        }
      }

      return true;
    });
  }, [customers, searchQuery, statusFilter, dateFilter, referenceTime]);

  // Sorting Logic
  const sortedCustomers = useMemo(() => {
    return [...filteredCustomers].sort((a, b) => {
      switch (sortBy) {
        case 'NAME_ASC':
          return a.full_name.localeCompare(b.full_name);
        case 'NAME_DESC':
          return b.full_name.localeCompare(a.full_name);
        case 'DATE_DESC':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'DATE_ASC':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'ORDERS_DESC':
          return (b.total_orders || 0) - (a.total_orders || 0);
        case 'ORDERS_ASC':
          return (a.total_orders || 0) - (b.total_orders || 0);
        case 'SPEND_DESC':
          return (b.total_spent || 0) - (a.total_spent || 0);
        case 'SPEND_ASC':
          return (a.total_spent || 0) - (b.total_spent || 0);
        default:
          return 0;
      }
    });
  }, [filteredCustomers, sortBy]);

  // Pagination Slice
  const totalItems = sortedCustomers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedCustomers = sortedCustomers.slice(startIndex, startIndex + pageSize);

  // Helpers to update filters and reset page
  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (val: DateFilterOption) => {
    setDateFilter(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: StatusFilterOption) => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (val: number) => {
    setPageSize(val);
    setCurrentPage(1);
  };

  // Aggregate Metrics (Honest calculation across all loaded customers)
  const totalRegisteredCount = customers.length;
  const totalCumulativeSpend = customers.reduce((acc, c) => acc + (c.total_spent || 0), 0);
  const avgSpendPerCustomer = totalRegisteredCount > 0 ? totalCumulativeSpend / totalRegisteredCount : 0;
  const activeCount = customers.filter((c) => c.status === 'ACTIVE' || c.total_orders > 0).length;

  // Drawer stats for selected customer
  const drawerStats = useMemo(() => {
    if (!selectedCustomer) return null;
    const completed = customerOrders.filter((o) => o.status === 'COMPLETED' || o.status === 'SERVED').length;
    const pending = customerOrders.filter(
      (o) => o.status !== 'COMPLETED' && o.status !== 'SERVED' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
    ).length;
    const cancelled = customerOrders.filter((o) => o.status === 'CANCELLED' || o.status === 'REJECTED').length;
    const honestPaidSpend = customerOrders
      .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
      .reduce((sum, o) => sum + o.total_amount, 0);

    return {
      completed,
      pending,
      cancelled,
      honestPaidSpend: honestPaidSpend > 0 ? honestPaidSpend : selectedCustomer.total_spent,
    };
  }, [selectedCustomer, customerOrders]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      <AdminNav
        title="Customer Directory & Profiles"
        subtitle="Complete directory of registered, logged-in, and guest checkout customers with honest lifetime spend."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Total Customers</span>
            <Users className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {totalRegisteredCount} Profiles
          </p>
          <p className="text-[11px] text-brand-muted">Registered & ordering customers</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Active Customers</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {activeCount} Active
          </p>
          <p className="text-[11px] text-emerald-600 font-medium">Placed 1+ genuine orders</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Total Paid Spending</span>
            <DollarSign className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            ₹{totalCumulativeSpend.toFixed(2)}
          </p>
          <p className="text-[11px] text-brand-muted">Honest paid order total</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Average Spend / Customer</span>
            <Receipt className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            ₹{avgSpendPerCustomer.toFixed(2)}
          </p>
          <p className="text-[11px] text-brand-muted font-medium">Lifetime average value</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Sorting */}
      <div className="p-4 bg-white rounded-2xl border border-brand-border shadow-card-subtle space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* Multi-field Search */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by full name, mobile (+91), or email..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
            />
          </div>

          {/* Registration Date Filter */}
          <div className="lg:col-span-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-brand-muted shrink-0" />
            <select
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value as DateFilterOption)}
              className="w-full py-2 px-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-yellow font-medium text-brand-black"
            >
              <option value="ALL">All Time</option>
              <option value="7D">Last 7 Days</option>
              <option value="30D">Last 30 Days</option>
              <option value="THIS_YEAR">This Year</option>
            </select>
          </div>

          {/* Account Status Filter */}
          <div className="lg:col-span-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-brand-muted shrink-0" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value as StatusFilterOption)}
              className="w-full py-2 px-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-yellow font-medium text-brand-black"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Customers</option>
              <option value="NEW_REGISTERED">New Registered</option>
            </select>
          </div>

          {/* Sort By Selector */}
          <div className="lg:col-span-3 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-brand-muted shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full py-2 px-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-yellow font-medium text-brand-black"
            >
              <option value="DATE_DESC">Registration: Newest First</option>
              <option value="DATE_ASC">Registration: Oldest First</option>
              <option value="NAME_ASC">Name: A to Z</option>
              <option value="NAME_DESC">Name: Z to A</option>
              <option value="ORDERS_DESC">Orders: Highest First</option>
              <option value="ORDERS_ASC">Orders: Lowest First</option>
              <option value="SPEND_DESC">Spend: Highest First</option>
              <option value="SPEND_ASC">Spend: Lowest First</option>
            </select>
          </div>
        </div>

        {/* Status Count and Active Filter Indicator */}
        <div className="flex flex-wrap items-center justify-between text-xs text-brand-muted pt-2 border-t border-brand-border/40">
          <span>
            Showing <strong className="text-brand-black">{paginatedCustomers.length}</strong> of{' '}
            <strong className="text-brand-black">{totalItems}</strong> matching profiles
            {totalItems !== totalRegisteredCount && ` (filtered from ${totalRegisteredCount} total)`}
          </span>

          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="py-1 px-2 bg-brand-warm-white border border-brand-border rounded-lg text-xs font-bold text-brand-black"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      {loading ? (
        <div className="p-16 text-center text-xs text-brand-muted">Loading customer directory...</div>
      ) : paginatedCustomers.length === 0 ? (
        <div className="p-12 bg-white rounded-3xl border border-brand-border text-center space-y-3">
          <Users className="w-8 h-8 text-brand-muted mx-auto" />
          <p className="font-heading font-bold text-sm text-brand-black">No customer profiles match your criteria.</p>
          <p className="text-xs text-brand-muted">Try adjusting your search terms or filter settings.</p>
          {(searchQuery || dateFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setDateFilter('ALL');
                setStatusFilter('ALL');
              }}
            >
              Reset Filters
            </Button>
          )}
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
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Registered Date</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">Paid Spend</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border text-xs text-brand-charcoal">
                {paginatedCustomers.map((cust) => {
                  const isNewRegistered = cust.status === 'NEW REGISTERED' || cust.total_orders === 0;

                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-brand-warm-white/60 transition-colors cursor-pointer"
                      onClick={() => handleOpenCustomerOrders(cust)}
                    >
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4 font-heading font-bold text-brand-black flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-brand-yellow font-extrabold text-brand-black flex items-center justify-center text-xs shrink-0 shadow-sm">
                          {cust.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-brand-black">{cust.full_name}</p>
                          <p className="text-[10px] text-brand-muted font-mono font-normal">
                            ID: {cust.id.slice(0, 8)}...
                          </p>
                        </div>
                      </td>

                      {/* Contact Mobile */}
                      <td className="py-3.5 px-4 font-mono font-medium text-brand-black whitespace-nowrap">
                        +91 {cust.mobile_number}
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 text-brand-muted">
                        {cust.email || <span className="text-brand-muted/60">—</span>}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isNewRegistered ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/50">
                            <Sparkles className="w-2.5 h-2.5" />
                            NEW REGISTERED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            ACTIVE
                          </span>
                        )}
                      </td>

                      {/* Registration Date */}
                      <td className="py-3.5 px-4 text-brand-muted text-[11px] whitespace-nowrap">
                        {new Date(cust.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Last Visit */}
                      <td className="py-3.5 px-4 text-brand-muted text-[11px] whitespace-nowrap">
                        {cust.last_visit_at
                          ? new Date(cust.last_visit_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'Recent'}
                      </td>

                      {/* Total Orders */}
                      <td className="py-3.5 px-4 font-heading font-bold text-brand-black text-center">
                        <span className="px-2 py-0.5 rounded-md bg-brand-warm-white font-mono">
                          {cust.total_orders || 0}
                        </span>
                      </td>

                      {/* Honest Paid Spend */}
                      <td className="py-3.5 px-4 font-heading font-extrabold text-brand-black text-right whitespace-nowrap">
                        ₹{(cust.total_spent || 0).toFixed(2)}
                      </td>

                      {/* Action Button */}
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
                          Profile
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-4 border-t border-brand-border flex items-center justify-between text-xs text-brand-muted">
            <span>
              Page <strong className="text-brand-black">{currentPage}</strong> of{' '}
              <strong className="text-brand-black">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Profile & Order History Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedCustomer ? `${selectedCustomer.full_name}'s Profile` : 'Customer History'}
        maxWidth="lg"
      >
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Customer Identity Card */}
            <div className="p-5 rounded-2xl bg-brand-warm-white border border-brand-border space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-brand-yellow font-extrabold text-brand-black flex items-center justify-center text-lg shadow-sm">
                    {selectedCustomer.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-lg text-brand-black">
                      {selectedCustomer.full_name}
                    </h3>
                    <p className="text-[11px] text-brand-muted font-mono">ID: {selectedCustomer.id}</p>
                  </div>
                </div>

                <div>
                  {selectedCustomer.status === 'NEW REGISTERED' || selectedCustomer.total_orders === 0 ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      <Sparkles className="w-3 h-3" />
                      NEW REGISTERED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-brand-border/50 text-xs">
                <div className="flex items-center gap-2 text-brand-charcoal">
                  <Phone className="w-3.5 h-3.5 text-brand-muted" />
                  <span className="font-mono font-medium">+91 {selectedCustomer.mobile_number}</span>
                </div>
                <div className="flex items-center gap-2 text-brand-charcoal">
                  <Mail className="w-3.5 h-3.5 text-brand-muted" />
                  <span>{selectedCustomer.email || 'No email registered'}</span>
                </div>
              </div>

              {/* Registration and Last Active Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-brand-muted pt-1">
                <div>
                  Registered:{' '}
                  <strong className="text-brand-black">
                    {new Date(selectedCustomer.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </strong>
                </div>
                <div>
                  Last Active:{' '}
                  <strong className="text-brand-black">
                    {selectedCustomer.last_visit_at
                      ? new Date(selectedCustomer.last_visit_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'Recent'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Financial & Order Performance Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-white rounded-xl border border-brand-border text-center">
                <span className="text-[10px] uppercase font-bold text-brand-muted block">Lifetime Spend</span>
                <span className="font-heading font-extrabold text-base text-brand-black">
                  ₹{(drawerStats?.honestPaidSpend ?? selectedCustomer.total_spent ?? 0).toFixed(2)}
                </span>
                <span className="text-[9px] text-emerald-600 block">Genuine paid</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-brand-border text-center">
                <span className="text-[10px] uppercase font-bold text-brand-muted block">Completed</span>
                <span className="font-heading font-extrabold text-base text-emerald-700 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {drawerStats?.completed ?? 0}
                </span>
                <span className="text-[9px] text-brand-muted block">Served/Done</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-brand-border text-center">
                <span className="text-[10px] uppercase font-bold text-brand-muted block">In Progress</span>
                <span className="font-heading font-extrabold text-base text-amber-700 flex items-center justify-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {drawerStats?.pending ?? 0}
                </span>
                <span className="text-[9px] text-brand-muted block">Active</span>
              </div>

              <div className="p-3 bg-white rounded-xl border border-brand-border text-center">
                <span className="text-[10px] uppercase font-bold text-brand-muted block">Cancelled</span>
                <span className="font-heading font-extrabold text-base text-red-600 flex items-center justify-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {drawerStats?.cancelled ?? 0}
                </span>
                <span className="text-[9px] text-brand-muted block">Excluded</span>
              </div>
            </div>

            {/* Past Orders List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold text-brand-black uppercase tracking-wider block">
                  Order History ({customerOrders.length})
                </span>
                <span className="text-[11px] text-brand-muted">
                  Showing genuine customer order transactions
                </span>
              </div>

              {loadingOrders ? (
                <div className="p-8 text-center text-xs text-brand-muted">Loading customer orders...</div>
              ) : customerOrders.length === 0 ? (
                <div className="p-6 bg-white rounded-2xl border border-brand-border text-center text-xs text-brand-muted space-y-1">
                  <p className="font-bold text-brand-black">No past orders found.</p>
                  <p className="text-[11px]">This customer is newly registered and has not placed an order yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customerOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-4 rounded-2xl bg-white border border-brand-border space-y-2 text-xs hover:border-brand-yellow/60 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-black">
                            #{ord.order_number}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-warm-white text-brand-black">
                            {ord.order_type === 'DINING' ? `Dining (${ord.table_number_snapshot || 'Table'})` : 'Takeaway'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ord.payment_status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                                : ord.payment_status === 'FAILED'
                                ? 'bg-red-50 text-red-700 border border-red-200/50'
                                : 'bg-amber-50 text-amber-800 border border-amber-200/50'
                            }`}
                          >
                            {ord.payment_status}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-brand-warm-white text-brand-charcoal">
                            {ord.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] text-brand-muted">
                        {new Date(ord.created_at).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      <div className="text-[11px] text-brand-charcoal pt-2 border-t border-brand-border/40 flex items-center justify-between">
                        <span className="truncate max-w-xs text-brand-muted">
                          {ord.items && ord.items.length > 0
                            ? ord.items.map((i) => `${i.quantity}× ${i.item_name_snapshot}`).join(', ')
                            : 'Order items'}
                        </span>
                        <span className="font-heading font-extrabold text-brand-black shrink-0 ml-2">
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
