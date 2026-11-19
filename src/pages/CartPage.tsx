import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useOrderMode } from '../context/OrderModeContext';
import { useCustomer } from '../context/CustomerContext';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { VegIndicator, NonVegIndicator } from '../components/common/Badge';
import {
  UtensilsCrossed,
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  ArrowLeft,
  User,
  AlertCircle,
  QrCode,
  FileText,
  Clock,
} from 'lucide-react';

interface CartPageProps {
  onOpenTableSelector: () => void;
}

export const CartPage: React.FC<CartPageProps> = ({ onOpenTableSelector }) => {
  const {
    activeCart,
    updateQuantity,
    removeItem,
    clearActiveCart,
    subtotal,
    gstAmount,
    grandTotal,
    diningItemCount,
    takeawayItemCount,
  } = useCart();

  const { mode, setMode, currentTable, takeawayNotice } = useOrderMode();
  const { currentCustomer, isAuthenticated, openRegisterModal } = useCustomer();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Back and Title */}
      <div className="flex items-center justify-between border-b border-brand-border pb-4">
        <button
          onClick={() => navigate('/menu')}
          className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Menu</span>
        </button>

        <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">
          Order Summary Foundation
        </span>
      </div>

      {/* Mode Isolation Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-brand-border shadow-card-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setMode('dining')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-heading font-bold transition-all ${
              mode === 'dining'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'bg-brand-warm-white text-brand-muted hover:text-brand-black'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4" />
            <span>Dining Cart ({diningItemCount})</span>
          </button>

          <button
            onClick={() => setMode('takeaway')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-heading font-bold transition-all ${
              mode === 'takeaway'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'bg-brand-warm-white text-brand-muted hover:text-brand-black'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Takeaway Cart ({takeawayItemCount})</span>
          </button>
        </div>

        <span className="text-[11px] text-brand-muted hidden sm:inline">
          {mode === 'dining' ? 'Dining items are isolated to your table' : 'Pickup items are isolated to counter'}
        </span>
      </div>

      {/* Notice according to active mode */}
      {mode === 'takeaway' ? (
        <div className="p-4 rounded-2xl bg-brand-charcoal text-white text-xs border border-brand-charcoal flex items-start gap-3">
          <ShoppingBag className="w-5 h-5 text-brand-yellow shrink-0 mt-0.5" />
          <div>
            <span className="font-heading font-bold text-brand-yellow block mb-0.5">
              Pickup Only Order Notice:
            </span>
            <p className="text-gray-300 leading-relaxed font-sans">{takeawayNotice}</p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-brand-soft-yellow/50 border border-brand-yellow/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5 font-heading font-bold text-brand-black">
            <QrCode className="w-5 h-5" />
            <span>
              {currentTable
                ? `Table ${currentTable.table_number} (${currentTable.section})`
                : 'No table assigned for this Dine-In session.'}
            </span>
          </div>
          <button
            onClick={onOpenTableSelector}
            className="font-bold underline text-brand-black hover:text-amber-900"
          >
            {currentTable ? 'Change Table' : 'Select Table'}
          </button>
        </div>
      )}

      {/* Main Order Content */}
      {activeCart.length === 0 ? (
        <EmptyState
          icon="cart"
          title={`Your ${mode === 'dining' ? 'Dining' : 'Takeaway'} Cart is Empty`}
          description={`You do not have any items in your ${
            mode === 'dining' ? 'dining table cart' : 'takeaway pickup cart'
          }. Add some gourmet bites or single-origin brews.`}
          actionText="Browse Menu"
          onAction={() => navigate('/menu')}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Items list */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-bold text-lg text-brand-black">
                Review Items ({activeCart.length})
              </h2>
              <button
                onClick={clearActiveCart}
                className="text-xs text-red-600 hover:text-red-700 font-semibold"
              >
                Clear Cart
              </button>
            </div>

            <div className="space-y-3">
              {activeCart.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-white rounded-2xl border border-brand-border flex gap-4 shadow-card-subtle"
                >
                  <div className="w-20 h-20 rounded-xl overflow-hidden bg-brand-warm-white shrink-0 relative">
                    <img
                      src={item.menuItem.image_url}
                      alt={item.menuItem.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1">
                      {item.menuItem.is_veg ? (
                        <VegIndicator size="sm" />
                      ) : (
                        <NonVegIndicator size="sm" />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-heading font-bold text-base text-brand-black truncate">
                        {item.menuItem.name}
                      </h3>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-brand-muted hover:text-red-600 transition-colors p-1"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="text-xs text-brand-muted space-y-0.5 my-1">
                      {item.selectedVariant && (
                        <p>
                          Option: <span className="text-brand-black font-medium">{item.selectedVariant.name}</span>
                        </p>
                      )}
                      {item.selectedAddons.length > 0 && (
                        <p>
                          Extras: <span className="text-brand-black font-medium">{item.selectedAddons.map((a) => a.name).join(', ')}</span>
                        </p>
                      )}
                      {item.specialInstructions && (
                        <p className="italic text-amber-900 bg-amber-50 px-2 py-0.5 rounded text-[11px] mt-1">
                          Note: {item.specialInstructions}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-brand-border/40">
                      <div className="flex items-center border border-brand-border rounded-xl bg-brand-warm-white">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-brand-black hover:bg-white rounded-l transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-brand-black">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-brand-black hover:bg-white rounded-r transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="font-heading font-extrabold text-base text-brand-black">
                        ₹{item.totalPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Customer & Bill Summary */}
          <div className="lg:col-span-5 space-y-6">
            {/* Customer Check-In Card */}
            <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Customer Profile
                </span>
                {isAuthenticated ? (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Active Session
                  </span>
                ) : (
                  <button
                    onClick={openRegisterModal}
                    className="text-xs font-bold text-brand-black underline"
                  >
                    Check In Now
                  </button>
                )}
              </div>

              {isAuthenticated && currentCustomer ? (
                <div className="p-3 rounded-2xl bg-brand-warm-white border border-brand-border">
                  <p className="font-heading font-bold text-sm text-brand-black">
                    {currentCustomer.full_name}
                  </p>
                  <p className="text-xs text-brand-muted mt-0.5">
                    +91 {currentCustomer.mobile_number}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-brand-soft-yellow/40 border border-brand-yellow/50 text-xs text-brand-charcoal flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-brand-black shrink-0 mt-0.5" />
                  <p>
                    Check in with your name and mobile number to associate this order and receive ready notifications.
                  </p>
                </div>
              )}
            </div>

            {/* Bill Breakdown */}
            <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
              <h3 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-black" />
                <span>Bill Breakdown</span>
              </h3>

              <div className="space-y-2 text-xs text-brand-charcoal">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-brand-muted">
                  <span>GST (5% Configured)</span>
                  <span className="font-medium">₹{gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-heading font-extrabold text-lg text-brand-black pt-3 border-t border-brand-border">
                  <span>Total Amount</span>
                  <span>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Batch 01 Architecture Notice */}
              <div className="p-3.5 rounded-2xl bg-brand-charcoal text-white text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-brand-yellow font-bold">
                  <Clock className="w-4 h-4" />
                  <span>Batch 01 Foundation Scope</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed font-sans">
                  The order summary and customer session architecture is complete. Full payment gateway integration and kitchen dispatch belong to the next batch.
                </p>
              </div>

              {/* Action Button */}
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => {
                  if (!isAuthenticated) {
                    openRegisterModal();
                  } else {
                    alert('Order Summary Verified! In Batch 02, this proceeds to checkout & payments.');
                  }
                }}
              >
                {isAuthenticated ? 'Order Ready for Dispatch (Batch 02)' : 'Check In to Proceed'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
