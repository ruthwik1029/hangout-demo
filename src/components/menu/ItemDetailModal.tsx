import React, { useState } from 'react';
import { MenuItem, MenuItemAddon, MenuItemVariant } from '../../types';
import { Modal } from '../common/Modal';
import { VegIndicator, NonVegIndicator } from '../common/Badge';
import { useCart } from '../../context/CartContext';
import { useOrderMode } from '../../context/OrderModeContext';
import { Button } from '../common/Button';
import { Clock, Minus, Plus, ShoppingBag, Utensils, Check } from 'lucide-react';

interface ItemDetailModalProps {
  item: MenuItem | null;
  isOpen: boolean;
  onClose: () => void;
}

const ItemDetailContent: React.FC<{ item: MenuItem; onClose: () => void }> = ({
  item,
  onClose,
}) => {
  const { addItem } = useCart();
  const { mode } = useOrderMode();

  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<MenuItemVariant | undefined>(() => {
    if (item.variants && item.variants.length > 0) {
      return item.variants.find((v) => v.is_default) || item.variants[0];
    }
    return undefined;
  });
  const [selectedAddons, setSelectedAddons] = useState<MenuItemAddon[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Toggle addon
  const handleToggleAddon = (addon: MenuItemAddon) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((a) => a.id === addon.id);
      if (exists) {
        return prev.filter((a) => a.id !== addon.id);
      }
      return [...prev, addon];
    });
  };

  // Calculate unit price and total price
  const variantDelta = selectedVariant?.price_delta || 0;
  const addonsTotal = selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);
  const unitPrice = Number(item.base_price) + Number(variantDelta) + Number(addonsTotal);
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    addItem(item, quantity, selectedVariant, selectedAddons, specialInstructions);
    onClose();
  };

  return (
    <div className="-m-6 flex flex-col max-h-[85vh]">
      {/* Hero Image Container */}
      <div className="relative w-full h-56 sm:h-64 bg-brand-charcoal overflow-hidden shrink-0">
        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Badges on top */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          {item.is_veg ? <VegIndicator size="md" /> : <NonVegIndicator size="md" />}
          <span className="bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-0.5 rounded-full border border-white/20">
            {item.is_veg ? 'Vegetarian' : 'Non-Vegetarian'}
          </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div>
            <h2 className="font-heading font-extrabold text-2xl text-white drop-shadow-md">
              {item.name}
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-200 mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-brand-yellow" /> {item.preparation_time_mins} mins prep
              </span>
              {item.calories && <span>• {item.calories} kcal</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Customization Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Description */}
        <p className="text-sm text-brand-charcoal leading-relaxed">{item.description}</p>

        {/* Allergens warning if any */}
        {item.allergens && item.allergens.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-brand-muted bg-brand-warm-white p-2.5 rounded-xl border border-brand-border">
            <span className="font-semibold text-brand-black">Contains Allergens:</span>
            <span>{item.allergens.join(', ')}</span>
          </div>
        )}

        {/* Variants Selection (e.g. Size / Milk Base) */}
        {item.variants && item.variants.length > 0 && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-2.5">
              Select Option / Size
            </label>
            <div className="space-y-2">
              {item.variants.map((v) => {
                const isSelected = selectedVariant?.id === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVariant(v)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? 'border-brand-black bg-brand-soft-yellow/50 ring-2 ring-brand-yellow'
                        : 'border-brand-border bg-white hover:border-brand-charcoal/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-brand-black bg-brand-black'
                            : 'border-brand-muted bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-brand-yellow" />}
                      </div>
                      <span className="font-heading font-semibold text-sm text-brand-black">
                        {v.name}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-brand-black">
                      {v.price_delta > 0 ? `+₹${v.price_delta}` : 'Included'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Add-ons Selection */}
        {item.addons && item.addons.length > 0 && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-2.5">
              Add-ons & Extras
            </label>
            <div className="space-y-2">
              {item.addons.map((a) => {
                const isChecked = selectedAddons.some((add) => add.id === a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleToggleAddon(a)}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                      isChecked
                        ? 'border-brand-black bg-brand-soft-yellow/30'
                        : 'border-brand-border bg-white hover:border-brand-charcoal/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isChecked
                            ? 'bg-brand-black border-brand-black text-brand-yellow'
                            : 'bg-white border-brand-border'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="text-sm font-medium text-brand-black">{a.name}</span>
                    </div>
                    <span className="text-xs font-bold text-brand-black">+₹{a.price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Special Instructions */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
            Special Instructions <span className="text-xs text-brand-muted font-normal">(Optional)</span>
          </label>
          <textarea
            rows={2}
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            placeholder="e.g. Extra hot, less sweet, or dressing on the side..."
            className="w-full p-3 text-xs font-sans bg-white border border-brand-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-black transition-all"
          />
        </div>
      </div>

      {/* Modal Bottom Bar */}
      <div className="p-4 sm:p-6 bg-white border-t border-brand-border shrink-0 flex items-center justify-between gap-4 shadow-card-subtle">
        {/* Quantity Stepper */}
        <div className="flex items-center border border-brand-border rounded-xl bg-brand-warm-white p-1">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-black hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            aria-label="Decrease quantity"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center font-heading font-bold text-sm text-brand-black">
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-brand-black hover:bg-white transition-colors"
            aria-label="Increase quantity"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add to Cart Button */}
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={handleAddToCart}
          leftIcon={
            mode === 'dining' ? (
              <Utensils className="w-4 h-4" />
            ) : (
              <ShoppingBag className="w-4 h-4" />
            )
          }
        >
          Add to {mode === 'dining' ? 'Dining' : 'Pickup'} • ₹{totalPrice.toFixed(0)}
        </Button>
      </div>
    </div>
  );
};

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({ item, isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen && Boolean(item)} onClose={onClose} maxWidth="lg" showCloseButton>
      {item && <ItemDetailContent key={item.id} item={item} onClose={onClose} />}
    </Modal>
  );
};
