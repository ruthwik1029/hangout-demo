import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomer } from '../context/CustomerContext';
import { useOrderMode } from '../context/OrderModeContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { fetchCustomerOrders, fetchMenuItems } from '../lib/supabase';
import { Order, MenuItem } from '../types';
import { Button } from '../components/common/Button';
import {
  User,
  Phone,
  Mail,
  ShoppingBag,
  Utensils,
  LogOut,
  ArrowLeft,
  Key,
  RotateCcw,
  Receipt,
  ExternalLink,
  Clock,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { currentCustomer, currentSession, isAuthenticated, openRegisterModal, logoutCustomer } =
    useCustomer();
  const { mode, currentTable } = useOrderMode();
  const { addItem } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (!currentCustomer) return;
    setLoadingOrders(true);
    fetchCustomerOrders(currentCustomer.id).then((res) => {
      setOrders(res);
      setLoadingOrders(false);
    });
    fetchMenuItems().then(setMenuItems);
  }, [currentCustomer]);

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
        title: 'Reordered Items Added',
        message: `${addedCount} items from #${order.order_number} added to your cart.`,
      });
      navigate('/cart');
    } else {
      showToast({
        type: 'error',
        title: 'Unavailable',
        message: 'The items in this order are currently out of stock.',
      });
    }
  };

  if (!isAuthenticated || !currentCustomer) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-brand-border shadow-card-subtle text-center">
        <div className="w-16 h-16 rounded-3xl bg-brand-soft-yellow flex items-center justify-center mx-auto mb-4 text-brand-black">
          <User className="w-8 h-8" />
        </div>
        <h1 className="font-heading font-extrabold text-2xl text-brand-black">
          Customer Check-In
        </h1>
        <p className="text-xs text-brand-muted mt-2 mb-6 leading-relaxed font-sans">
          Register or check in with your mobile number to link your dining table orders or track self-pickup items.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" onClick={openRegisterModal}>
            Register / Check In
          </Button>
          <Button variant="ghost" size="md" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Back Button */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Customer Website</span>
      </button>

      {/* Main Profile Card */}
      <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-yellow flex items-center justify-center font-heading font-black text-2xl text-brand-black shadow-sm">
              {currentCustomer.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="font-heading font-extrabold text-2xl text-brand-black">
                {currentCustomer.full_name}
              </h1>
              <p className="text-xs text-brand-muted mt-0.5 flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" /> +91 {currentCustomer.mobile_number}
                </span>
                {currentCustomer.email && (
                  <span className="flex items-center gap-1">
                    • <Mail className="w-3.5 h-3.5" /> {currentCustomer.email}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              logoutCustomer();
              navigate('/');
            }}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold p-2 rounded-xl hover:bg-red-50"
            title="End session"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>

        {/* Current Ordering Context */}
        <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center">
              {mode === 'dining' ? (
                <Utensils className="w-5 h-5" />
              ) : (
                <ShoppingBag className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-bold text-brand-black">
                Active Order Mode: {mode === 'dining' ? 'Dining In' : 'Self-Pickup'}
              </p>
              <p className="text-[11px] text-brand-muted">
                {mode === 'dining' && currentTable
                  ? `Assigned to Table ${currentTable.table_number} (${currentTable.section})`
                  : mode === 'dining'
                  ? 'Table not selected yet'
                  : 'Counter Collection at HANGOUT'}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/menu')}>
            Order Now
          </Button>
        </div>

        {/* Safe Session Security Card */}
        <div className="p-4 rounded-2xl bg-brand-charcoal text-white text-xs space-y-2">
          <div className="flex items-center justify-between text-brand-yellow font-heading font-bold">
            <span className="flex items-center gap-1.5">
              <Key className="w-4 h-4" /> Safe Device Session
            </span>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono">Active</span>
          </div>
          <p className="font-mono text-[11px] text-gray-300">
            Token: {currentSession?.session_token}
          </p>
          <p className="text-[11px] text-gray-400">
            Customer identities are protected by unique session bearer tokens rather than treating mobile numbers alone as proof of identity.
          </p>
        </div>
      </div>

      {/* Customer Order History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-extrabold text-xl text-brand-black flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-black" />
            <span>Order History</span>
          </h2>
          <span className="text-xs text-brand-muted">
            {orders.length} {orders.length === 1 ? 'order' : 'orders'} placed
          </span>
        </div>

        {loadingOrders ? (
          <div className="p-12 text-center text-xs text-brand-muted">Loading your orders...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 bg-white rounded-3xl border border-brand-border text-center space-y-3">
            <p className="text-xs text-brand-muted">You haven&apos;t placed any orders with HANGOUT yet.</p>
            <Button variant="primary" size="sm" onClick={() => navigate('/menu')}>
              Browse Menu & Order
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isPaid = order.payment_status === 'PAID';
              return (
                <div
                  key={order.id}
                  className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4 hover:border-brand-black/30 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-extrabold text-lg text-brand-black font-mono">
                          #{order.order_number}
                        </span>
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
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {order.status.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {isPaid ? 'PAID' : 'PAY AT COUNTER'}
                        </span>
                      </div>
                      <p className="text-[11px] text-brand-muted mt-1 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {order.order_type === 'DINING' ? `Table ${order.table_number_snapshot || 'Assigned'}` : 'Self-Pickup'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/track/${order.id}`)}
                        rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
                      >
                        Track Status
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReorder(order)}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                      >
                        Reorder
                      </Button>
                    </div>
                  </div>

                  {/* Items snapshot summary */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="text-brand-muted text-[11px]">
                      {order.items?.map((it) => `${it.quantity}× ${it.item_name_snapshot}`).join(', ') || 'No item details'}
                    </div>
                    <span className="font-heading font-extrabold text-sm text-brand-black">
                      ₹{order.total_amount.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
