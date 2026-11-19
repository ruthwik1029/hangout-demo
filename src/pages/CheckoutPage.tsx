import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useOrderMode } from '../context/OrderModeContext';
import { useCustomer } from '../context/CustomerContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { VegIndicator, NonVegIndicator } from '../components/common/Badge';
import { PaymentGatewayModal } from '../components/checkout/PaymentGatewayModal';
import { TableSelectorModal } from '../components/dining/TableSelectorModal';
import { createOrder } from '../lib/supabase';
import { PaymentMethod, PaymentTransaction } from '../types';
import {
  ArrowLeft,
  UtensilsCrossed,
  ShoppingBag,
  QrCode,
  Clock,
  ShieldAlert,
  Tag,
  Check,
  CreditCard,
  Smartphone,
  Banknote,
  Receipt,
  UserCheck,
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const {
    activeCart,
    subtotal,
    discountAmount,
    appliedDiscount,
    applyDiscount,
    removeDiscount,
    taxBreakdown,
    taxAmount,
    grandTotal,
    clearActiveCart,
  } = useCart();

  const { mode, currentTable, takeawayNotice } = useOrderMode();
  const { currentCustomer, setCustomer, registerGuest } = useCustomer();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Modals
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Form Fields
  const [customerName, setCustomerName] = useState(currentCustomer?.full_name || '');
  const [customerMobile, setCustomerMobile] = useState(currentCustomer?.mobile_number || '');
  const [customerEmail, setCustomerEmail] = useState(currentCustomer?.email || '');
  const [specialOrderNote, setSpecialOrderNote] = useState('');

  // Takeaway pickup timing
  const [pickupType, setPickupType] = useState<'asap' | 'scheduled'>('asap');
  const [scheduledTime, setScheduledTime] = useState('15:00');

  // Coupon input
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  // Payment Selection
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('UPI');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper validation
  const cleanMobile = customerMobile.replace(/\D/g, '');
  const isMobileValid =
    (cleanMobile.length === 10 && /^[6-9]\d{9}$/.test(cleanMobile)) ||
    (cleanMobile.length === 12 && cleanMobile.startsWith('91') && /^[6-9]\d{9}$/.test(cleanMobile.slice(2)));

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setIsApplyingCoupon(true);
    await applyDiscount(couponCode.trim());
    setIsApplyingCoupon(false);
    setCouponCode('');
  };

  const validateOrder = (): boolean => {
    if (activeCart.length === 0) {
      showToast({
        type: 'error',
        title: 'Empty Cart',
        message: 'Your cart has no items. Add items before checking out.',
      });
      return false;
    }

    if (mode === 'dining' && !currentTable) {
      showToast({
        type: 'error',
        title: 'Table Required',
        message: 'Please assign a cafe table for this dining order.',
      });
      setIsTableModalOpen(true);
      return false;
    }

    if (!customerName.trim() || customerName.trim().length < 2) {
      showToast({
        type: 'error',
        title: 'Name Required',
        message: 'Please enter your full name.',
      });
      return false;
    }

    if (!isMobileValid) {
      showToast({
        type: 'error',
        title: 'Valid Mobile Number Required',
        message: 'Please enter a valid 10-digit Indian mobile number.',
      });
      return false;
    }

    return true;
  };

  // Process order submission
  const handleProceedToPayment = async () => {
    if (!validateOrder()) return;

    // Ensure customer session exists or save profile
    const normalizedMobile = cleanMobile.length === 12 ? cleanMobile.slice(2) : cleanMobile;
    let customerId = currentCustomer?.id;
    if (!customerId) {
      const saved = await registerGuest(customerName.trim(), normalizedMobile, customerEmail.trim() || undefined);
      if (saved) {
        customerId = saved.id;
      }
    } else if (currentCustomer) {
      setCustomer({
        ...currentCustomer,
        full_name: customerName.trim(),
        mobile_number: normalizedMobile,
        email: customerEmail.trim() || undefined,
      });
    }

    // For online methods (UPI or CARD), open simulated gateway modal
    if (selectedPaymentMethod === 'UPI' || selectedPaymentMethod === 'CARD') {
      setIsPaymentModalOpen(true);
    } else {
      // Pay at Counter / After Meal (CASH)
      await submitFinalOrder({
        method: 'CASH',
        paymentStatus: 'UNPAID',
      });
    }
  };

  const submitFinalOrder = async (opts: {
    method: PaymentMethod;
    paymentStatus: 'PAID' | 'UNPAID';
    transaction?: PaymentTransaction;
  }) => {
    setIsSubmitting(true);
    const normalizedMobile = cleanMobile.length === 12 ? cleanMobile.slice(2) : cleanMobile;

    try {
      const order = await createOrder({
        customerId: currentCustomer?.id,
        customerName: customerName.trim(),
        customerMobile: normalizedMobile,
        customerEmail: customerEmail.trim() || undefined,
        orderType: mode === 'dining' ? 'DINING' : 'TAKEAWAY',
        tableId: mode === 'dining' ? currentTable?.id : undefined,
        tableNumberSnapshot: mode === 'dining' ? currentTable?.table_number : undefined,
        pickupSlotSnapshot:
          mode === 'takeaway'
            ? pickupType === 'asap'
              ? 'ASAP (~15-20 mins)'
              : `Scheduled: ${scheduledTime}`
            : undefined,
        cartItems: activeCart,
        subtotal,
        discountAmount,
        discountCode: appliedDiscount?.code,
        taxAmount,
        taxBreakdown,
        totalAmount: grandTotal,
        paymentMethod: opts.method,
        paymentStatus: opts.paymentStatus,
        notes: specialOrderNote.trim() || undefined,
        initialTransaction: opts.transaction,
      });

      clearActiveCart();
      showToast({
        type: 'success',
        title: 'Order Placed!',
        message: `Order #${order.order_number} has been placed successfully.`,
      });

      navigate(`/order-confirmation/${order.id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to place order';
      showToast({
        type: 'error',
        title: 'Order Placement Failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = async (txn: PaymentTransaction) => {
    setIsPaymentModalOpen(false);
    await submitFinalOrder({
      method: selectedPaymentMethod,
      paymentStatus: 'PAID',
      transaction: txn,
    });
  };

  const handlePaymentFailure = (errorMsg: string) => {
    showToast({
      type: 'error',
      title: 'Payment Simulation Failed',
      message: errorMsg,
    });
  };

  if (activeCart.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="font-heading font-extrabold text-2xl text-brand-black">Your Cart is Empty</h2>
        <p className="text-xs text-brand-muted">Please add some menu items before proceeding to checkout.</p>
        <Link to="/menu">
          <Button variant="primary" size="md">
            Explore Menu
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Back and Title */}
      <div className="flex items-center justify-between border-b border-brand-border pb-4">
        <button
          onClick={() => navigate('/cart')}
          className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Cart</span>
        </button>
        <span className="text-xs font-bold text-brand-black uppercase tracking-wider">
          Secure Cafe Checkout
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Customer Details & Fulfillment Info */}
        <div className="lg:col-span-7 space-y-6">
          {/* Order Mode Badge / Card */}
          <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted flex items-center gap-2">
                {mode === 'dining' ? (
                  <UtensilsCrossed className="w-4 h-4 text-brand-yellow" />
                ) : (
                  <ShoppingBag className="w-4 h-4 text-brand-yellow" />
                )}
                Fulfillment Mode: <span className="text-brand-black">{mode === 'dining' ? 'Dine-In' : 'Self-Pickup'}</span>
              </span>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-soft-yellow text-brand-black">
                {mode === 'dining' ? 'Table Service' : 'Counter Collection'}
              </span>
            </div>

            {mode === 'dining' ? (
              <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-brand-border flex items-center justify-center text-brand-black font-bold">
                    <QrCode className="w-5 h-5 text-brand-black" />
                  </div>
                  <div>
                    <p className="font-heading font-bold text-sm text-brand-black">
                      {currentTable
                        ? `Table ${currentTable.table_number} (${currentTable.section})`
                        : 'No Table Selected'}
                    </p>
                    <p className="text-[11px] text-brand-muted">
                      {currentTable
                        ? `Capacity: ${currentTable.seating_capacity || currentTable.capacity} guests • Orders served directly`
                        : 'Please assign a table for your dine-in session'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsTableModalOpen(true)}
                >
                  {currentTable ? 'Change Table' : 'Select Table'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Strict takeaway notice */}
                <div className="p-4 rounded-2xl bg-brand-charcoal text-white text-xs border border-brand-charcoal flex items-start gap-3">
                  <ShoppingBag className="w-5 h-5 text-brand-yellow shrink-0 mt-0.5" />
                  <div>
                    <span className="font-heading font-bold text-brand-yellow block mb-0.5">
                      Pickup Only Policy:
                    </span>
                    <p className="text-gray-300 leading-relaxed font-sans">{takeawayNotice}</p>
                  </div>
                </div>

                {/* Pickup Time Selection */}
                <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border space-y-3">
                  <span className="text-xs font-bold text-brand-black flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand-black" /> Pickup Timing
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPickupType('asap')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        pickupType === 'asap'
                          ? 'border-brand-black bg-white shadow-sm font-bold text-brand-black'
                          : 'border-brand-border bg-brand-warm-white text-brand-muted'
                      }`}
                    >
                      <span className="block font-heading font-bold">ASAP Pickup</span>
                      <span className="text-[11px] text-brand-muted font-normal">Ready in ~15–20 minutes</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPickupType('scheduled')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        pickupType === 'scheduled'
                          ? 'border-brand-black bg-white shadow-sm font-bold text-brand-black'
                          : 'border-brand-border bg-brand-warm-white text-brand-muted'
                      }`}
                    >
                      <span className="block font-heading font-bold">Schedule for Later</span>
                      <span className="text-[11px] text-brand-muted font-normal">Choose today&apos;s slot</span>
                    </button>
                  </div>

                  {pickupType === 'scheduled' && (
                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-brand-muted uppercase mb-1">
                        Select Collection Time Slot
                      </label>
                      <select
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full p-2.5 bg-white border border-brand-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                      >
                        <option value="13:30">01:30 PM</option>
                        <option value="14:00">02:00 PM</option>
                        <option value="14:30">02:30 PM</option>
                        <option value="15:00">03:00 PM</option>
                        <option value="15:30">03:30 PM</option>
                        <option value="16:00">04:00 PM</option>
                        <option value="17:00">05:00 PM</option>
                        <option value="18:00">06:00 PM</option>
                        <option value="19:00">07:00 PM</option>
                        <option value="20:00">08:00 PM</option>
                        <option value="21:00">09:00 PM</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Customer Contact Details */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-black" />
                <span>Customer Information</span>
              </h3>
              {currentCustomer && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Verified Profile
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-brand-muted font-bold">+91</span>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    maxLength={10}
                    value={customerMobile}
                    onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                    className="w-full pl-11 pr-3 p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    required
                  />
                </div>
                {!isMobileValid && customerMobile.length > 0 && (
                  <p className="text-[11px] text-red-600 mt-1">Must be a valid 10-digit mobile number</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Email Address <span className="text-brand-muted text-[10px] lowercase">(optional for invoice)</span>
              </label>
              <input
                type="email"
                placeholder="rahul@example.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Special Kitchen Instructions / Allergy Notes
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Extra spicy, less ice in cold brews, separate cutlery"
                value={specialOrderNote}
                onChange={(e) => setSpecialOrderNote(e.target.value)}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow"
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-black" />
                <span>Payment Method</span>
              </h3>
              <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                Demo Simulation
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('UPI')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  selectedPaymentMethod === 'UPI'
                    ? 'border-brand-black bg-brand-soft-yellow/20 shadow-sm'
                    : 'border-brand-border bg-brand-warm-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Smartphone className="w-5 h-5 text-brand-black" />
                  {selectedPaymentMethod === 'UPI' && (
                    <div className="w-4 h-4 rounded-full bg-brand-black text-brand-yellow flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-heading font-bold text-xs text-brand-black">UPI Simulation</p>
                  <p className="text-[11px] text-brand-muted">GPay, PhonePe, Paytm</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('CARD')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  selectedPaymentMethod === 'CARD'
                    ? 'border-brand-black bg-brand-soft-yellow/20 shadow-sm'
                    : 'border-brand-border bg-brand-warm-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CreditCard className="w-5 h-5 text-brand-black" />
                  {selectedPaymentMethod === 'CARD' && (
                    <div className="w-4 h-4 rounded-full bg-brand-black text-brand-yellow flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-heading font-bold text-xs text-brand-black">Card Simulation</p>
                  <p className="text-[11px] text-brand-muted">Visa, Mastercard, RuPay</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('CASH')}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                  selectedPaymentMethod === 'CASH'
                    ? 'border-brand-black bg-brand-soft-yellow/20 shadow-sm'
                    : 'border-brand-border bg-brand-warm-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Banknote className="w-5 h-5 text-brand-black" />
                  {selectedPaymentMethod === 'CASH' && (
                    <div className="w-4 h-4 rounded-full bg-brand-black text-brand-yellow flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-heading font-bold text-xs text-brand-black">
                    {mode === 'dining' ? 'Pay After Meal' : 'Pay at Counter'}
                  </p>
                  <p className="text-[11px] text-brand-muted">Cash / POS terminal</p>
                </div>
              </button>
            </div>

            <p className="text-[11px] text-brand-muted">
              {selectedPaymentMethod === 'CASH'
                ? 'Order will be placed with UNPAID status. Settle with staff after dining or during pickup.'
                : 'Interactive simulated payment sandbox. Safe testing without real bank debits.'}
            </p>
          </div>
        </div>

        {/* Right: Order Summary & Bill Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          {/* Order Items Snapshot */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-base text-brand-black">
                Order Summary ({activeCart.length} items)
              </h3>
              <Link to="/cart" className="text-xs font-bold text-brand-black underline">
                Edit Cart
              </Link>
            </div>

            <div className="divide-y divide-brand-border max-h-72 overflow-y-auto pr-1 space-y-2">
              {activeCart.map((item) => (
                <div key={item.id} className="pt-2 first:pt-0 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {item.menuItem.is_veg ? <VegIndicator size="sm" /> : <NonVegIndicator size="sm" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-brand-black truncate">
                        {item.menuItem.name} <span className="text-brand-muted">× {item.quantity}</span>
                      </p>
                      {item.selectedVariant && (
                        <p className="text-[11px] text-brand-muted">Option: {item.selectedVariant.name}</p>
                      )}
                      {item.selectedAddons.length > 0 && (
                        <p className="text-[11px] text-brand-muted">
                          Extras: {item.selectedAddons.map((a) => a.name).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-heading font-bold text-brand-black shrink-0">
                    ₹{item.totalPrice.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Promo Code Input */}
            <div className="pt-3 border-t border-brand-border">
              {appliedDiscount ? (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-emerald-700" />
                    <div>
                      <span className="font-bold text-emerald-900">{appliedDiscount.code}</span>
                      <span className="text-emerald-700 text-[11px] block">
                        Saved ₹{discountAmount.toFixed(2)} ({appliedDiscount.description})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={removeDiscount}
                    className="text-xs font-bold text-red-600 hover:text-red-700 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-brand-muted absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Promo code (e.g. HANGOUT50)"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="w-full pl-9 pr-3 py-2 bg-brand-warm-white border border-brand-border rounded-xl text-xs uppercase font-mono focus:outline-none focus:ring-2 focus:ring-brand-yellow"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    isLoading={isApplyingCoupon}
                  >
                    Apply
                  </Button>
                </form>
              )}
            </div>

            {/* Bill Breakdown */}
            <div className="space-y-2 text-xs text-brand-charcoal pt-3 border-t border-brand-border">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-medium">₹{subtotal.toFixed(2)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount ({appliedDiscount?.code})</span>
                  <span>-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-brand-muted">
                <span>CGST ({taxBreakdown.cgst_rate}%)</span>
                <span>₹{taxBreakdown.cgst_amount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-brand-muted">
                <span>SGST ({taxBreakdown.sgst_rate}%)</span>
                <span>₹{taxBreakdown.sgst_amount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between font-heading font-extrabold text-xl text-brand-black pt-3 border-t border-brand-border">
                <span>Total Payable</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Safety Disclaimer */}
            <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2 text-[11px] text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                Demonstration platform. Online payments run in an isolated simulation sandbox. No real bank accounts are charged.
              </span>
            </div>

            {/* Submit Action */}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isSubmitting}
              onClick={handleProceedToPayment}
            >
              {selectedPaymentMethod === 'CASH'
                ? `Confirm Order (₹${grandTotal.toFixed(2)} - Pay Later)`
                : `Pay ₹${grandTotal.toFixed(2)} via ${selectedPaymentMethod} (Demo)`}
            </Button>
          </div>
        </div>
      </div>

      {/* Table Selector Modal for Dine-In */}
      <TableSelectorModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
      />

      {/* Payment Gateway Simulation Modal */}
      <PaymentGatewayModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        orderId={`temp-ord-${Date.now()}`}
        orderNumber="NEW"
        amount={grandTotal}
        paymentMethod={selectedPaymentMethod}
        onPaymentSuccess={handlePaymentSuccess}
        onPaymentFailure={handlePaymentFailure}
      />
    </div>
  );
};
