import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchOrderById } from '../lib/supabase';
import { Order } from '../types';
import { Button } from '../components/common/Button';
import {
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  ShoppingBag,
  Receipt,
  FileCheck,
  Printer,
  ChevronRight,
} from 'lucide-react';

export const OrderConfirmationPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) return;
    fetchOrderById(orderId).then((res) => {
      setOrder(res);
      setLoading(false);
    });
  }, [orderId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold uppercase tracking-wider text-brand-muted">
          Retrieving Order Confirmation...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h2 className="font-heading font-extrabold text-2xl text-brand-black">Order Not Found</h2>
        <p className="text-xs text-brand-muted">
          We could not find details for the requested order. It may have expired or been removed.
        </p>
        <Link to="/menu">
          <Button variant="primary" size="md">
            Go to Menu
          </Button>
        </Link>
      </div>
    );
  }

  const isPaid = order.payment_status === 'PAID';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8 pb-24">
      {/* Celebration Header Animation */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center space-y-3"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft-yellow/80 border border-brand-yellow text-brand-black text-xs font-bold uppercase tracking-wider">
          <FileCheck className="w-3.5 h-3.5" /> Order Placed Successfully
        </div>

        <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-brand-black">
          Thank you, {order.customer_name_snapshot}!
        </h1>
        <p className="text-xs text-brand-muted max-w-md mx-auto">
          Your order has been safely registered in the HANGOUT digital queue and dispatched to our kitchen team.
        </p>
      </motion.div>

      {/* Primary Order Badge Card */}
      <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-5">
          <div>
            <span className="text-[11px] font-bold text-brand-muted uppercase tracking-wider">
              Order Reference Number
            </span>
            <div className="flex items-center gap-2 mt-0.5">
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
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                isPaid
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{isPaid ? 'PAID (Demo)' : 'PAY AT COUNTER / AFTER MEAL'}</span>
            </span>
          </div>
        </div>

        {/* Fulfillment Specifics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border space-y-1">
            <span className="text-[11px] font-bold uppercase text-brand-muted flex items-center gap-1.5">
              {order.order_type === 'DINING' ? (
                <UtensilsCrossed className="w-3.5 h-3.5 text-brand-yellow" />
              ) : (
                <ShoppingBag className="w-3.5 h-3.5 text-brand-yellow" />
              )}
              {order.order_type === 'DINING' ? 'Dine-In Table' : 'Self-Pickup'}
            </span>
            <p className="font-heading font-bold text-sm text-brand-black">
              {order.order_type === 'DINING'
                ? `Table ${order.table_number_snapshot || 'Assigned'}`
                : order.pickup_slot_snapshot || 'ASAP Pickup'}
            </p>
            <p className="text-[11px] text-brand-muted">
              {order.order_type === 'DINING'
                ? 'Your meal will be served hot directly to this table.'
                : 'Collect at the pickup counter when status changes to Ready.'}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border space-y-1">
            <span className="text-[11px] font-bold uppercase text-brand-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-yellow" /> Order Placed At
            </span>
            <p className="font-heading font-bold text-sm text-brand-black">
              {new Date(order.created_at).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </p>
            <p className="text-[11px] text-brand-muted">
              Payment Method: <strong className="text-brand-black">{order.payment_method}</strong>
            </p>
          </div>
        </div>

        {/* Items Itemized Breakdown */}
        <div className="space-y-3 pt-2">
          <h3 className="font-heading font-bold text-sm text-brand-black uppercase tracking-wider">
            Ordered Items ({order.items?.length || 0})
          </h3>

          <div className="divide-y divide-brand-border border border-brand-border rounded-2xl overflow-hidden bg-brand-warm-white/50">
            {order.items?.map((item) => (
              <div key={item.id} className="p-3.5 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <p className="font-heading font-bold text-brand-black">
                    {item.item_name_snapshot} <span className="text-brand-muted font-normal">× {item.quantity}</span>
                  </p>
                  {item.variant_name_snapshot && (
                    <p className="text-[11px] text-brand-muted">Variant: {item.variant_name_snapshot}</p>
                  )}
                  {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                    <p className="text-[11px] text-brand-muted">
                      Add-ons: {item.addon_names_snapshot.join(', ')}
                    </p>
                  )}
                  {item.special_instructions && (
                    <p className="italic text-amber-900 text-[11px]">Note: {item.special_instructions}</p>
                  )}
                </div>
                <span className="font-heading font-bold text-brand-black">
                  ₹{item.total_price.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Financial Summary */}
        <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-brand-muted">Subtotal</span>
            <span className="font-medium text-brand-black">₹{order.subtotal.toFixed(2)}</span>
          </div>

          {order.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Discount Applied</span>
              <span>-₹{order.discount_amount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-brand-muted">
            <span>CGST ({order.tax_breakdown?.cgstRate || 2.5}%)</span>
            <span>₹{(order.tax_breakdown?.cgstAmount || order.tax_amount / 2).toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-brand-muted">
            <span>SGST ({order.tax_breakdown?.sgstRate || 2.5}%)</span>
            <span>₹{(order.tax_breakdown?.sgstAmount || order.tax_amount / 2).toFixed(2)}</span>
          </div>

          <div className="flex justify-between font-heading font-extrabold text-base text-brand-black pt-2 border-t border-brand-border">
            <span>Grand Total</span>
            <span>₹{order.total_amount.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:flex-1"
            onClick={() => navigate(`/track/${order.id}`)}
            rightIcon={<ChevronRight className="w-4 h-4" />}
          >
            Track Order Live
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => window.print()}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Receipt
          </Button>

          <Button
            variant="outline"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => navigate('/menu')}
          >
            Order More
          </Button>
        </div>
      </div>
    </div>
  );
};
