import React, { useState, useEffect } from 'react';
import { Order, OrderItem, OrderItemStatus } from '../../types';
import {
  Clock,
  Flame,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  UtensilsCrossed,
  Check,
} from 'lucide-react';

interface KDSTicketCardProps {
  order: Order;
  stationFilter: string;
  onUpdateItemStatus: (orderId: string, itemId: string, newStatus: OrderItemStatus) => void;
  onStartAllPrep: (orderId: string) => void;
  onMarkAllReady: (orderId: string) => void;
  onBumpTicket: (orderId: string) => void;
  isProcessing?: boolean;
}

export const KDSTicketCard: React.FC<KDSTicketCardProps> = ({
  order,
  stationFilter,
  onUpdateItemStatus,
  onStartAllPrep,
  onMarkAllReady,
  onBumpTicket,
  isProcessing = false,
}) => {
  // Real-time elapsed timer calculation derived from persisted timestamp
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(0);

  useEffect(() => {
    const calcElapsed = () => {
      const start = new Date(order.preparation_started_at || order.created_at).getTime();
      const diffMins = Math.max(0, Math.floor((Date.now() - start) / 60000));
      setElapsedMinutes(diffMins);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 15000); // Re-calculate every 15s
    return () => clearInterval(interval);
  }, [order.preparation_started_at, order.created_at]);

  // Expected prep time is the max prep time among non-cancelled items
  const expectedPrepMins = Math.max(
    ...(order.items || []).map((i) => i.estimated_prep_mins || 12),
    10
  );
  const isOverdue = elapsedMinutes > expectedPrepMins;

  // Filter items if a specific station is selected
  const displayItems = (order.items || []).filter((item) => {
    if (stationFilter === 'all') return true;
    return (item.station_code || 'MAIN_KITCHEN') === stationFilter;
  });

  // Check overall ticket item readiness
  const allDisplayItemsReady = displayItems.every(
    (i) => ['READY', 'SERVED', 'CANCELLED'].includes(i.item_status || i.status || '')
  );
  const anyDisplayItemsQueued = displayItems.some(
    (i) => (i.item_status || i.status) === 'QUEUED'
  );

  // Helper: Cycle item status on tap
  const handleItemTap = (item: OrderItem) => {
    const current = item.item_status || item.status || 'QUEUED';
    if (current === 'QUEUED') {
      onUpdateItemStatus(order.id, item.id, 'PREPARING');
    } else if (current === 'PREPARING') {
      onUpdateItemStatus(order.id, item.id, 'PREPARATION_COMPLETED');
    } else if (current === 'PREPARATION_COMPLETED') {
      onUpdateItemStatus(order.id, item.id, 'READY');
    }
  };

  const getStatusBadge = (status: OrderItemStatus) => {
    switch (status) {
      case 'QUEUED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
            QUEUED
          </span>
        );
      case 'PREPARING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-brand-black animate-pulse">
            COOKING
          </span>
        );
      case 'PREPARATION_COMPLETED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
            COOKED
          </span>
        );
      case 'READY':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white flex items-center gap-0.5">
            <Check className="w-3 h-3" /> READY
          </span>
        );
      case 'SERVED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">
            SERVED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 line-through">
            VOID
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`rounded-3xl border bg-white shadow-card-subtle flex flex-col justify-between overflow-hidden transition-all ${
        isOverdue
          ? 'border-red-400 ring-2 ring-red-400/40'
          : allDisplayItemsReady
          ? 'border-emerald-400 ring-1 ring-emerald-300/60'
          : order.order_status === 'PREPARING'
          ? 'border-amber-400 ring-1 ring-amber-300/40'
          : 'border-brand-border'
      }`}
    >
      {/* Ticket Header */}
      <div
        className={`p-4 border-b ${
          isOverdue
            ? 'bg-red-50/80 border-red-200 text-red-950'
            : allDisplayItemsReady
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : order.order_status === 'PREPARING'
            ? 'bg-amber-50/80 border-amber-200 text-amber-950'
            : 'bg-zinc-50 border-brand-border text-brand-black'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-xl tracking-tight">
              #{order.order_number.replace('HG-2026-', '')}
            </span>

            {order.order_type === 'DINING' ? (
              <span className="px-2 py-0.5 rounded-lg text-xs font-heading font-black bg-brand-black text-brand-yellow flex items-center gap-1">
                <UtensilsCrossed className="w-3 h-3" />
                <span>Table {order.table_number_snapshot || 'Dining'}</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-lg text-xs font-heading font-black bg-brand-charcoal text-white flex items-center gap-1">
                <ShoppingBag className="w-3 h-3" />
                <span>Takeaway</span>
              </span>
            )}
          </div>

          {/* Realtime Elapsed Timer */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-mono text-xs font-bold ${
              isOverdue
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-white/80 border border-brand-border text-brand-black'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{elapsedMinutes}m elapsed</span>
          </div>
        </div>

        {/* Customer / Fulfillment Note */}
        <div className="flex items-center justify-between text-[11px] text-brand-muted mt-2">
          <span className="truncate max-w-[140px] font-medium text-brand-charcoal">
            {order.customer_name_snapshot}
          </span>
          {order.order_type === 'TAKEAWAY' && (
            <span className="font-medium text-brand-black">
              Slot: {order.pickup_time_slot || 'ASAP'}
            </span>
          )}
          {isOverdue && (
            <span className="text-red-700 font-extrabold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Overdue (est {expectedPrepMins}m)
            </span>
          )}
        </div>
      </div>

      {/* Ticket Items (Interactive touch list) */}
      <div className="p-4 divide-y divide-brand-border/50 space-y-3 flex-1 overflow-y-auto max-h-80">
        {displayItems.length === 0 ? (
          <p className="text-xs text-brand-muted italic py-4 text-center">
            No items in this ticket assigned to station "{stationFilter}".
          </p>
        ) : (
          displayItems.map((item) => {
            const itemStatus = item.item_status || item.status || 'QUEUED';
            const isItemDone = itemStatus === 'READY' || itemStatus === 'SERVED';
            return (
              <div
                key={item.id}
                onClick={() => handleItemTap(item)}
                className={`pt-2.5 first:pt-0 cursor-pointer rounded-xl transition-all p-2 -mx-2 hover:bg-brand-soft-yellow/20 flex items-start justify-between gap-3 ${
                  isItemDone ? 'opacity-70 bg-emerald-50/20' : ''
                }`}
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <span className="font-heading font-black text-lg text-brand-black leading-tight shrink-0">
                    {item.quantity}×
                  </span>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-heading font-bold text-sm text-brand-black leading-snug ${
                        isItemDone ? 'line-through text-brand-muted' : ''
                      }`}
                    >
                      {item.item_name_snapshot}
                    </p>

                    {item.variant_name_snapshot && (
                      <p className="text-xs text-brand-muted font-medium">
                        Variant: {item.variant_name_snapshot}
                      </p>
                    )}

                    {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                      <p className="text-xs text-brand-muted">
                        Addons: {item.addon_names_snapshot.join(', ')}
                      </p>
                    )}

                    {item.special_instructions && (
                      <p className="text-xs text-amber-900 font-bold bg-amber-100/80 px-2 py-0.5 rounded mt-1 inline-block">
                        ★ "{item.special_instructions}"
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-mono text-[10px] uppercase font-bold text-brand-muted bg-brand-warm-white px-1.5 py-0.5 rounded border border-brand-border">
                        {item.station_code || 'MAIN_KITCHEN'}
                      </span>
                      <span className="text-[10px] text-brand-muted">
                        ~{item.estimated_prep_mins || 12}m
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-1">
                  {getStatusBadge(itemStatus)}
                  <span className="text-[9px] text-brand-muted font-semibold hover:underline">
                    Tap to step ↗
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Ticket Footer Actions */}
      <div className="p-3 bg-brand-warm-white border-t border-brand-border/80 flex items-center gap-2">
        {anyDisplayItemsQueued && (
          <button
            onClick={() => onStartAllPrep(order.id)}
            disabled={isProcessing}
            className="flex-1 py-2 px-3 bg-brand-black hover:bg-brand-charcoal text-brand-yellow rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <Flame className="w-3.5 h-3.5 text-brand-yellow" />
            <span>Start All Prep</span>
          </button>
        )}

        {!allDisplayItemsReady && !anyDisplayItemsQueued && (
          <button
            onClick={() => onMarkAllReady(order.id)}
            disabled={isProcessing}
            className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark All Ready</span>
          </button>
        )}

        {allDisplayItemsReady && (
          <button
            onClick={() => onBumpTicket(order.id)}
            disabled={isProcessing}
            className="w-full py-2 px-3 bg-brand-charcoal hover:bg-black text-brand-yellow rounded-xl font-heading font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Bump Ticket (Archive)</span>
          </button>
        )}
      </div>
    </div>
  );
};
