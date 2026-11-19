import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Order, CafeSettings } from '../../types';
import { fetchCafeSettings } from '../../lib/supabase';
import { Button } from '../common/Button';
import { Printer, Copy, Check, QrCode } from 'lucide-react';

export interface DigitalReceiptProps {
  order: Order;
  cafeSettings?: CafeSettings | null;
  isReprint?: boolean;
  reprintCount?: number;
  layoutMode?: 'thermal' | 'a4';
  showActions?: boolean;
  onPrint?: () => void;
  className?: string;
}

export const DigitalReceipt: React.FC<DigitalReceiptProps> = ({
  order,
  cafeSettings,
  isReprint = false,
  reprintCount = 0,
  layoutMode: initialLayout = 'thermal',
  showActions = true,
  onPrint,
  className = '',
}) => {
  const [layoutMode, setLayoutMode] = useState<'thermal' | 'a4'>(initialLayout);
  const [activeSettings, setActiveSettings] = useState<CafeSettings | null>(cafeSettings || null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (cafeSettings) {
      setActiveSettings(cafeSettings);
    } else {
      fetchCafeSettings().then((s) => {
        if (s) setActiveSettings(s);
      }).catch(() => {});
    }
  }, [cafeSettings]);

  // Derive tracking URL
  const trackingOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://hangout.restaurant';
  const trackingUrl = `${trackingOrigin}/track/${order.id}${
    order.guest_access_token ? `?token=${order.guest_access_token}` : ''
  }`;

  useEffect(() => {
    QRCode.toDataURL(trackingUrl, {
      width: layoutMode === 'thermal' ? 130 : 160,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating receipt QR code:', err));
  }, [trackingUrl, layoutMode]);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(trackingUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const isPaid = order.payment_status === 'PAID';
  const brandName = activeSettings?.cafe_name || 'HANGOUT';
  const brandTagline = activeSettings?.tagline || 'Shawarma • Murtabak • Starters';
  const brandAddress = activeSettings?.address?.trim() || null;
  const brandPhone = activeSettings?.phone?.trim() || activeSettings?.contact_phone?.trim() || null;
  const gstin = activeSettings?.gst_number?.trim() || null;

  const isGstEnabled = Boolean(order.tax_breakdown?.is_gst_enabled ?? (order.tax_amount > 0));
  const cgstRate = order.tax_breakdown?.cgstRate ?? (order.tax_breakdown?.tax_rate ? order.tax_breakdown.tax_rate / 2 : (order.tax_amount > 0 ? 2.5 : 0));
  const sgstRate = order.tax_breakdown?.sgstRate ?? (order.tax_breakdown?.tax_rate ? order.tax_breakdown.tax_rate / 2 : (order.tax_amount > 0 ? 2.5 : 0));
  const cgstAmount = order.tax_breakdown?.cgstAmount ?? (order.tax_amount > 0 ? Number((order.tax_amount / 2).toFixed(2)) : 0);
  const sgstAmount = order.tax_breakdown?.sgstAmount ?? (order.tax_amount > 0 ? Number((order.tax_amount / 2).toFixed(2)) : 0);

  const formattedDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date(order.created_at).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className={`digital-receipt-container flex flex-col items-center ${className}`}>
      {/* Non-printing Control Header */}
      {showActions && (
        <div className="no-print w-full max-w-xl mb-4 flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-2xl border border-brand-border shadow-sm">
          <div className="flex items-center gap-1.5 bg-brand-warm-white p-1 rounded-xl border border-brand-border text-xs">
            <button
              type="button"
              onClick={() => setLayoutMode('thermal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === 'thermal'
                  ? 'bg-brand-black text-white shadow-sm'
                  : 'text-brand-muted hover:text-brand-black'
              }`}
            >
              80mm Thermal
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('a4')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                layoutMode === 'a4'
                  ? 'bg-brand-black text-white shadow-sm'
                  : 'text-brand-muted hover:text-brand-black'
              }`}
            >
              Standard A4
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              leftIcon={copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedUrl ? 'Link Copied' : 'Copy Link'}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              leftIcon={<Printer className="w-3.5 h-3.5" />}
            >
              Print Receipt
            </Button>
          </div>
        </div>
      )}

      {/* =========================================================================
          80mm THERMAL RECEIPT LAYOUT
         ========================================================================= */}
      {layoutMode === 'thermal' ? (
        <div
          id="printable-receipt"
          className="print-thermal-sheet w-full max-w-[340px] bg-white p-5 font-mono text-[11px] leading-tight text-gray-900 shadow-md border border-gray-200 sm:rounded-xl selection:bg-amber-100"
        >
          {/* Brand Header */}
          <div className="text-center pb-2 border-b border-dashed border-gray-400 space-y-0.5">
            <h2 className="font-bold text-base tracking-wider uppercase">{brandName}</h2>
            <p className="text-[10px] tracking-wide text-gray-600">{brandTagline}</p>
            {brandAddress && <p className="text-[9px] text-gray-500">{brandAddress}</p>}
            {(brandPhone || gstin) && (
              <p className="text-[9px] text-gray-500">
                {[brandPhone ? `Ph: ${brandPhone}` : null, gstin ? `GSTIN: ${gstin}` : null].filter(Boolean).join(' | ')}
              </p>
            )}
          </div>

          {/* Watermark / Demo Badge */}
          <div className="my-1.5 py-0.5 text-center bg-gray-100 border border-dashed border-gray-300 text-[9px] font-bold tracking-wider uppercase text-gray-700">
            *** DEMO TRANSACTION — NO REAL VALUE ***
          </div>

          {/* Reprint Banner if applicable */}
          {(isReprint || reprintCount > 0) && (
            <div className="my-1 py-0.5 text-center bg-amber-50 border border-amber-300 text-[10px] font-bold uppercase text-amber-900">
              *** DUPLICATE REPRINT - COPY #{reprintCount || 1} ***
            </div>
          )}

          {/* Receipt Info */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-0.5 text-[10px]">
            <div className="flex justify-between">
              <span>BILL NO: BILL-{order.order_number}</span>
              <span className="font-bold">ORD #{order.order_number}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>DATE: {formattedDate}</span>
              <span>TIME: {formattedTime}</span>
            </div>
            <div className="flex justify-between">
              <span>CUSTOMER: {order.customer_name_snapshot || 'Guest'}</span>
              <span>PH: {order.customer_mobile_snapshot || 'N/A'}</span>
            </div>
            <div className="flex justify-between font-bold pt-0.5">
              <span>
                TYPE: {order.order_type === 'DINING' ? `DINE-IN (T-${order.table_number_snapshot || 'N/A'})` : 'TAKEAWAY'}
              </span>
              <span>{order.order_type === 'TAKEAWAY' ? (order.pickup_slot_snapshot || 'COUNTER') : 'FLOOR'}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-2 border-b border-dashed border-gray-400">
            <div className="flex justify-between font-bold border-b border-gray-300 pb-1 mb-1 text-[10px]">
              <span className="flex-1">ITEM</span>
              <span className="w-8 text-center">QTY</span>
              <span className="w-12 text-right">RATE</span>
              <span className="w-14 text-right">AMOUNT</span>
            </div>

            <div className="space-y-1.5">
              {order.items?.map((item, idx) => (
                <div key={item.id || idx} className="text-[10px]">
                  <div className="flex justify-between items-start">
                    <span className="flex-1 font-semibold pr-1">
                      {item.is_veg ? '🟢' : '🔴'} {item.item_name_snapshot}
                    </span>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <span className="w-12 text-right">₹{item.unit_price_snapshot.toFixed(2)}</span>
                    <span className="w-14 text-right font-bold">₹{item.total_price.toFixed(2)}</span>
                  </div>
                  {item.variant_name_snapshot && (
                    <div className="text-[9px] text-gray-500 pl-3">
                      Variant: {item.variant_name_snapshot}
                    </div>
                  )}
                  {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                    <div className="text-[9px] text-gray-500 pl-3">
                      Add: {item.addon_names_snapshot.join(', ')}
                    </div>
                  )}
                  {item.special_instructions && (
                    <div className="text-[9px] italic text-gray-500 pl-3">
                      Note: {item.special_instructions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Tax Breakdown */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span>SUBTOTAL:</span>
              <span>₹{order.subtotal.toFixed(2)}</span>
            </div>

            {order.discount_amount > 0 && (
              <div className="flex justify-between font-bold text-gray-700">
                <span>DISCOUNT {order.discount_code ? `(${order.discount_code})` : ''}:</span>
                <span>-₹{order.discount_amount.toFixed(2)}</span>
              </div>
            )}

            {order.tax_amount > 0 && isGstEnabled ? (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>CGST ({cgstRate}%):</span>
                  <span>₹{cgstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>SGST ({sgstRate}%):</span>
                  <span>₹{sgstAmount.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-gray-600">
                <span>GST:</span>
                <span>₹0.00</span>
              </div>
            )}

            <div className="flex justify-between font-bold text-xs pt-1 border-t border-gray-300">
              <span>GRAND TOTAL:</span>
              <span>₹{order.total_amount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between pt-1 border-t border-dotted border-gray-300">
              <span>PAYMENT METHOD:</span>
              <span className="font-bold">{order.payment_method.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between">
              <span>PAYMENT STATUS:</span>
              <span className={`font-bold ${isPaid ? 'text-black' : 'text-gray-700'}`}>
                {isPaid ? 'PAID (DEMO)' : 'UNPAID (PAY AT COUNTER)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>AMOUNT PAID:</span>
              <span>₹{isPaid ? order.total_amount.toFixed(2) : '0.00'}</span>
            </div>
            {!isPaid && (
              <div className="flex justify-between font-bold">
                <span>BALANCE DUE:</span>
                <span>₹{order.total_amount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* QR Code Verification Section */}
          <div className="py-3 text-center border-b border-dashed border-gray-400 space-y-1">
            <div className="text-[9px] uppercase font-bold tracking-wider text-gray-600">
              Scan to Track Order & View Live Bill
            </div>
            {qrDataUrl ? (
              <div className="flex justify-center my-1">
                <img
                  src={qrDataUrl}
                  alt="Order QR Code"
                  className="w-24 h-24 border border-gray-300 p-1 rounded bg-white shadow-xs"
                />
              </div>
            ) : (
              <div className="w-24 h-24 mx-auto border border-gray-300 flex items-center justify-center text-gray-400">
                <QrCode className="w-8 h-8" />
              </div>
            )}
            <div className="text-[8px] text-gray-500 break-all px-2 font-mono">
              Ref: {order.id.slice(0, 18)}...
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-2 text-center text-[9px] text-gray-600 space-y-0.5">
            <p className="font-bold">Thank you for dining with HANGOUT!</p>
            <p>Shawarma crafted fresh to order.</p>
            {order.order_type === 'TAKEAWAY' && (
              <p className="text-[8px] font-semibold text-gray-500 pt-0.5">
                Counter Pickup Only • Please check your order before leaving
              </p>
            )}
          </div>
        </div>
      ) : (
        /* =========================================================================
            STANDARD A4 INVOICE LAYOUT
           ========================================================================= */
        <div
          id="printable-receipt"
          className="print-a4-sheet w-full max-w-2xl bg-white p-8 font-sans text-xs leading-relaxed text-gray-800 shadow-md border border-gray-200 rounded-2xl"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-yellow bg-brand-charcoal px-2.5 py-1 rounded-md inline-block mb-1.5">
                Tax Invoice / Digital Bill
              </span>
              <h1 className="font-heading font-black text-2xl text-brand-black">{brandName}</h1>
              <p className="text-xs text-brand-muted">{brandTagline}</p>
              {brandAddress && <p className="text-[11px] text-gray-500 mt-1">{brandAddress}</p>}
              {(brandPhone || gstin) && (
                <p className="text-[11px] text-gray-500">
                  {[brandPhone ? `Ph: ${brandPhone}` : null, gstin ? `GSTIN: ${gstin}` : null].filter(Boolean).join(' | ')}
                </p>
              )}
            </div>

            <div className="text-right space-y-1">
              <span className="font-mono text-sm font-extrabold text-brand-black block">
                BILL #{order.order_number}
              </span>
              <span className="text-[11px] text-gray-500 block">Date: {formattedDate} {formattedTime}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block bg-gray-100 text-gray-700">
                {isPaid ? 'PAID (DEMO)' : 'PAY AT COUNTER'}
              </span>
              {(isReprint || reprintCount > 0) && (
                <span className="block text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mt-1">
                  REPRINT COPY #{reprintCount || 1}
                </span>
              )}
            </div>
          </div>

          {/* Watermark Banner */}
          <div className="my-3 py-1 text-center bg-gray-50 border border-dashed border-gray-300 rounded text-[10px] font-bold uppercase text-gray-600 tracking-wider">
            *** DEMO TRANSACTION — FOR DEMONSTRATION PURPOSES ONLY ***
          </div>

          {/* Customer & Fulfillment Info */}
          <div className="grid grid-cols-2 gap-4 py-4 border-b border-gray-200 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block">Customer Information</span>
              <p className="font-bold text-brand-black mt-0.5">{order.customer_name_snapshot || 'Guest Customer'}</p>
              <p className="text-gray-600">Mobile: {order.customer_mobile_snapshot || 'N/A'}</p>
              {order.customer_email_snapshot && <p className="text-gray-600">Email: {order.customer_email_snapshot}</p>}
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-gray-400 block">Fulfillment Details</span>
              <p className="font-bold text-brand-black mt-0.5">
                {order.order_type === 'DINING'
                  ? `Dine-In • Table ${order.table_number_snapshot || 'Assigned'}`
                  : `Takeaway • ${order.pickup_slot_snapshot || 'Immediate Counter Collection'}`}
              </p>
              <p className="text-gray-600">Payment: {order.payment_method.replace(/_/g, ' ')}</p>
              <p className="text-gray-600">Order ID: <span className="font-mono text-[11px]">{order.id}</span></p>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="py-4">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-300 text-[10px] font-bold uppercase text-gray-500 bg-gray-50">
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Item Description</th>
                  <th className="py-2 px-3 text-center">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Rate</th>
                  <th className="py-2 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {order.items?.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-2 px-3 text-gray-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-brand-black flex items-center gap-1.5">
                        <span>{item.is_veg ? '🟢' : '🔴'}</span>
                        <span>{item.item_name_snapshot}</span>
                      </div>
                      {item.variant_name_snapshot && (
                        <p className="text-[11px] text-gray-500 pl-4">Variant: {item.variant_name_snapshot}</p>
                      )}
                      {item.addon_names_snapshot && item.addon_names_snapshot.length > 0 && (
                        <p className="text-[11px] text-gray-500 pl-4">Add-ons: {item.addon_names_snapshot.join(', ')}</p>
                      )}
                      {item.special_instructions && (
                        <p className="text-[11px] italic text-amber-800 pl-4">Note: {item.special_instructions}</p>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                    <td className="py-2 px-3 text-right">₹{item.unit_price_snapshot.toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-brand-black">₹{item.total_price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation & QR Row */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-200">
            {/* Scannable Verification Box */}
            <div className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 border border-gray-200">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Order QR Code"
                  className="w-20 h-20 border border-gray-300 p-1 rounded bg-white shrink-0"
                />
              ) : (
                <div className="w-20 h-20 border border-gray-300 rounded bg-white flex items-center justify-center shrink-0">
                  <QrCode className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="space-y-1 text-[11px]">
                <strong className="font-bold text-brand-black block">Live Order Verification</strong>
                <p className="text-gray-500 text-[10px] leading-snug">
                  Scan to view live kitchen progress, receipt digital copy, and delivery status.
                </p>
                <span className="font-mono text-[9px] text-gray-400 block break-all">
                  Token: {order.guest_access_token ? order.guest_access_token.slice(0, 16) + '...' : 'Verified'}
                </span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1.5 text-xs text-right">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>

              {order.discount_amount > 0 && (
                <div className="flex justify-between font-bold text-emerald-700">
                  <span>Discount {order.discount_code ? `(${order.discount_code})` : ''}:</span>
                  <span>-₹{order.discount_amount.toFixed(2)}</span>
                </div>
              )}

              {order.tax_amount > 0 && isGstEnabled ? (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>CGST ({cgstRate}%):</span>
                    <span>₹{cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>SGST ({sgstRate}%):</span>
                    <span>₹{sgstAmount.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-gray-500">
                  <span>GST:</span>
                  <span>₹0.00</span>
                </div>
              )}

              <div className="flex justify-between font-heading font-extrabold text-sm text-brand-black pt-2 border-t border-gray-300">
                <span>Final Payable Amount:</span>
                <span>₹{order.total_amount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-[11px] text-gray-600 pt-1">
                <span>Amount Paid:</span>
                <span className="font-bold">₹{isPaid ? order.total_amount.toFixed(2) : '0.00'}</span>
              </div>
              {!isPaid && (
                <div className="flex justify-between text-[11px] font-bold text-amber-900">
                  <span>Balance Due at Counter:</span>
                  <span>₹{order.total_amount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[10px] text-gray-500 space-y-0.5">
            <p className="font-bold text-gray-700">Thank you for dining with HANGOUT!</p>
            <p>Premium Shawarma Destination • All preparations freshly made with 100% authentic recipe</p>
            <p className="text-[9px] text-gray-400">This is a computer-generated tax invoice for client demonstration.</p>
          </div>
        </div>
      )}

      {/* Embedded Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: ${layoutMode === 'thermal' ? '80mm' : '100%'};
            max-width: ${layoutMode === 'thermal' ? '80mm' : '100%'};
            margin: 0;
            padding: ${layoutMode === 'thermal' ? '4mm' : '10mm'};
            box-shadow: none !important;
            border: none !important;
          }
          @page {
            size: ${layoutMode === 'thermal' ? '80mm auto' : 'A4'};
            margin: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
