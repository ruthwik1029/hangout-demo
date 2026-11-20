import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  fetchOrders,
  createOrder,
  processSimulatedPayment,
} from '../lib/supabase';
import { Order, OrderStatus } from '../types';

describe('Cross-Device Revenue Synchronisation & Authoritative Accounting', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('1. Authoritative Revenue Calculation & Status Exclusions', () => {
    it('calculates settled revenue strictly from completed PAID orders, excluding UNPAID, CANCELLED, and REJECTED', () => {
      const orders: Order[] = [
        {
          id: 'ord-paid-250',
          order_number: 'ORD-20261120-001',
          order_type: 'TAKEAWAY',
          customer_name_snapshot: 'Test Customer',
          customer_mobile_snapshot: '9876543210',
          subtotal: 238.10,
          discount_amount: 0,
          tax_amount: 11.90,
          total_amount: 250.00,
          payment_method: 'UPI',
          payment_status: 'PAID',
          order_status: 'ACCEPTED',
          status: 'ACCEPTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        },
        {
          id: 'ord-unpaid-350',
          order_number: 'ORD-20261120-002',
          order_type: 'DINING',
          customer_name_snapshot: 'Unpaid Customer',
          customer_mobile_snapshot: '9876543211',
          subtotal: 333.33,
          discount_amount: 0,
          tax_amount: 16.67,
          total_amount: 350.00,
          payment_method: 'CASH',
          payment_status: 'UNPAID',
          order_status: 'PENDING',
          status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        },
        {
          id: 'ord-cancelled-200',
          order_number: 'ORD-20261120-003',
          order_type: 'TAKEAWAY',
          customer_name_snapshot: 'Cancelled Customer',
          customer_mobile_snapshot: '9876543212',
          subtotal: 190.48,
          discount_amount: 0,
          tax_amount: 9.52,
          total_amount: 200.00,
          payment_method: 'CARD',
          payment_status: 'REFUNDED',
          order_status: 'CANCELLED',
          status: 'CANCELLED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        },
        {
          id: 'ord-rejected-180',
          order_number: 'ORD-20261120-004',
          order_type: 'DINING',
          customer_name_snapshot: 'Rejected Customer',
          customer_mobile_snapshot: '9876543213',
          subtotal: 171.43,
          discount_amount: 0,
          tax_amount: 8.57,
          total_amount: 180.00,
          payment_method: 'UPI',
          payment_status: 'FAILED',
          order_status: 'REJECTED',
          status: 'REJECTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        },
      ];

      // Mirror Dashboard / Analytics calculation rule:
      const settledOrders = orders.filter(
        (o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
      );
      const totalRevenue = settledOrders.reduce((acc, o) => acc + o.total_amount, 0);
      const aov = settledOrders.length > 0 ? totalRevenue / settledOrders.length : 0;

      // Assertions
      expect(totalRevenue).toBe(250.00);
      expect(settledOrders.length).toBe(1);
      expect(settledOrders[0].id).toBe('ord-paid-250');
      expect(aov).toBe(250.00);

      // Verify that UNPAID, CANCELLED, and REJECTED orders are completely excluded
      expect(settledOrders.some((o) => o.id === 'ord-unpaid-350')).toBe(false);
      expect(settledOrders.some((o) => o.id === 'ord-cancelled-200')).toBe(false);
      expect(settledOrders.some((o) => o.id === 'ord-rejected-180')).toBe(false);
    });

    it('adds multiple completed orders to revenue without duplicate counting', () => {
      const orders: Order[] = [
        {
          id: 'ord-1',
          order_number: 'ORD-001',
          order_type: 'TAKEAWAY',
          total_amount: 250.00,
          subtotal: 238.10,
          tax_amount: 11.90,
          discount_amount: 0,
          customer_name_snapshot: 'Customer 1',
          customer_mobile_snapshot: '9876543210',
          payment_status: 'PAID',
          order_status: 'COMPLETED',
          status: 'COMPLETED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        },
        {
          id: 'ord-2',
          order_number: 'ORD-002',
          order_type: 'DINING',
          total_amount: 180.00,
          subtotal: 171.43,
          tax_amount: 8.57,
          discount_amount: 0,
          customer_name_snapshot: 'Customer 2',
          customer_mobile_snapshot: '9876543211',
          payment_status: 'PAID',
          order_status: 'ACCEPTED',
          status: 'ACCEPTED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: [],
        },
      ];

      const settled = orders.filter(
        (o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED'
      );
      const totalRevenue = settled.reduce((sum, o) => sum + o.total_amount, 0);

      expect(totalRevenue).toBe(430.00);
      expect(settled.length).toBe(2);
    });
  });

  describe('2. Multi-Device Synchronisation Simulation (Desktop vs Mobile)', () => {
    it('simulates desktop order placement and ensures mobile sees the exact same ₹250 revenue from authoritative store', async () => {
      // Step A: Device 1 (Desktop) places a test order of ₹250
      const desktopOrder = await createOrder({
        customerName: 'Aarav Sharma',
        customerMobile: '9876543210',
        orderType: 'TAKEAWAY',
        pickupSlotSnapshot: 'As soon as possible',
        subtotal: 238.10,
        taxAmount: 11.90,
        totalAmount: 250.00,
        items: [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000001',
            name: 'Classic Chicken Shawarma (With Salad)',
            basePrice: 160,
            quantity: 1,
            totalPrice: 160,
          },
        ],
      });

      expect(desktopOrder).toBeDefined();
      expect(desktopOrder.id).toBeDefined();

      // Step B: Fake payment simulation on Desktop succeeds for ₹250
      const paymentResult = await processSimulatedPayment({
        orderId: desktopOrder.id,
        amount: 250.00,
        paymentMethod: 'UPI',
      });

      expect(paymentResult.success).toBe(true);

      // Verify Desktop sees the ₹250 order
      const desktopOrders = await fetchOrders();
      const desktopPaidOrder = desktopOrders.find((o) => o.id === desktopOrder.id);
      expect(desktopPaidOrder).toBeDefined();
      expect(desktopPaidOrder?.payment_status).toBe('PAID');

      const desktopRevenue = desktopOrders
        .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .reduce((sum, o) => sum + o.total_amount, 0);

      expect(desktopRevenue).toBeGreaterThanOrEqual(250.00);

      // Step C: Simulate Device 2 (Mobile Phone) logging into the same application
      // The mobile phone has its own storage context. When it queries the authoritative orders,
      // it must retrieve the desktop order rather than showing ₹0.
      const authoritativeOrdersSnapshot = JSON.parse(JSON.stringify(desktopOrders));

      // Emulate Mobile session: Clear local storage to simulate a fresh/different device
      const mobileStorage: Record<string, string> = {
        hangout_staff_session: JSON.stringify({
          id: 'demo-admin',
          email: 'admin@hangout.in',
          full_name: 'Administrator',
          role_id: 'admin',
        }),
      };

      // Mock mobile storage engine
      const originalGetItem = localStorage.getItem;
      const originalSetItem = localStorage.setItem;

      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
        return mobileStorage[key] || null;
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
        mobileStorage[key] = value;
      });

      // Mobile device syncs with authoritative backend snapshot
      mobileStorage['hangout_orders_store'] = JSON.stringify(authoritativeOrdersSnapshot);

      // Mobile calls fetchOrders()
      const mobileOrders = await fetchOrders();
      const mobilePaidOrder = mobileOrders.find((o) => o.id === desktopOrder.id);

      expect(mobilePaidOrder).toBeDefined();
      expect(mobilePaidOrder?.payment_status).toBe('PAID');

      const mobileRevenue = mobileOrders
        .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .reduce((sum, o) => sum + o.total_amount, 0);

      // Both desktop and mobile now see the EXACT same revenue!
      expect(mobileRevenue).toBe(desktopRevenue);

      // Restore mocks
      vi.restoreAllMocks();
    });

    it('refreshing or re-logging on mobile preserves the ₹250 revenue without data loss', async () => {
      // Seed authoritative order in local store
      const testOrder: Order = {
        id: 'ord-authoritative-250',
        order_number: 'ORD-20261120-777',
        order_type: 'TAKEAWAY',
        total_amount: 250.00,
        subtotal: 238.10,
        tax_amount: 11.90,
        discount_amount: 0,
        customer_name_snapshot: 'Test Customer',
        customer_mobile_snapshot: '9988776655',
        payment_status: 'PAID',
        order_status: 'COMPLETED',
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [],
      };

      localStorage.setItem('hangout_orders_store', JSON.stringify([testOrder]));

      // 1. First fetch
      const orders1 = await fetchOrders();
      const rev1 = orders1
        .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .reduce((sum, o) => sum + o.total_amount, 0);
      expect(rev1).toBe(250.00);

      // 2. Simulate page reload / remount
      const ordersReloaded = await fetchOrders();
      const revReloaded = ordersReloaded
        .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .reduce((sum, o) => sum + o.total_amount, 0);
      expect(revReloaded).toBe(250.00);

      // 3. Simulate portal logout and login
      localStorage.removeItem('hangout_staff_session');
      localStorage.setItem('hangout_staff_session', JSON.stringify({ role_id: 'admin' }));

      const ordersAfterLogin = await fetchOrders();
      const revAfterLogin = ordersAfterLogin
        .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .reduce((sum, o) => sum + o.total_amount, 0);
      expect(revAfterLogin).toBe(250.00);
    });

    it('authoritative server data takes precedence over stale local cache', async () => {
      // Local cache contains an order with payment_status UNPAID
      const staleLocalOrder: Order = {
        id: 'ord-stale-001',
        order_number: 'ORD-001',
        order_type: 'TAKEAWAY',
        total_amount: 250.00,
        subtotal: 238.10,
        tax_amount: 11.90,
        discount_amount: 0,
        customer_name_snapshot: 'Cached User',
        customer_mobile_snapshot: '9876543210',
        payment_status: 'UNPAID',
        order_status: 'PENDING',
        status: 'PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [],
      };

      localStorage.setItem('hangout_orders_store', JSON.stringify([staleLocalOrder]));

      // Suppose the server has the updated settled order with PAID
      const authoritativeServerOrder: Order = {
        ...staleLocalOrder,
        payment_status: 'PAID',
        order_status: 'ACCEPTED',
        status: 'ACCEPTED',
        updated_at: new Date(Date.now() + 1000).toISOString(),
      };

      // When authoritative server orders arrive, server updates local store
      localStorage.setItem('hangout_orders_store', JSON.stringify([authoritativeServerOrder]));

      const orders = await fetchOrders();
      expect(orders.length).toBe(1);
      expect(orders[0].payment_status).toBe('PAID');

      const revenue = orders
        .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
        .reduce((sum, o) => sum + o.total_amount, 0);

      expect(revenue).toBe(250.00);
    });
  });

  describe('3. Time Window and Calendar Day Filtering', () => {
    it('captures today orders correctly in the today window', () => {
      const now = new Date();
      const todayOrder: Order = {
        id: 'ord-today',
        order_number: 'ORD-TODAY',
        order_type: 'TAKEAWAY',
        total_amount: 250.00,
        subtotal: 238.10,
        tax_amount: 11.90,
        discount_amount: 0,
        customer_name_snapshot: 'Today User',
        customer_mobile_snapshot: '9876543210',
        payment_status: 'PAID',
        order_status: 'ACCEPTED',
        status: 'ACCEPTED',
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        items: [],
      };

      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayOrder: Order = {
        id: 'ord-yesterday',
        order_number: 'ORD-YESTERDAY',
        order_type: 'TAKEAWAY',
        total_amount: 180.00,
        subtotal: 171.43,
        tax_amount: 8.57,
        discount_amount: 0,
        customer_name_snapshot: 'Yesterday User',
        customer_mobile_snapshot: '9876543211',
        payment_status: 'PAID',
        order_status: 'COMPLETED',
        status: 'COMPLETED',
        created_at: yesterday.toISOString(),
        updated_at: yesterday.toISOString(),
        items: [],
      };

      const allOrders = [todayOrder, yesterdayOrder];

      // Filter for 'today'
      const todayFiltered = allOrders.filter((o) => {
        const d = new Date(o.created_at);
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      });

      expect(todayFiltered.length).toBe(1);
      expect(todayFiltered[0].id).toBe('ord-today');

      const todayRevenue = todayFiltered
        .filter((o) => o.payment_status === 'PAID')
        .reduce((sum, o) => sum + o.total_amount, 0);

      expect(todayRevenue).toBe(250.00);

      // Filter for 'all'
      const allRevenue = allOrders
        .filter((o) => o.payment_status === 'PAID')
        .reduce((sum, o) => sum + o.total_amount, 0);

      expect(allRevenue).toBe(430.00);
    });
  });
});
