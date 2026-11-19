import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { CartItem, MenuItem, MenuItemAddon, MenuItemVariant, OrderMode } from '../types';
import { useOrderMode } from './OrderModeContext';
import { useToast } from './ToastContext';

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
  gstRate: number;
  gstAmount: number;
  grandTotal: number;
  currentMode: OrderMode;
}

const STORAGE_DINING_CART = 'hangout_dining_cart_v1';
const STORAGE_TAKEAWAY_CART = 'hangout_takeaway_cart_v1';

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

  const [isCartOpen, setIsCartOpen] = useState(false);

  // Sync with localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_DINING_CART, JSON.stringify(diningCart));
  }, [diningCart]);

  useEffect(() => {
    localStorage.setItem(STORAGE_TAKEAWAY_CART, JSON.stringify(takeawayCart));
  }, [takeawayCart]);

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

      const variantKey = selectedVariant ? selectedVariant.id : 'base';
      const addonKeys = selectedAddons
        .map((a) => a.id)
        .sort()
        .join('-');
      const compositeId = `${menuItem.id}__${variantKey}__${addonKeys}__${mode}`;

      const variantPriceDelta = selectedVariant?.price_delta || 0;
      const addonsSum = selectedAddons.reduce((sum, a) => sum + Number(a.price), 0);
      const unitPrice = Number(menuItem.base_price) + Number(variantPriceDelta) + Number(addonsSum);

      setActiveCart((prevCart) => {
        const existingIndex = prevCart.findIndex((item) => item.id === compositeId);

        if (existingIndex > -1) {
          const updated = [...prevCart];
          const newQty = updated[existingIndex].quantity + quantity;
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: newQty,
            totalPrice: unitPrice * newQty,
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
          totalPrice: unitPrice * quantity,
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
              totalPrice: item.unitPrice * newQuantity,
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

  // Pricing & GST
  const subtotal = useMemo(
    () => activeCart.reduce((sum, item) => sum + item.totalPrice, 0),
    [activeCart]
  );

  const gstRate = 0.05; // 5% GST as per cafe_settings
  const gstAmount = Math.round(subtotal * gstRate * 100) / 100;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

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
        gstRate,
        gstAmount,
        grandTotal,
        currentMode: mode,
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
