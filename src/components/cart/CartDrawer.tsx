import React from 'react';
import { Drawer } from '../common/Drawer';
import { useCart } from '../../context/CartContext';
import { useOrderMode } from '../../context/OrderModeContext';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { VegIndicator, NonVegIndicator } from '../common/Badge';
import {
  Trash2,
  Minus,
  Plus,
  ShoppingBag,
  Utensils,
  ArrowRight,
  AlertTriangle,
  QrCode,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CartDrawerProps {
  onOpenTableSelector: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onOpenTableSelector }) => {
  const {
    activeCart,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeItem,
    subtotal,
    gstAmount,
    grandTotal,
    diningItemCount,
    takeawayItemCount,
  } = useCart();

  const { mode, setMode, currentTable, takeawayNotice } = useOrderMode();
  const navigate = useNavigate();

  const handleProceedToSummary = () => {
    closeCart();
    navigate('/checkout');
  };

  return (
    <Drawer
      isOpen={isCartOpen}
      onClose={closeCart}
      title={
        <div className="flex items-center gap-2">
          <span className="font-heading font-extrabold text-xl text-brand-black">Your Cart</span>
          <span className="text-xs bg-brand-yellow px-2 py-0.5 rounded-full font-bold text-brand-black">
            {activeCart.length} {activeCart.length === 1 ? 'item' : 'items'}
          </span>
        </div>
      }
      subtitle={
        <p className="text-xs text-brand-muted">
          Review your {mode === 'dining' ? 'dine-in' : 'self-pickup'} selection before finalizing.
        </p>
      }
      footer={
        activeCart.length > 0 ? (
          <div className="space-y-3">
            {/* Price Breakdown */}
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-brand-charcoal">
                <span>Subtotal</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-brand-muted">
                <span>GST (5% Configured)</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-heading font-extrabold text-base text-brand-black pt-2 border-t border-brand-border">
                <span>Total Amount</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Missing table warning if dining */}
            {mode === 'dining' && !currentTable && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center justify-between text-xs text-amber-900">
                <span className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  Table not selected yet
                </span>
                <button
                  onClick={onOpenTableSelector}
                  className="font-bold underline hover:text-black"
                >
                  Choose Table
                </button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  closeCart();
                  navigate('/cart');
                }}
              >
                Cart
              </Button>
              <Button
                variant="primary"
                size="md"
                className="flex-1"
                onClick={handleProceedToSummary}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Checkout
              </Button>
            </div>
          </div>
        ) : null
      }
    >
      <div className="space-y-4">
        {/* Mode Switcher Tabs Inside Drawer */}
        <div className="bg-brand-warm-white p-1 rounded-2xl border border-brand-border flex items-center gap-1">
          <button
            onClick={() => setMode('dining')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-heading font-bold transition-all ${
              mode === 'dining'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Dining</span>
            {diningItemCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  mode === 'dining' ? 'bg-brand-yellow text-brand-black' : 'bg-gray-200 text-black'
                }`}
              >
                {diningItemCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setMode('takeaway')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-heading font-bold transition-all ${
              mode === 'takeaway'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Self-Pickup</span>
            {takeawayItemCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  mode === 'takeaway' ? 'bg-brand-yellow text-brand-black' : 'bg-gray-200 text-black'
                }`}
              >
                {takeawayItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Mode Status Pill / Notice */}
        {mode === 'dining' ? (
          <div className="p-3 rounded-xl bg-brand-soft-yellow/50 border border-brand-yellow/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-brand-black" />
              <span className="font-semibold text-brand-black">
                {currentTable ? `Assigned to Table ${currentTable.table_number}` : 'No table assigned'}
              </span>
            </div>
            <button
              onClick={onOpenTableSelector}
              className="text-xs font-bold text-brand-black underline"
            >
              {currentTable ? 'Change' : 'Select'}
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-brand-charcoal text-white text-xs border border-brand-charcoal space-y-1">
            <div className="flex items-center gap-1.5 text-brand-yellow font-bold">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Self-Pickup Order</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed font-sans">{takeawayNotice}</p>
          </div>
        )}

        {/* Cart Item List */}
        {activeCart.length === 0 ? (
          <EmptyState
            icon="cart"
            title={`Your ${mode === 'dining' ? 'Dining' : 'Takeaway'} Cart is Empty`}
            description={`Add delicious items from the menu to build your ${
              mode === 'dining' ? 'table dine-in order' : 'self-pickup order'
            }.`}
            actionText="Explore Menu"
            onAction={() => {
              closeCart();
              navigate('/menu');
            }}
          />
        ) : (
          <div className="space-y-3">
            {activeCart.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-white rounded-2xl border border-brand-border/70 flex gap-3 shadow-card-subtle"
              >
                {/* Thumbnail */}
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-brand-warm-white shrink-0 relative">
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

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-heading font-bold text-sm text-brand-black truncate">
                      {item.menuItem.name}
                    </h4>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-brand-muted hover:text-red-500 transition-colors p-0.5"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Variant / Addon details */}
                  <div className="text-[11px] text-brand-muted space-y-0.5 my-1">
                    {item.selectedVariant && (
                      <p>
                        Option: <span className="font-medium text-brand-charcoal">{item.selectedVariant.name}</span>
                      </p>
                    )}
                    {item.selectedAddons.length > 0 && (
                      <p>
                        Extras:{' '}
                        <span className="font-medium text-brand-charcoal">
                          {item.selectedAddons.map((a) => a.name).join(', ')}
                        </span>
                      </p>
                    )}
                    {item.specialInstructions && (
                      <p className="italic text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded text-[10px]">
                        Note: {item.specialInstructions}
                      </p>
                    )}
                  </div>

                  {/* Bottom Row: Quantity Stepper & Price */}
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-brand-border/40">
                    <span className="font-heading font-bold text-xs text-brand-black">
                      ₹{item.totalPrice.toFixed(0)}
                    </span>

                    <div className="flex items-center border border-brand-border rounded-lg bg-brand-warm-white">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 flex items-center justify-center text-brand-black hover:bg-white rounded-l transition-colors"
                        aria-label="Decrease"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-brand-black">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 flex items-center justify-center text-brand-black hover:bg-white rounded-r transition-colors"
                        aria-label="Increase"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
};

