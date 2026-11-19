import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  CartItem,
  MenuItem,
  MenuItemAddon,
  MenuItemVariant,
  OrderMode,
  TaxConfiguration,
  TaxBreakdown,
  Discount,
} from '../types';
import { useOrderMode } from './OrderModeContext';
import { useToast } from './ToastContext';
import {
  fetchTaxConfiguration,
  calculateOrderTaxes,
  validateAndApplyDiscount,
  roundMoney,
} from '../lib/supabase';
import { INITIAL_TAX_CONFIG } from '../lib/mockData';

interface CartContextType {
  activeCart: CartItem[];
  diningCart: CartItem[];
  takeawayCart: CartItem[];
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (
    menuItem: MenuItem,
    quantity: number,
    selectedVariant?: MenuItemVariant,
    selectedAddons?: MenuItemAddon[],
    specialInstructions?: string
  ) => void;
  updateQuantity: (cartItemId: string, newQuantity: number) => void;
  removeItem: (cartItemId: string) => void;
  clearActiveCart: () => void;
  activeItemCount: number;
  diningItemCount: number;
  takeawayItemCount: number;
  subtotal: number;
  discountAmount: number;
  appliedDiscount: Discount | null;
  applyDiscount: (code: string) => Promise<{ success: boolean; message: string }>;
  removeDiscount: () => void;
  taxConfig: TaxConfiguration;
  taxBreakdown: TaxBreakdown;
  taxAmount: number;
  gstAmount: number;
  grandTotal: number;
  currentMode: OrderMode;
  refreshTaxConfig: () => Promise<void>;
}

const STORAGE_DINING_CART = 'hangout_dining_cart_v1';
const STORAGE_TAKEAWAY_CART = 'hangout_takeaway_cart_v1';
const STORAGE_APPLIED_DISCOUNT = 'hangout_applied_discount';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode } = useOrderMode();
  const { showToast } = useToast();

  const [diningCart, setDiningCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DINING_CART);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [takeawayCart, setTakeawayCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TAKEAWAY_CART);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [taxConfig, setTaxConfig] = useState<TaxConfiguration>(INITIAL_TAX_CONFIG);

  const [appliedDiscount, setAppliedDiscount] = useState<Discount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_APPLIED_DISCOUNT);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load dynamic tax config from repository
  const refreshTaxConfig = useCallback(async () => {
    const config = await fetchTaxConfiguration();
    setTaxConfig(config);
  }, []);

  useEffect(() => {
    refreshTaxConfig();
  }, [refreshTaxConfig]);

  // Sync carts with localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_DINING_CART, JSON.stringify(diningCart));
  }, [diningCart]);

  useEffect(() => {
    localStorage.setItem(STORAGE_TAKEAWAY_CART, JSON.stringify(takeawayCart));
  }, [takeawayCart]);

  useEffect(() => {
    if (appliedDiscount) {
      localStorage.setItem(STORAGE_APPLIED_DISCOUNT, JSON.stringify(appliedDiscount));
    } else {
      localStorage.removeItem(STORAGE_APPLIED_DISCOUNT);
    }
  }, [appliedDiscount]);

  // Active cart points to dining or takeaway cart depending on current mode
  const activeCart = mode === 'dining' ? diningCart : takeawayCart;

  const setActiveCart = useCallback(
    (updater: (prev: CartItem[]) => CartItem[]) => {
      if (mode === 'dining') {
        setDiningCart(updater);
      } else {
        setTakeawayCart(updater);
      }
    },
    [mode]
  );

  const addItem = useCallback(
    (
      menuItem: MenuItem,
      quantity: number,
      selectedVariant?: MenuItemVariant,
      selectedAddons: MenuItemAddon[] = [],
      specialInstructions?: string
    ) => {
      if (quantity <= 0) return;
      if (!menuItem.is_available) {
        showToast({
          type: 'error',
          title: 'Item Unavailable',
          message: `${menuItem.name} is currently sold out.`,
        });
        return;
      }

      const variantKey = selectedVariant ? selectedVariant.id : 'base';
      const addonKeys = selectedAddons
        .map((a) => a.id)
        .sort()
        .join('-');
      const compositeId = `${menuItem.id}__${variantKey}__${addonKeys}__${mode}`;

      const variantPriceDelta = selectedVariant?.price_delta || 0;
      const addonsSum = selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);
      const unitPrice = roundMoney(Number(menuItem.base_price) + Number(variantPriceDelta) + Number(addonsSum));

      setActiveCart((prevCart) => {
        const existingIndex = prevCart.findIndex((item) => item.id === compositeId);

        if (existingIndex > -1) {
          const updated = [...prevCart];
          const newQty = updated[existingIndex].quantity + quantity;
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: newQty,
            totalPrice: roundMoney(unitPrice * newQty),
            specialInstructions: specialInstructions || updated[existingIndex].specialInstructions,
          };
          return updated;
        }

        const newItem: CartItem = {
          id: compositeId,
          menuItem,
          selectedVariant,
          selectedAddons,
          quantity,
          unitPrice,
          totalPrice: roundMoney(unitPrice * quantity),
          specialInstructions: specialInstructions?.trim() || undefined,
          orderMode: mode,
        };

        return [...prevCart, newItem];
      });

      showToast({
        type: 'success',
        title: `Added to ${mode === 'dining' ? 'Dining' : 'Takeaway'} Cart`,
        message: `${quantity}x ${menuItem.name}`,
      });
    },
    [mode, setActiveCart, showToast]
  );

  const updateQuantity = useCallback(
    (cartItemId: string, newQuantity: number) => {
      setActiveCart((prev) => {
        if (newQuantity <= 0) {
          return prev.filter((item) => item.id !== cartItemId);
        }
        return prev.map((item) => {
          if (item.id === cartItemId) {
            return {
              ...item,
              quantity: newQuantity,
              totalPrice: roundMoney(item.unitPrice * newQuantity),
            };
          }
          return item;
        });
      });
    },
    [setActiveCart]
  );

  const removeItem = useCallback(
    (cartItemId: string) => {
      setActiveCart((prev) => prev.filter((item) => item.id !== cartItemId));
      showToast({
        type: 'info',
        title: 'Item Removed',
        message: 'The item was removed from your cart.',
      });
    },
    [setActiveCart, showToast]
  );

  const clearActiveCart = useCallback(() => {
    setActiveCart(() => []);
    setAppliedDiscount(null);
  }, [setActiveCart]);

  // Counts
  const diningItemCount = useMemo(
    () => diningCart.reduce((total, item) => total + item.quantity, 0),
    [diningCart]
  );

  const takeawayItemCount = useMemo(
    () => takeawayCart.reduce((total, item) => total + item.quantity, 0),
    [takeawayCart]
  );

  const activeItemCount = mode === 'dining' ? diningItemCount : takeawayItemCount;

  // Subtotal with decimal safety
  const subtotal = useMemo(
    () => roundMoney(activeCart.reduce((sum, item) => sum + item.totalPrice, 0)),
    [activeCart]
  );

  // Discount calculation
  const discountAmount = useMemo(() => {
    if (!appliedDiscount || subtotal <= 0) return 0;
    if (subtotal < appliedDiscount.min_order_amount) return 0;

    if (appliedDiscount.discount_type === 'PERCENTAGE') {
      const calc = roundMoney((subtotal * appliedDiscount.discount_value) / 100);
      if (appliedDiscount.max_discount_amount && calc > appliedDiscount.max_discount_amount) {
        return appliedDiscount.max_discount_amount;
      }
      return calc;
    }
    return Math.min(subtotal, appliedDiscount.discount_value);
  }, [appliedDiscount, subtotal]);

  // Tax calculations using dynamic configuration
  const { taxBreakdown, taxAmount, totalPayable } = useMemo(
    () => calculateOrderTaxes(subtotal, discountAmount, taxConfig),
    [subtotal, discountAmount, taxConfig]
  );

  // Apply discount coupon
  const applyDiscount = useCallback(
    async (code: string): Promise<{ success: boolean; message: string }> => {
      const res = await validateAndApplyDiscount(code, subtotal);
      if (res.isValid && res.discount) {
        setAppliedDiscount(res.discount);
        showToast({
          type: 'success',
          title: 'Coupon Applied!',
          message: `Saved ₹${res.discountAmount} with code ${res.discount.code}`,
        });
        return { success: true, message: `Applied code ${res.discount.code}` };
      }
      showToast({
        type: 'error',
        title: 'Coupon Error',
        message: res.error || 'Invalid coupon code',
      });
      return { success: false, message: res.error || 'Invalid coupon' };
    },
    [subtotal, showToast]
  );

  const removeDiscount = useCallback(() => {
    setAppliedDiscount(null);
    showToast({
      type: 'info',
      title: 'Coupon Removed',
      message: 'Discount has been removed from order.',
    });
  }, [showToast]);

  return (
    <CartContext.Provider
      value={{
        activeCart,
        diningCart,
        takeawayCart,
        isCartOpen,
        openCart: () => setIsCartOpen(true),
        closeCart: () => setIsCartOpen(false),
        addItem,
        updateQuantity,
        removeItem,
        clearActiveCart,
        activeItemCount,
        diningItemCount,
        takeawayItemCount,
        subtotal,
        discountAmount,
        appliedDiscount,
        applyDiscount,
        removeDiscount,
        taxConfig,
        taxBreakdown,
        taxAmount,
        gstAmount: taxAmount,
        grandTotal: totalPayable,
        currentMode: mode,
        refreshTaxConfig,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
