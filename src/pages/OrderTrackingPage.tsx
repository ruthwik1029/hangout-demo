import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchOrderById, fetchMenuItems } from '../lib/supabase';
import { Order, OrderStatus, MenuItem } from '../types';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import {
  CheckCircle2,
  ShoppingBag,
  UtensilsCrossed,
  ArrowLeft,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

interface TrackingStep {
  key: OrderStatus;
  label: string;
  description: string;
}

const DINING_STEPS: TrackingStep[] = [
  { key: 'PENDING', label: 'Order Placed', description: 'Received in cafe system' },
  { key: 'ACCEPTED', label: 'Confirmed', description: 'Table order acknowledged' },
  { key: 'PREPARING', label: 'Cooking', description: 'Baristas & Chefs crafting order' },
  { key: 'READY_FOR_PICKUP', label: 'Ready to Serve', description: 'Being brought to your table' },
  { key: 'COMPLETED', label: 'Completed', description: 'Served & closed' },
];

const TAKEAWAY_STEPS: TrackingStep[] = [
  { key: 'PENDING', label: 'Order Placed', description: 'Received in queue' },
  { key: 'ACCEPTED', label: 'Accepted', description: 'Fulfillment confirmed' },
  { key: 'PREPARING', label: 'Packing', description: 'Freshly prepared & packed' },
  { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup', description: 'Ready at pickup counter' },
  { key: 'COMPLETED', label: 'Collected', description: 'Handed over' },
];

export const OrderTrackingPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    fetchOrderById(orderId).then((res) => {
      setOrder(res);
      setLoading(false);
    });

    fetchMenuItems().then(setMenuItems);

    // Auto-refresh order status periodically (simulates live realtime updates)
    const interval = setInterval(() => {
      fetchOrderById(orderId).then((res) => {
        if (res) setOrder(res);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [orderId]);

  const handleReorder = async () => {
    if (!order || !order.items) return;
    setIsReordering(true);

    let addedCount = 0;
    for (const item of order.items) {
      // Find matching active menu item
      const matched = menuItems.find((m) => m.id === item.menu_item_id);
      if (matched && matched.is_available) {
        addItem(matched, item.quantity);
        addedCount++;
      }
    }

    setIsReordering(false);

    if (addedCount > 0) {
      showToast({
        type: 'success',
        title: 'Items Added to Cart',
        message: `${addedCount} items from Order #${order.order_number} added to your cart.`,
      });
      navigate('/cart');
    } else {
      showToast({
        type: 'error',
        title: 'Reorder Unavailable',
        message: 'These items are currently unavailable in the menu.',
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
          Loading Live Tracking...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="font-heading font-extrabold text-2xl text-brand-black">Order Not Found</h2>
        <p className="text-xs text-brand-muted">The requested order could not be located.</p>
        <Link to="/menu">
          <Button variant="primary" size="md">
            Go to Menu
          </Button>
        </Link>
      </div>
    );
  }

  const steps = order.order_type === 'DINING' ? DINING_STEPS : TAKEAWAY_STEPS;
  const statusRank: Record<OrderStatus, number> = {
    PENDING: 0,
    ACCEPTED: 1,
    PREPARING: 2,
    PREPARATION_COMPLETED: 3,
    READY_FOR_PICKUP: 3,
    READY_FOR_SERVICE: 3,
    SERVED: 3.5,
    COMPLETED: 4,
    REJECTED: -1,
    CANCELLED: -1,
  };

  const currentRank = statusRank[order.status] ?? 0;
  const isCancelledOrRejected = order.status === 'REJECTED' || order.status === 'CANCELLED';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-brand-border pb-4">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>My Orders</span>
        </button>

        <span className="text-xs font-bold text-brand-black uppercase tracking-wider">
          Live Order Status
        </span>
      </div>

      {/* Main Status Header Card */}
      <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black font-mono">
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
                    : isCancelledOrRejected
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-brand-muted mt-1">
              Guest: <strong className="text-brand-black">{order.customer_name_snapshot}</strong> (+91 {order.customer_mobile_snapshot})
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-brand-black block">
              ₹{order.total_amount.toFixed(2)}
            </span>
            <span
              className={`text-[11px] font-bold ${
                order.payment_status === 'PAID' ? 'text-emerald-600' : 'text-amber-800'
              }`}
            >
              {order.payment_status === 'PAID' ? 'PAID (Demo)' : 'UNPAID (Pay at Counter)'}
            </span>
          </div>
        </div>

        {/* Rejection / Cancellation Notice if applicable */}
        {isCancelledOrRejected ? (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span>Order {order.status === 'REJECTED' ? 'Rejected' : 'Cancelled'}</span>
            </div>
            <p className="text-[11px] text-red-700">
              {order.status === 'REJECTED'
                ? 'The cafe kitchen is unable to accept this order at this time.'
                : 'This order was cancelled.'}
            </p>
          </div>
        ) : (
          /* Step-by-Step State Machine Visualizer */
          <div className="py-4">
            <div className="relative">
              {/* Line connector */}
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-gray-200 -z-0 hidden sm:block" />

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 relative z-10">
                {steps.map((st, idx) => {
                  const isDone = currentRank > idx;
                  const isCurrent = currentRank === idx;

                  return (
                    <div key={st.key} className="flex sm:flex-col items-center sm:text-center gap-3 sm:gap-2">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                          isDone
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : isCurrent
                            ? 'bg-brand-black text-brand-yellow ring-4 ring-brand-yellow/30 animate-pulse'
                            : 'bg-brand-warm-white text-brand-muted border border-brand-border'
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                      </div>

                      <div>
                        <p
                          className={`text-xs font-heading font-bold ${
                            isCurrent
                              ? 'text-brand-black'
                              : isDone
                              ? 'text-emerald-800'
                              : 'text-brand-muted'
                          }`}
                        >
                          {st.label}
                        </p>
                        <p className="text-[10px] text-brand-muted hidden sm:block">
                          {st.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Fulfillment banner */}
        <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            {order.order_type === 'DINING' ? (
              <UtensilsCrossed className="w-5 h-5 text-brand-black" />
            ) : (
              <ShoppingBag className="w-5 h-5 text-brand-black" />
            )}
            <div>
              <p className="font-heading font-bold text-brand-black">
                {order.order_type === 'DINING'
                  ? `Dine-In • Table ${order.table_number_snapshot || 'Assigned'}`
                  : `Self-Pickup • ${order.pickup_slot_snapshot || 'Counter Collection'}`}
              </p>
              <p className="text-[11px] text-brand-muted">
                {order.order_type === 'DINING'
                  ? 'Our service staff will bring the order to your table.'
                  : 'Please pick up at the counter with Order #' + order.order_number}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReorder}
            isLoading={isReordering}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reorder
          </Button>
        </div>

        {/* Ordered Items List */}
        <div className="space-y-3 pt-2">
          <h3 className="font-heading font-bold text-sm text-brand-black uppercase tracking-wider">
            Items in Order
          </h3>

          <div className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden bg-white">
            {order.items?.map((item) => (
              <div key={item.id} className="p-3.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-heading font-bold text-brand-black">
                    {item.item_name_snapshot} <span className="text-brand-muted font-normal">× {item.quantity}</span>
                  </p>
                  {item.variant_name_snapshot && (
                    <p className="text-[11px] text-brand-muted">Option: {item.variant_name_snapshot}</p>
                  )}
                  {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                    <p className="text-[11px] text-brand-muted">Extras: {item.addon_names_snapshot.join(', ')}</p>
                  )}
                </div>
                <span className="font-heading font-bold text-brand-black">
                  ₹{item.total_price.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
