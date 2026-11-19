import React from 'react';
import { Order } from '../../types';
import { Button } from '../common/Button';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  Phone,
} from 'lucide-react';

interface DiningOrderApprovalCardProps {
  order: Order;
  onAccept: (orderId: string) => void;
  onReject: (order: Order) => void;
  isProcessing?: boolean;
}

export const DiningOrderApprovalCard: React.FC<DiningOrderApprovalCardProps> = ({
  order,
  onAccept,
  onReject,
  isProcessing = false,
}) => {
  const timeFormatted = new Date(order.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white rounded-3xl border border-amber-300 ring-2 ring-amber-300/40 p-5 shadow-card-subtle space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-amber-500 text-brand-black flex items-center justify-center font-heading font-black text-sm">
            !
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-lg text-brand-black">
                Table {order.table_number_snapshot || 'Dining'}
              </span>
              <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                {order.order_number}
              </span>
            </div>
            <p className="text-[11px] text-brand-muted flex items-center gap-1">
              <Clock className="w-3 h-3" /> Placed at {timeFormatted} • Awaiting Crew Approval
            </p>
          </div>
        </div>

        <div className="text-right sm:text-right">
          <p className="text-[10px] uppercase font-bold text-brand-muted">Order Total</p>
          <p className="font-mono font-black text-xl text-brand-black">
            ₹{order.total_amount.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Customer Information Snapshot */}
      <div className="flex flex-wrap items-center gap-4 text-xs bg-brand-warm-white p-3 rounded-2xl border border-brand-border/60">
        <div className="flex items-center gap-1.5 text-brand-charcoal font-medium">
          <User className="w-3.5 h-3.5 text-brand-muted" />
          <span>{order.customer_name_snapshot}</span>
        </div>
        <div className="flex items-center gap-1.5 text-brand-charcoal font-mono">
          <Phone className="w-3.5 h-3.5 text-brand-muted" />
          <span>{order.customer_mobile_snapshot}</span>
        </div>
        <div className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-brand-border text-brand-black font-semibold">
          Payment: <strong className="uppercase">{order.payment_method.replace(/_/g, ' ')}</strong> ({order.payment_status})
        </div>
      </div>

      {/* Itemized Snapshot */}
      <div className="space-y-2">
        <p className="text-[11px] font-heading font-bold text-brand-muted uppercase tracking-wider">
          Requested Items ({order.items?.length || 0})
        </p>

        <div className="divide-y divide-brand-border/40 max-h-48 overflow-y-auto pr-1">
          {order.items?.map((item) => (
            <div key={item.id} className="py-2 text-xs flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span
                  className={`w-3.5 h-3.5 rounded-sm border shrink-0 mt-0.5 flex items-center justify-center text-[8px] font-black ${
                    item.is_veg
                      ? 'border-emerald-600 text-emerald-600'
                      : 'border-red-600 text-red-600'
                  }`}
                >
                  ●
                </span>
                <div>
                  <p className="font-bold text-brand-black">
                    {item.quantity}× {item.item_name_snapshot}
                  </p>
                  {item.variant_name_snapshot && (
                    <p className="text-[11px] text-brand-muted font-medium">
                      Variant: {item.variant_name_snapshot}
                    </p>
                  )}
                  {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                    <p className="text-[11px] text-brand-muted">
                      Add-ons: {item.addon_names_snapshot.join(', ')}
                    </p>
                  )}
                  {item.special_instructions && (
                    <p className="text-[11px] text-amber-800 italic mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded">
                      Note: "{item.special_instructions}"
                    </p>
                  )}
                </div>
              </div>
              <span className="font-mono font-semibold text-brand-charcoal shrink-0">
                ₹{item.total_price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {order.special_instructions && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>
            <strong>Table Special Instructions:</strong> {order.special_instructions}
          </span>
        </div>
      )}

      {/* Bill Summary */}
      <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between text-xs text-brand-muted font-medium">
        <span>Subtotal: ₹{order.subtotal.toFixed(2)}</span>
        <span>GST (CGST+SGST): ₹{order.tax_amount.toFixed(2)}</span>
        {order.discount_amount > 0 && (
          <span className="text-emerald-700">Discount: -₹{order.discount_amount.toFixed(2)}</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center gap-3">
        <Button
          variant="primary"
          size="md"
          className="flex-1"
          leftIcon={<CheckCircle2 className="w-4 h-4" />}
          onClick={() => onAccept(order.id)}
          disabled={isProcessing}
        >
          Approve & Send to Kitchen
        </Button>

        <Button
          variant="outline"
          size="md"
          className="text-red-600 border-red-200 hover:bg-red-50"
          leftIcon={<XCircle className="w-4 h-4 text-red-600" />}
          onClick={() => onReject(order)}
          disabled={isProcessing}
        >
          Reject Order
        </Button>
      </div>
    </div>
  );
};
