import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { fetchOrderById } from '../../lib/supabase';
import { Order, OrderStatus } from '../../types';
import { ShoppingBag, UtensilsCrossed, ArrowRight, X } from 'lucide-react';

interface CachedRecentOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  order_type: string;
  created_at: string;
  token?: string;
}

export const ActiveOrderBanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [cachedToken, setCachedToken] = useState<string>('');
  const [isDismissed, setIsDismissed] = useState(false);

  // Do not show banner on confirmation or tracking pages to prevent visual clutter
  const isHiddenPage =
    location.pathname.startsWith('/track/') ||
    location.pathname.startsWith('/order-confirmation/') ||
    location.pathname.startsWith('/auth/') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/staff') ||
    location.pathname.startsWith('/kitchen');

  useEffect(() => {
    if (isHiddenPage) return;

    const checkActiveOrders = async () => {
      try {
        const raw = localStorage.getItem('hangout_guest_recent_orders');
        if (!raw) {
          setActiveOrder(null);
          return;
        }
        const recents: CachedRecentOrder[] = JSON.parse(raw);
        if (!Array.isArray(recents) || recents.length === 0) {
          setActiveOrder(null);
          return;
        }

        // Find the most recent active order (not completed, cancelled, or rejected)
        const activeItem = recents.find(
          (o) =>
            o.status === 'PENDING' ||
            o.status === 'ACCEPTED' ||
            o.status === 'PREPARING' ||
            o.status === 'PREPARATION_COMPLETED' ||
            o.status === 'READY_FOR_PICKUP' ||
            o.status === 'READY_FOR_SERVICE' ||
            o.status === 'SERVED'
        );

        if (!activeItem) {
          setActiveOrder(null);
          return;
        }

        const token =
          activeItem.token ||
          localStorage.getItem(`hangout_guest_token_${activeItem.id}`) ||
          localStorage.getItem(`hangout_guest_token_${activeItem.order_number}`) ||
          '';

        setCachedToken(token);

        // Fetch fresh server state
        const fresh = await fetchOrderById(activeItem.id, token);
        if (fresh) {
          setActiveOrder(fresh);
          // Update cached status if changed
          if (fresh.status !== activeItem.status) {
            const updatedRecents = recents.map((r) =>
              r.id === fresh.id ? { ...r, status: fresh.status } : r
            );
            localStorage.setItem('hangout_guest_recent_orders', JSON.stringify(updatedRecents));
          }
        } else {
          setActiveOrder({
            id: activeItem.id,
            order_number: activeItem.order_number,
            status: activeItem.status,
            order_status: activeItem.status,
            order_type: (activeItem.order_type as 'DINING' | 'TAKEAWAY') || 'TAKEAWAY',
            total_amount: activeItem.total_amount || 0,
            created_at: activeItem.created_at || new Date().toISOString(),
            updated_at: activeItem.created_at || new Date().toISOString(),
            subtotal: activeItem.total_amount || 0,
            tax_amount: 0,
            discount_amount: 0,
            payment_status: 'PAID',
            payment_method: 'UPI_DEMO',
            tax_breakdown: { is_gst_enabled: false, cgst: 0, sgst: 0, total_tax: 0, cgst_rate: 0, sgst_rate: 0 },
            customer_name_snapshot: 'Guest',
            customer_mobile_snapshot: '',
          } as unknown as Order);
        }
      } catch {
        // Safe failover
      }
    };

    checkActiveOrders();
    const interval = setInterval(checkActiveOrders, 10000);
    return () => clearInterval(interval);
  }, [isHiddenPage, location.pathname]);

  if (isHiddenPage || isDismissed || !activeOrder) {
    return null;
  }

  // Active statuses only
  const isActive =
    activeOrder.status === 'PENDING' ||
    activeOrder.status === 'ACCEPTED' ||
    activeOrder.status === 'PREPARING' ||
    activeOrder.status === 'PREPARATION_COMPLETED' ||
    activeOrder.status === 'READY_FOR_PICKUP' ||
    activeOrder.status === 'READY_FOR_SERVICE' ||
    activeOrder.status === 'SERVED';

  if (!isActive) return null;

  const isReady =
    activeOrder.status === 'READY_FOR_PICKUP' ||
    activeOrder.status === 'READY_FOR_SERVICE';

  const handleTrack = () => {
    const token = cachedToken || activeOrder.guest_access_token || '';
    navigate(`/track/${activeOrder.id}${token ? `?token=${encodeURIComponent(token)}` : ''}`);
  };

  return (
    <div
      className={`w-full z-30 transition-all ${
        isReady
          ? 'bg-emerald-600 text-white'
          : 'bg-brand-black text-brand-warm-white border-b border-brand-yellow/30'
      } py-2.5 px-4 shadow-md`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              isReady ? 'bg-white animate-bounce' : 'bg-brand-yellow animate-ping'
            }`}
          />
          <div className="flex items-center gap-2 truncate">
            <span className="font-heading font-extrabold uppercase tracking-wider text-brand-yellow">
              {isReady ? 'Ready for Pickup / Service!' : 'Order in Progress:'}
            </span>
            <span className="font-mono font-bold truncate">#{activeOrder.order_number}</span>
            <span className="hidden sm:inline text-brand-muted">•</span>
            <span className="hidden sm:flex items-center gap-1 opacity-90 truncate">
              {activeOrder.order_type === 'DINING' ? (
                <UtensilsCrossed className="w-3.5 h-3.5" />
              ) : (
                <ShoppingBag className="w-3.5 h-3.5" />
              )}
              <span>
                {activeOrder.order_type === 'DINING'
                  ? `Table ${activeOrder.table_number_snapshot || 'Assigned'}`
                  : activeOrder.pickup_slot_snapshot || 'Counter Pickup'}
              </span>
            </span>
            <span className="hidden md:inline px-2 py-0.5 rounded-full bg-white/15 text-[10px] font-bold uppercase tracking-wider">
              {activeOrder.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTrack}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand-yellow text-brand-black text-xs font-heading font-extrabold hover:bg-yellow-400 shadow-sm transition-all active:scale-95"
          >
            <span>Track Live</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-lg text-white/60 hover:text-white transition-colors"
            title="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
