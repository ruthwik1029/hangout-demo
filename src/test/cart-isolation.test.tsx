import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { ToastProvider } from '../context/ToastContext';
import { OrderModeProvider, useOrderMode } from '../context/OrderModeContext';
import { CartProvider, useCart } from '../context/CartContext';
import { INITIAL_MENU_ITEMS } from '../lib/mockData';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ToastProvider>
    <OrderModeProvider>
      <CartProvider>{children}</CartProvider>
    </OrderModeProvider>
  </ToastProvider>
);

describe('Separate Dining and Takeaway Carts Architecture', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps dining cart and takeaway cart completely isolated', () => {
    const { result } = renderHook(
      () => {
        const orderMode = useOrderMode();
        const cart = useCart();
        return { orderMode, cart };
      },
      { wrapper }
    );

    const testItem = INITIAL_MENU_ITEMS[0]; // Iced Spanish Latte (₹240)

    // 1. Initially both carts are empty
    expect(result.current.cart.diningItemCount).toBe(0);
    expect(result.current.cart.takeawayItemCount).toBe(0);

    // 2. Set mode to dining and add item
    act(() => {
      result.current.orderMode.setMode('dining');
    });

    act(() => {
      result.current.cart.addItem(testItem, 2);
    });

    // Dining cart must have 2 items, takeaway cart must have 0 items!
    expect(result.current.cart.diningItemCount).toBe(2);
    expect(result.current.cart.takeawayItemCount).toBe(0);
    expect(result.current.cart.subtotal).toBe(480);

    // 3. Switch mode to takeaway
    act(() => {
      result.current.orderMode.setMode('takeaway');
    });

    // In takeaway mode, active cart is empty because takeaway cart has 0 items!
    expect(result.current.cart.activeItemCount).toBe(0);
    expect(result.current.cart.subtotal).toBe(0);
    expect(result.current.cart.diningItemCount).toBe(2); // Dining cart items are preserved safely!

    // 4. Add an item to takeaway cart
    const burgerItem = INITIAL_MENU_ITEMS[9]; // The Hangout Signature Smash Burger (₹420)
    act(() => {
      result.current.cart.addItem(burgerItem, 1);
    });

    expect(result.current.cart.takeawayItemCount).toBe(1);
    expect(result.current.cart.diningItemCount).toBe(2);
    expect(result.current.cart.subtotal).toBe(420);
    expect(result.current.cart.gstAmount).toBe(21); // 5% of 420
    expect(result.current.cart.grandTotal).toBe(441);
  });
});

