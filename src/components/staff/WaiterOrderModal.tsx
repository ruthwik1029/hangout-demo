import React, { useState, useMemo } from 'react';
import { CafeTable, MenuItem, MenuCategory, Order } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  createWaiterOrder,
  addItemsToExistingOrder,
  calculateOrderTaxes,
  roundMoney,
} from '../../lib/supabase';
import {
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  Search,
  CheckCircle2,
  Users,
} from 'lucide-react';

interface WaiterOrderModalProps {
  table: CafeTable | null;
  existingOrder?: Order | null;
  isOpen: boolean;
  onClose: () => void;
  menuItems: MenuItem[];
  categories: MenuCategory[];
  onOrderCreated: (order: Order) => void;
}

interface SelectedOrderItem {
  id: string;
  menuItem: MenuItem;
  selectedVariantName?: string;
  selectedAddonNames: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
}

export const WaiterOrderModal: React.FC<WaiterOrderModalProps> = ({
  table,
  existingOrder,
  isOpen,
  onClose,
  menuItems,
  categories,
  onOrderCreated,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [guestCount, setGuestCount] = useState<number>(table?.guest_count || 2);
  const [customerName, setCustomerName] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<SelectedOrderItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter available menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      if (!item.is_available || item.is_archived) return false;
      if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [menuItems, selectedCategory, searchQuery]);

  // Add Item to Order Cart
  const handleAddItem = (item: MenuItem) => {
    const defaultVariant = item.variants?.find((v) => v.is_default);
    const unitPrice = roundMoney((item.base_price ?? item.price ?? 0) + (defaultVariant?.price_delta || 0));

    const existingIdx = selectedItems.findIndex(
      (si) =>
        si.menuItem.id === item.id &&
        si.selectedVariantName === defaultVariant?.name &&
        si.selectedAddonNames.length === 0
    );

    if (existingIdx >= 0) {
      const updated = [...selectedItems];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].totalPrice = roundMoney(
        updated[existingIdx].unitPrice * updated[existingIdx].quantity
      );
      setSelectedItems(updated);
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          id: 'draft_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 5),
          menuItem: item,
          selectedVariantName: defaultVariant?.name,
          selectedAddonNames: [],
          quantity: 1,
          unitPrice,
          totalPrice: unitPrice,
          specialInstructions: '',
        },
      ]);
    }
  };

  const handleUpdateQty = (idx: number, delta: number) => {
    const updated = [...selectedItems];
    const newQty = updated[idx].quantity + delta;
    if (newQty <= 0) {
      updated.splice(idx, 1);
    } else {
      updated[idx].quantity = newQty;
      updated[idx].totalPrice = roundMoney(updated[idx].unitPrice * newQty);
    }
    setSelectedItems(updated);
  };

  const handleRemoveItem = (idx: number) => {
    const updated = [...selectedItems];
    updated.splice(idx, 1);
    setSelectedItems(updated);
  };

  // Live order calculations
  const subtotal = useMemo(() => {
    return roundMoney(selectedItems.reduce((acc, it) => acc + it.totalPrice, 0));
  }, [selectedItems]);

  const taxCalculation = useMemo(() => {
    return calculateOrderTaxes(subtotal, 0, {
      id: 'cfg',
      is_gst_enabled: true,
      default_tax_rate: 5.0,
      cgst_rate: 2.5,
      sgst_rate: 2.5,
      igst_rate: 5.0,
      is_tax_inclusive: false,
      gst_number: '29AAAAA0000A1Z5',
      legal_business_name: 'HANGOUT HOSPITALITY LLP',
    });
  }, [subtotal]);

  const handleSubmit = async () => {
    if (!table) return;
    if (selectedItems.length === 0) {
      showToast({
        type: 'warning',
        title: 'Empty Order',
        message: 'Please add at least one item to the table order.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (existingOrder) {
        // Append items to active order
        const rawNewItems = selectedItems.map((si) => ({
          menuItemId: si.menuItem.id,
          variantName: si.selectedVariantName,
          addonNames: si.selectedAddonNames,
          quantity: si.quantity,
          specialInstructions: si.specialInstructions,
        }));

        const updatedOrder = await addItemsToExistingOrder(
          existingOrder.id,
          rawNewItems,
          currentUser?.full_name || 'Staff'
        );

        showToast({
          type: 'success',
          title: 'Items Added',
          message: `Added ${selectedItems.length} items to Order #${updatedOrder.order_number}`,
        });
        onOrderCreated(updatedOrder);
        onClose();
      } else {
        // Create fresh waiter order
        const rawItems = selectedItems.map((si) => ({
          menuItemId: si.menuItem.id,
          variantName: si.selectedVariantName,
          addonNames: si.selectedAddonNames,
          quantity: si.quantity,
          specialInstructions: si.specialInstructions,
        }));

        const newOrder = await createWaiterOrder({
          tableId: table.id,
          guestCount: Math.max(1, guestCount),
          waiterId: currentUser?.id || 'u-waiter-01',
          waiterName: currentUser?.full_name || 'Floor Waiter',
          customerName: customerName.trim() || undefined,
          items: rawItems,
          notes: notes.trim() || undefined,
        });

        showToast({
          type: 'success',
          title: 'Order Dispatched to Kitchen',
          message: `Table ${table.table_number} • Order #${newOrder.order_number} created`,
        });
        onOrderCreated(newOrder);
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      showToast({
        type: 'error',
        title: 'Order Submission Failed',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!table) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        existingOrder
          ? `Add Items to Table ${table.table_number} (${existingOrder.order_number})`
          : `Create Dining Order • Table ${table.table_number}`
      }
      size="xl"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-h-[75vh]">
        {/* Left Column: Menu Item Browser (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-4 border-b lg:border-b-0 lg:border-r border-brand-border lg:pr-5">
          {/* Guest Info Bar (Only for new order) */}
          {!existingOrder && (
            <div className="grid grid-cols-2 gap-3 bg-brand-warm-white p-3 rounded-2xl border border-brand-border/60">
              <div>
                <label className="block text-[11px] font-heading font-bold text-brand-black mb-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>Number of Guests:</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={table.seating_capacity || 10}
                  value={guestCount}
                  onChange={(e) => setGuestCount(parseInt(e.target.value) || 1)}
                  className="w-full text-xs p-2 rounded-xl border border-brand-border bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-heading font-bold text-brand-black mb-1">
                  Guest Name (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. John / Table Party"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs p-2 rounded-xl border border-brand-border bg-white"
                />
              </div>
            </div>
          )}

          {/* Search & Category Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-brand-muted" />
              <input
                type="text"
                placeholder="Search food & drinks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-brand-border outline-none focus:border-brand-black"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-xl text-[11px] font-heading font-bold transition-colors whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-brand-black text-brand-yellow'
                    : 'bg-white text-brand-charcoal border border-brand-border'
                }`}
              >
                All Items
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-heading font-bold transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id
                      ? 'bg-brand-black text-brand-yellow'
                      : 'bg-white text-brand-charcoal border border-brand-border'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items List */}
          <div className="flex-1 overflow-y-auto max-h-72 space-y-2 pr-1">
            {filteredMenuItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl border border-brand-border hover:border-brand-black/40 bg-white flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-3.5 h-3.5 rounded-sm border shrink-0 flex items-center justify-center text-[8px] font-black ${
                      item.is_veg
                        ? 'border-emerald-600 text-emerald-600'
                        : 'border-red-600 text-red-600'
                    }`}
                  >
                    ●
                  </span>
                  <div>
                    <p className="font-heading font-bold text-xs text-brand-black">{item.name}</p>
                    <p className="text-[10px] text-brand-muted line-clamp-1">{item.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-xs text-brand-black">
                    ₹{(item.base_price ?? item.price ?? 0).toFixed(2)}
                  </span>
                  <button
                    onClick={() => handleAddItem(item)}
                    className="p-1.5 rounded-lg bg-brand-yellow hover:bg-brand-yellow/80 text-brand-black font-bold text-xs flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Order Basket & Bill Breakdown (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-brand-border pb-2 mb-3">
              <span className="font-heading font-bold text-xs text-brand-black uppercase tracking-wider">
                Order Items ({selectedItems.length})
              </span>
              <span className="text-[11px] font-mono font-bold text-brand-muted">
                {table.section} • Table {table.table_number}
              </span>
            </div>

            {selectedItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-brand-muted border-2 border-dashed border-brand-border rounded-2xl">
                <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No items added yet</p>
                <p className="text-[10px] mt-0.5">Click "Add" on any dish to build the table ticket</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {selectedItems.map((si, idx) => (
                  <div
                    key={si.id}
                    className="p-2.5 rounded-xl border border-brand-border bg-white text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-brand-black truncate">{si.menuItem.name}</p>
                      {si.selectedVariantName && (
                        <p className="text-[10px] text-brand-muted">Variant: {si.selectedVariantName}</p>
                      )}
                      <p className="font-mono text-[11px] font-semibold text-brand-charcoal">
                        ₹{si.unitPrice.toFixed(2)} each
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-brand-border rounded-lg bg-brand-warm-white">
                        <button
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="p-1 hover:bg-brand-border rounded-l"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-mono font-bold text-xs">{si.quantity}</span>
                        <button
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="p-1 hover:bg-brand-border rounded-r"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-red-500 hover:text-red-700"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes & Special Prep */}
          <div>
            <label className="block text-[11px] font-heading font-bold text-brand-black mb-1">
              Table Preparation Instructions (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Serve drinks first, extra spicy, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full text-xs p-2 rounded-xl border border-brand-border outline-none focus:border-brand-black"
            />
          </div>

          {/* Bill Total & Submit Button */}
          <div className="p-3 bg-brand-warm-white rounded-2xl border border-brand-border space-y-2">
            <div className="flex items-center justify-between text-xs text-brand-muted">
              <span>Subtotal:</span>
              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-brand-muted">
              <span>GST (5% CGST + SGST):</span>
              <span className="font-mono">₹{taxCalculation.taxAmount.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-brand-border flex items-center justify-between text-sm font-bold text-brand-black">
              <span>Grand Total:</span>
              <span className="font-mono text-base font-black">
                ₹{taxCalculation.totalPayable.toFixed(2)}
              </span>
            </div>

            <Button
              variant="primary"
              size="md"
              className="w-full mt-2"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedItems.length === 0}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              {isSubmitting
                ? 'Submitting...'
                : existingOrder
                ? `Add to Order (₹${taxCalculation.totalPayable.toFixed(2)})`
                : `Submit Order to Kitchen (₹${taxCalculation.totalPayable.toFixed(2)})`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
