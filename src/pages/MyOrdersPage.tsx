import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { fetchCustomerOrders, fetchMenuItems, lookupGuestOrder, fetchOrderById } from '../lib/supabase';
import { Order, MenuItem, OrderStatus } from '../types';
import { Button } from '../components/common/Button';
import { ThermalPrinterAnimation } from '../components/receipt/ThermalPrinterAnimation';
import {
  ShoppingBag,
  UtensilsCrossed,
  ArrowRight,
  Clock,
  AlertCircle,
  RotateCcw,
  Printer,
  Search,
  KeyRound,
  LogIn,
  Receipt,
} from 'lucide-react';

interface RecentGuestOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  order_type: string;
  created_at: string;
  token?: string;
}

export const MyOrdersPage: React.FC = () => {
  const { currentCustomer, isAuthenticated, openRegisterModal } = useCustomer();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  // Guest lookup state
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [verificationInput, setVerificationInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    try {
      const items = await fetchMenuItems();
      setMenuItems(items);

      if (isAuthenticated && currentCustomer) {
        const customerOrders = await fetchCustomerOrders(currentCustomer.id);
        setOrders(customerOrders);
      } else {
        // Load recent orders from localStorage
        const raw = localStorage.getItem('hangout_guest_recent_orders');
        if (raw) {
          const recents: RecentGuestOrder[] = JSON.parse(raw);
          if (Array.isArray(recents) && recents.length > 0) {
            // Fetch updated full orders
            const loaded = await Promise.all(
              recents.slice(0, 10).map(async (r) => {
                const token =
                  r.token ||
                  localStorage.getItem(`hangout_guest_token_${r.id}`) ||
                  localStorage.getItem(`hangout_guest_token_${r.order_number}`) ||
                  null;
                const fetched = await fetchOrderById(r.id, token);
                if (fetched) return fetched;
                return {
                  id: r.id,
                  order_number: r.order_number,
                  status: r.status,
                  order_status: r.status,
                  order_type: (r.order_type as 'DINING' | 'TAKEAWAY') || 'TAKEAWAY',
                  total_amount: r.total_amount,
                  created_at: r.created_at,
                  updated_at: r.created_at || new Date().toISOString(),
                  subtotal: r.total_amount,
                  discount_amount: 0,
                  tax_amount: 0,
                  tax_breakdown: { is_gst_enabled: false, cgst: 0, sgst: 0, total_tax: 0, cgst_rate: 0, sgst_rate: 0 },
                  payment_status: 'PAID',
                  payment_method: 'UPI_DEMO',
                  customer_name_snapshot: 'Guest',
                  customer_mobile_snapshot: '',
                  guest_access_token: token || undefined,
                } as unknown as Order;
              })
            );
            setOrders(loaded);
          } else {
            setOrders([]);
          }
        } else {
          setOrders([]);
        }
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [isAuthenticated, currentCustomer]);

  const handleGuestLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumberInput.trim() || !verificationInput.trim()) return;
    setIsLookingUp(true);
    setLookupError('');

    try {
      const found = await lookupGuestOrder(orderNumberInput.trim(), verificationInput.trim());
      if (found) {
        showToast({
          type: 'success',
          title: 'Order Found',
          message: `Order #${found.order_number} verified successfully.`,
        });
        const token =
          found.guest_access_token ||
          localStorage.getItem(`hangout_guest_token_${found.id}`) ||
          '';
        navigate(`/track/${found.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
      } else {
        setLookupError('Order not found. Please verify the order number and mobile number / token.');
      }
    } catch {
      setLookupError('An error occurred during order verification.');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleReorder = (order: Order) => {
    if (!order.items || order.items.length === 0) return;
    let addedCount = 0;
    for (const item of order.items) {
      const match = menuItems.find((m) => m.id === item.menu_item_id);
      if (match && match.is_available) {
        addItem(match, item.quantity);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      showToast({
        type: 'success',
        title: 'Items Added to Cart',
        message: `${addedCount} items from Order #${order.order_number} added to cart.`,
      });
      navigate('/cart');
    } else {
      showToast({
        type: 'error',
        title: 'Unavailable',
        message: 'These items are currently not available.',
      });
    }
  };

  const activeOrders = orders.filter(
    (o) =>
      o.status === 'PENDING' ||
      o.status === 'ACCEPTED' ||
      o.status === 'PREPARING' ||
      o.status === 'PREPARATION_COMPLETED' ||
      o.status === 'READY_FOR_PICKUP' ||
      o.status === 'READY_FOR_SERVICE' ||
      o.status === 'SERVED'
  );

  const pastOrders = orders.filter(
    (o) =>
      o.status === 'COMPLETED' ||
      o.status === 'CANCELLED' ||
      o.status === 'REJECTED'
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <span className="text-[10px] font-heading font-extrabold uppercase tracking-widest text-brand-black bg-brand-yellow px-2.5 py-1 rounded-md inline-block mb-1">
            Customer Dashboard
          </span>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-brand-black">
            My Orders & Tracking
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Track active live preparation, review past bills, or reorder your favourites.
          </p>
        </div>

        {!isAuthenticated && (
          <Button
            variant="outline"
            size="sm"
            onClick={openRegisterModal}
            leftIcon={<LogIn className="w-3.5 h-3.5" />}
          >
            Sign In / Register
          </Button>
        )}
      </div>

      {/* Guest Lookup Box (Prominently displayed) */}
      <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-yellow flex items-center justify-center text-brand-black shadow-xs">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base text-brand-black">
              Find Any Order Instantly
            </h2>
            <p className="text-[11px] text-brand-muted">
              Placed an order as guest or on another device? Enter your Order # and Mobile Number to track it.
            </p>
          </div>
        </div>

        <form onSubmit={handleGuestLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-5">
            <input
              type="text"
              value={orderNumberInput}
              onChange={(e) => setOrderNumberInput(e.target.value)}
              placeholder="Order Number (e.g. 2026-001)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border text-xs focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              required
            />
          </div>

          <div className="sm:col-span-4">
            <input
              type="text"
              value={verificationInput}
              onChange={(e) => setVerificationInput(e.target.value)}
              placeholder="Mobile Number or Token"
              className="w-full px-3.5 py-2.5 rounded-xl border border-brand-border text-xs focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              required
            />
          </div>

          <div className="sm:col-span-3">
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full h-full"
              isLoading={isLookingUp}
              leftIcon={<KeyRound className="w-3.5 h-3.5" />}
            >
              Track Order
            </Button>
          </div>
        </form>

        {lookupError && (
          <p className="text-xs text-red-600 flex items-center gap-1.5 pt-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{lookupError}</span>
          </p>
        )}
      </div>

      {/* Active In-Progress Orders Section */}
      {activeOrders.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h2 className="font-heading font-extrabold text-xl text-brand-black">
              Active Orders ({activeOrders.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeOrders.map((ord) => {
              const token =
                ord.guest_access_token ||
                (typeof localStorage !== 'undefined'
                  ? localStorage.getItem(`hangout_guest_token_${ord.id}`) ||
                    localStorage.getItem(`hangout_guest_token_${ord.order_number}`) ||
                    ''
                  : '') ||
                '';
              const trackUrl = `/track/${ord.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

              return (
                <div
                  key={ord.id}
                  className="p-5 bg-white rounded-3xl border-2 border-brand-black shadow-card-subtle space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-brand-yellow flex items-center justify-center font-mono font-bold text-sm text-brand-black">
                        #{ord.order_number}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-extrabold text-lg text-brand-black">
                            Order #{ord.order_number}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              ord.status === 'PENDING'
                                ? 'bg-amber-100 text-amber-900 animate-pulse'
                                : ord.status === 'ACCEPTED'
                                ? 'bg-blue-100 text-blue-900'
                                : ord.status === 'PREPARING'
                                ? 'bg-purple-100 text-purple-900 animate-pulse'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {ord.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-brand-muted flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>
                            {new Date(ord.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-heading font-extrabold text-lg text-brand-black block">
                        ₹{ord.total_amount.toFixed(2)}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          ord.payment_status === 'PAID' ? 'text-emerald-700' : 'text-amber-800'
                        }`}
                      >
                        {ord.payment_status === 'PAID' ? 'PAID (Demo)' : 'Pay at Counter'}
                      </span>
                    </div>
                  </div>

                  {/* Fulfillment details */}
                  <div className="flex items-center justify-between text-xs text-brand-charcoal bg-brand-warm-white p-3 rounded-2xl border border-brand-border">
                    <div className="flex items-center gap-2">
                      {ord.order_type === 'DINING' ? (
                        <UtensilsCrossed className="w-4 h-4 text-brand-black" />
                      ) : (
                        <ShoppingBag className="w-4 h-4 text-brand-black" />
                      )}
                      <span className="font-bold">
                        {ord.order_type === 'DINING'
                          ? `Dine-In • Table ${ord.table_number_snapshot || 'Assigned'}`
                          : `Takeaway • ${ord.pickup_slot_snapshot || 'Counter Pickup'}`}
                      </span>
                    </div>

                    <span className="text-[11px] text-brand-muted">
                      {ord.items?.length || 0} item{ord.items?.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 sm:flex-initial"
                      onClick={() => navigate(trackUrl)}
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      Track Order Live
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedOrderForReceipt(ord)}
                      leftIcon={<Printer className="w-3.5 h-3.5" />}
                    >
                      View Bill
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReorder(ord)}
                      leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                    >
                      Reorder
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past Orders History Section */}
      <div className="space-y-4">
        <h2 className="font-heading font-extrabold text-xl text-brand-black">
          Past Orders History ({pastOrders.length})
        </h2>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-brand-muted">Loading your order history...</p>
          </div>
        ) : pastOrders.length === 0 && activeOrders.length === 0 ? (
          <div className="p-12 bg-white rounded-3xl border border-brand-border text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-brand-warm-white flex items-center justify-center mx-auto text-brand-muted">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="font-heading font-bold text-lg text-brand-black">No Orders Recorded Yet</h3>
            <p className="text-xs text-brand-muted max-w-sm mx-auto">
              You have not placed any orders on this device yet, or your past orders have expired.
            </p>
            <Link to="/menu">
              <Button variant="primary" size="md">
                Browse Menu & Order
              </Button>
            </Link>
          </div>
        ) : pastOrders.length === 0 ? (
          <p className="text-xs text-brand-muted italic">No previous completed orders found on this device.</p>
        ) : (
          <div className="space-y-3">
            {pastOrders.map((ord) => {
              const token =
                ord.guest_access_token ||
                (typeof localStorage !== 'undefined'
                  ? localStorage.getItem(`hangout_guest_token_${ord.id}`) ||
                    localStorage.getItem(`hangout_guest_token_${ord.order_number}`) ||
                    ''
                  : '') ||
                '';
              const trackUrl = `/track/${ord.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

              return (
                <div
                  key={ord.id}
                  className="p-4 bg-white rounded-2xl border border-brand-border hover:border-brand-charcoal/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-brand-black">
                        Order #{ord.order_number}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          ord.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800'
                            : 'bg-red-50 text-red-800'
                        }`}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-muted">
                      {new Date(ord.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {ord.order_type === 'DINING' ? 'Dine-In' : 'Takeaway'} •{' '}
                      {ord.items?.length || 0} item{ord.items?.length === 1 ? '' : 's'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-heading font-bold text-sm text-brand-black">
                      ₹{ord.total_amount.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(trackUrl)}
                        leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrderForReceipt(ord)}
                        leftIcon={<Receipt className="w-3.5 h-3.5" />}
                      >
                        Receipt
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(ord)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      >
                        Reorder
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bill & Thermal Receipt Animation Modal */}
      {selectedOrderForReceipt && (
        <ThermalPrinterAnimation
          order={selectedOrderForReceipt}
          isOpen={Boolean(selectedOrderForReceipt)}
          onClose={() => setSelectedOrderForReceipt(null)}
        />
      )}
    </div>
  );
};
