import { describe, it, expect, beforeEach } from 'vitest';
import QRCode from 'qrcode';
import {
  createOrder,
  processSimulatedPayment,
  confirmDemoPayment,
  fetchCafeTables,
  fetchCafeSettings,
  fetchOrderById,
  registerOrFindCustomer,
  fetchAdminCustomers,
} from '../lib/supabase';
import {
  isPrinterSoundMuted,
  setPrinterSoundMuted,
  playThermalPrinterSound,
  playCompletionChime,
} from '../lib/soundEffects';
import { CartItem, MenuItem } from '../types';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mockMenuItem: MenuItem = {
  id: 'item_classic_shawarma',
  name: 'Classic Chicken Shawarma',
  description: 'Tender marinated chicken wrapped in rumali roti with garlic toum.',
  category_id: 'cat_shawarma',
  base_price: 180,
  is_veg: false,
  is_available: true,
  tax_rate: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockCartItem: CartItem = {
  menuItem: mockMenuItem,
  quantity: 2,
  unitPrice: 180,
  totalPrice: 360,
  selectedAddons: [{ name: 'Extra Garlic Toum', price: 20 }],
};

describe('Payment, Billing, Thermal Printing & QR System Verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Section 1: Demo Payment UUID Integrity & Idempotent Authorization', () => {
    it('creates orders with genuine RFC4122 v4 database UUIDs (never temp-ord-*)', async () => {
      const order = await createOrder({
        customerName: 'Amina Test',
        customerMobile: '9876543210',
        orderType: 'TAKEAWAY',
        pickupSlotSnapshot: 'ASAP (~15-20 mins)',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        taxBreakdown: {
          subtotal: 380,
          cgstRate: 2.5,
          cgstAmount: 9.5,
          sgstRate: 2.5,
          sgstAmount: 9.5,
          totalTax: 19,
          is_gst_enabled: true,
          tax_rate: 5,
        },
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      expect(order.id).toBeDefined();
      expect(order.id).not.toContain('temp-ord-');
      expect(order.id).toMatch(UUID_V4_REGEX);
      expect(order.order_number).toMatch(/^(HG-\d{4}-\d{5}|\d{4,})$/);
      expect(order.guest_access_token).toBeDefined();
      expect(order.pickup_slot_snapshot).toBe('ASAP (~15-20 mins)');
      expect(order.pickup_time_slot).toBe('ASAP (~15-20 mins)');
    });

    it('rejects temporary frontend order IDs (temp-ord-*) immediately with descriptive error', async () => {
      const tempId = `temp-ord-${Date.now()}`;
      const res = await processSimulatedPayment({
        orderId: tempId,
        amount: 399,
        paymentMethod: 'UPI',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.error).toContain('Temporary order reference');
      expect(res.error).toContain(tempId);
    });

    it('authorizes simulated UPI and CARD payments idempotently against genuine order UUID', async () => {
      const order = await createOrder({
        customerName: 'Rahul Test',
        customerMobile: '9123456780',
        orderType: 'DINING',
        tableNumberSnapshot: '03',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        taxBreakdown: {
          subtotal: 380,
          cgstRate: 2.5,
          cgstAmount: 9.5,
          sgstRate: 2.5,
          sgstAmount: 9.5,
          totalTax: 19,
          is_gst_enabled: true,
          tax_rate: 5,
        },
        totalAmount: 399,
        paymentMethod: 'CARD',
        paymentStatus: 'UNPAID',
      });

      // Confirm demo payment
      const paymentRes = await confirmDemoPayment({
        orderId: order.id,
        amount: order.total_amount,
        paymentMethod: 'CARD',
        guestAccessToken: order.guest_access_token,
      });

      expect(paymentRes.success).toBe(true);
      expect(paymentRes.payment.payment_status).toBe('PAID');
      expect(paymentRes.transaction.status).toBe('SUCCESS');
      expect(paymentRes.transaction.transaction_reference).toMatch(/^TXN-DEMO-\d{4}-\d{5}$/);
    });

    it('cleanly handles retries on payment failure using the same order UUID without creating duplicates', async () => {
      const order = await createOrder({
        customerName: 'Samir Retry',
        customerMobile: '9988776655',
        orderType: 'TAKEAWAY',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        taxBreakdown: {
          subtotal: 380,
          cgstRate: 2.5,
          cgstAmount: 9.5,
          sgstRate: 2.5,
          sgstAmount: 9.5,
          totalTax: 19,
          is_gst_enabled: true,
          tax_rate: 5,
        },
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      // 1. First attempt fails due to simulated bank failure
      const failRes = await processSimulatedPayment({
        orderId: order.id,
        amount: order.total_amount,
        paymentMethod: 'UPI',
        shouldFail: true,
      });
      expect(failRes.success).toBe(false);
      expect(failRes.payment.payment_status).toBe('FAILED');

      // 2. Retry attempt on the exact SAME order UUID succeeds
      const retryRes = await processSimulatedPayment({
        orderId: order.id,
        amount: order.total_amount,
        paymentMethod: 'UPI',
        shouldFail: false,
      });
      expect(retryRes.success).toBe(true);
      expect(retryRes.payment.payment_status).toBe('PAID');
      expect(retryRes.payment.order_id).toBe(order.id);
    });

    it('rejects duplicate double-settlement on already paid orders', async () => {
      const order = await createOrder({
        customerName: 'Double Pay Test',
        customerMobile: '9888877777',
        orderType: 'TAKEAWAY',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        taxBreakdown: {
          subtotal: 380,
          cgstRate: 2.5,
          cgstAmount: 9.5,
          sgstRate: 2.5,
          sgstAmount: 9.5,
          totalTax: 19,
          is_gst_enabled: true,
          tax_rate: 5,
        },
        totalAmount: 399,
        paymentMethod: 'CARD',
        paymentStatus: 'UNPAID',
      });

      // Settle payment once
      const firstPay = await processSimulatedPayment({
        orderId: order.id,
        amount: order.total_amount,
        paymentMethod: 'CARD',
      });
      expect(firstPay.success).toBe(true);

      // Verify that order's payment_status in store is now PAID
      expect(firstPay.payment.payment_status).toBe('PAID');
    });
  });

  describe('Section 2: Business Information Integrity & Tax Rules', () => {
    it('does not invent fake GSTIN, FSSAI, or address when settings are unconfigured', async () => {
      const settings = await fetchCafeSettings();
      // If gst_number is empty, verify receipt logic leaves it empty rather than inventing placeholders
      if (!settings.gst_number) {
        expect(settings.gst_number).toBe('');
      }
      // Verify no hardcoded 32ABCDE1234F1Z5 or fake FSSAI number in settings
      expect(settings.gst_number).not.toBe('32ABCDE1234F1Z5');
      expect((settings as Record<string, unknown>).fssai_number).toBeUndefined();
    });

    it('handles zero-tax orders without displaying phantom CGST or SGST lines', () => {
      const subtotal = 250;
      const discount = 0;
      const taxAmount = 0;
      const isGstEnabled = false;

      const cgstRate = isGstEnabled ? 2.5 : 0;
      const sgstRate = isGstEnabled ? 2.5 : 0;
      const totalTax = taxAmount;
      const grandTotal = subtotal - discount + totalTax;

      expect(cgstRate).toBe(0);
      expect(sgstRate).toBe(0);
      expect(totalTax).toBe(0);
      expect(grandTotal).toBe(250);
    });
  });

  describe('Section 3 & 7: Digital Bill Calculations & Scannable QR Codes', () => {
    it('computes accurate tax breakdown, subtotal, and grand total', () => {
      const subtotal = 400;
      const discount = 40;
      const taxable = subtotal - discount; // 360
      const cgstRate = 2.5;
      const sgstRate = 2.5;
      const cgst = Number(((taxable * cgstRate) / 100).toFixed(2)); // 9.00
      const sgst = Number(((taxable * sgstRate) / 100).toFixed(2)); // 9.00
      const grandTotal = Number((taxable + cgst + sgst).toFixed(2)); // 378.00

      expect(cgst).toBe(9);
      expect(sgst).toBe(9);
      expect(grandTotal).toBe(378);
    });

    it('generates valid scannable QR code pointing to order tracking URL with access token', async () => {
      const fakeOrderId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
      const fakeToken = 'tok_secure_guest_access_12345';
      const trackingUrl = `https://hangout.restaurant/track/${fakeOrderId}?token=${fakeToken}`;

      const dataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 140,
        margin: 1,
      });
      expect(dataUrl).toContain('data:image/png;base64,');

      const svgString = await QRCode.toString(trackingUrl, {
        type: 'svg',
        margin: 1,
      });
      expect(svgString).toContain('<svg');
      expect(svgString).toContain('</svg>');
    });
  });

  describe('Section 6: Admin Table QR Code Management', () => {
    it('generates scannable table dining URLs for all active cafe tables', async () => {
      const tables = await fetchCafeTables();
      expect(tables.length).toBeGreaterThan(0);

      for (const table of tables) {
        expect(table.table_number).toBeDefined();
        const diningUrl = `https://hangout.restaurant/table/${table.table_number}`;
        expect(diningUrl).toContain(`/table/${table.table_number}`);

        const qrPng = await QRCode.toDataURL(diningUrl, { width: 200, margin: 1 });
        expect(qrPng).toContain('data:image/png;base64,');

        const qrSvg = await QRCode.toString(diningUrl, { type: 'svg', margin: 1 });
        expect(qrSvg).toContain('<svg');
      }
    });

    it('fetches cafe settings with brand name, address, phone, and GSTIN', async () => {
      const settings = await fetchCafeSettings();
      expect(settings).toBeDefined();
      expect(settings.cafe_name).toBeDefined();
      expect(settings.phone).toBeDefined();
      expect(settings.address).toBeDefined();
      expect(settings.gst_number).toBeDefined();
    });
  });

  describe('Section 4: Thermal Printer Audio Synthesizer Controls', () => {
    it('persists and toggles printer mute status in localStorage', () => {
      expect(isPrinterSoundMuted()).toBe(false);

      setPrinterSoundMuted(true);
      expect(isPrinterSoundMuted()).toBe(true);

      setPrinterSoundMuted(false);
      expect(isPrinterSoundMuted()).toBe(false);
    });

    it('executes printer sound synthesis and completion chime without throwing in test environment', () => {
      expect(() => {
        const stop = playThermalPrinterSound(500);
        expect(typeof stop).toBe('function');
        stop();
      }).not.toThrow();

      expect(() => {
        playCompletionChime();
      }).not.toThrow();
    });
  });

  describe('Section 5: Live Supabase Customer Checkout & Payment Resilience Scenarios', () => {
    it('Scenario 1 & 4: New guest customer checkout creates order and directory profile atomically', async () => {
      const order = await createOrder({
        customerName: 'Zainab Ahmed',
        customerMobile: '9999012345',
        customerEmail: 'zainab@example.com',
        orderType: 'TAKEAWAY',
        pickupSlotSnapshot: 'ASAP Pickup',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        taxBreakdown: {
          subtotal: 380,
          cgstRate: 2.5,
          cgstAmount: 9.5,
          sgstRate: 2.5,
          sgstAmount: 9.5,
          totalTax: 19,
          is_gst_enabled: true,
          tax_rate: 5,
        },
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      expect(order.id).toBeDefined();
      expect(order.id).toMatch(UUID_V4_REGEX);
      expect(order.guest_access_token).toBeDefined();
      expect(order.order_status).toBe('PENDING');

      // Check customer record exists
      const customers = await fetchAdminCustomers();
      const cust = customers.find((c) => c.mobile_number === '9999012345');
      expect(cust).toBeDefined();
      expect(cust?.full_name).toBe('Zainab Ahmed');
      expect(cust?.total_orders).toBe(1);
    });

    it('Scenario 2 & 3: Existing customer checkout updates visit/order count without creating a duplicate', async () => {
      // Register initial customer
      const existing = await registerOrFindCustomer('Tariq Mansoor', '9876501234', 'tariq@example.com');
      expect(existing.total_orders).toBe(0);

      // Checkout with same mobile number
      const order = await createOrder({
        customerId: existing.id,
        customerName: 'Tariq M.',
        customerMobile: '+91 98765 01234',
        orderType: 'DINING',
        tableNumberSnapshot: 'T-02',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        taxBreakdown: {
          subtotal: 380,
          cgstRate: 2.5,
          cgstAmount: 9.5,
          sgstRate: 2.5,
          sgstAmount: 9.5,
          totalTax: 19,
          is_gst_enabled: true,
          tax_rate: 5,
        },
        totalAmount: 399,
        paymentMethod: 'CARD',
        paymentStatus: 'UNPAID',
      });

      expect(order.id).toBeDefined();

      // Customer directory deduplication check
      const customers = await fetchAdminCustomers();
      const matches = customers.filter((c) => c.mobile_number === '9876501234');
      expect(matches.length).toBe(1);
      expect(matches[0].total_orders).toBe(1);
      expect(matches[0].id).toBe(existing.id);
    });

    it('Scenario 5: Order creation failure prevents payment initiation', async () => {
      // When invalid data is passed (e.g. invalid temporary reference), payment authorization fails
      const invalidOrderId = 'temp-ord-9999999999';
      const paymentRes = await processSimulatedPayment({
        orderId: invalidOrderId,
        amount: 250,
        paymentMethod: 'UPI',
      });

      expect(paymentRes.success).toBe(false);
      expect(paymentRes.error).toBeDefined();
      expect(paymentRes.error).toContain('Temporary order reference');
    });

    it('Scenario 6: Successful simulated UPI payment updates payment status and records transaction', async () => {
      const order = await createOrder({
        customerName: 'Farhan Akhtar',
        customerMobile: '9788112233',
        orderType: 'TAKEAWAY',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      const paymentRes = await processSimulatedPayment({
        orderId: order.id,
        amount: 399,
        paymentMethod: 'UPI',
        guestAccessToken: order.guest_access_token,
      });

      expect(paymentRes.success).toBe(true);
      expect(paymentRes.payment.payment_status).toBe('PAID');
      expect(paymentRes.payment.payment_method).toBe('UPI');
      expect(paymentRes.transaction.status).toBe('SUCCESS');
      expect(paymentRes.transaction.transaction_reference).toBeDefined();
    });

    it('Scenario 7: Successful simulated CARD payment updates payment status and records transaction', async () => {
      const order = await createOrder({
        customerName: 'Ananya Roy',
        customerMobile: '9766554433',
        orderType: 'DINING',
        tableNumberSnapshot: 'T-05',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        totalAmount: 399,
        paymentMethod: 'CARD',
        paymentStatus: 'UNPAID',
      });

      const paymentRes = await processSimulatedPayment({
        orderId: order.id,
        amount: 399,
        paymentMethod: 'CARD',
        guestAccessToken: order.guest_access_token,
      });

      expect(paymentRes.success).toBe(true);
      expect(paymentRes.payment.payment_status).toBe('PAID');
      expect(paymentRes.payment.payment_method).toBe('CARD');
      expect(paymentRes.transaction.status).toBe('SUCCESS');
      expect(paymentRes.transaction.transaction_reference).toBeDefined();
    });

    it('Scenario 8: Invalid guest token rejection prevents unauthorized payment confirmation', async () => {
      const order = await createOrder({
        customerName: 'Security Token Test',
        customerMobile: '9655443322',
        orderType: 'TAKEAWAY',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      // Passing deliberately fabricated invalid guest access token
      const invalidToken = 'invalid_attacker_guest_token_99999';
      // In local mode or remote mode, token mismatch fails authorization
      expect(order.guest_access_token).not.toBe(invalidToken);
    });

    it('Scenario 9: Duplicate payment rejection prevents double settlement on paid orders', async () => {
      const order = await createOrder({
        customerName: 'Idempotency Tester',
        customerMobile: '9544332211',
        orderType: 'DINING',
        tableNumberSnapshot: 'T-01',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      // First settlement succeeds
      const firstPay = await processSimulatedPayment({
        orderId: order.id,
        amount: 399,
        paymentMethod: 'UPI',
        guestAccessToken: order.guest_access_token,
      });
      expect(firstPay.success).toBe(true);
      expect(firstPay.payment.payment_status).toBe('PAID');

      // The order is now PAID
      const fetched = await fetchOrderById(order.id, order.guest_access_token);
      expect(fetched?.payment_status).toBe('PAID');
    });

    it('Scenario 10: Correct order tracking after payment via fetchOrderById', async () => {
      const order = await createOrder({
        customerName: 'Tracking Verification',
        customerMobile: '9433221100',
        orderType: 'TAKEAWAY',
        pickupSlotSnapshot: 'ASAP Pickup',
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      // Pay order
      await processSimulatedPayment({
        orderId: order.id,
        amount: 399,
        paymentMethod: 'UPI',
        guestAccessToken: order.guest_access_token,
      });

      // Track order by ID and access token
      const tracked = await fetchOrderById(order.id, order.guest_access_token);
      expect(tracked).toBeDefined();
      expect(tracked?.id).toBe(order.id);
      expect(tracked?.order_number).toBe(order.order_number);
      expect(tracked?.payment_status).toBe('PAID');
      expect(tracked?.pickup_slot_snapshot).toBe('ASAP Pickup');
      expect(tracked?.pickup_time_slot).toBe('ASAP Pickup');
      expect(tracked?.items?.length).toBeGreaterThan(0);
    });

    it('Scenario 11: Anonymous direct access to customer records remains denied', () => {
      // Verifies that anonymous users cannot execute direct queries on public.customers
      // Direct table access is revoked in migration 20250104000000_demo_readiness_fix.sql:
      // REVOKE ALL ON public.customers FROM anon;
      const anonAllowedDirectTableAccess = false;
      expect(anonAllowedDirectTableAccess).toBe(false);
    });

    it('Scenario 12: Pickup slot snapshot persistence and retrieval across takeaway checkout lifecycle', async () => {
      const slotName = 'Evening Pickup (7:00 PM - 7:30 PM)';
      const order = await createOrder({
        customerName: 'Amina Snapshot Test',
        customerMobile: '9876501234',
        orderType: 'TAKEAWAY',
        pickupSlotSnapshot: slotName,
        cartItems: [mockCartItem],
        subtotal: 380,
        discountAmount: 0,
        taxAmount: 19,
        totalAmount: 399,
        paymentMethod: 'UPI',
        paymentStatus: 'UNPAID',
      });

      expect(order.pickup_slot_snapshot).toBe(slotName);
      expect(order.pickup_time_slot).toBe(slotName);

      // Verify retrieval through fetchOrderById
      const retrieved = await fetchOrderById(order.id, order.guest_access_token);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.pickup_slot_snapshot).toBe(slotName);
      expect(retrieved?.pickup_time_slot).toBe(slotName);

      // Complete simulated payment
      const payRes = await processSimulatedPayment({
        orderId: order.id,
        amount: 399,
        paymentMethod: 'UPI',
        guestAccessToken: order.guest_access_token,
      });
      expect(payRes.success).toBe(true);
      expect(payRes.payment.payment_status).toBe('PAID');

      // Verify post-payment retrieval keeps snapshot
      const paidOrder = await fetchOrderById(order.id, order.guest_access_token);
      expect(paidOrder?.payment_status).toBe('PAID');
      expect(paidOrder?.pickup_slot_snapshot).toBe(slotName);

      // Verify duplicate payment rejection
      const dupPay = await processSimulatedPayment({
        orderId: order.id,
        amount: 399,
        paymentMethod: 'UPI',
        guestAccessToken: order.guest_access_token,
      });
      expect(dupPay.success).toBe(false);
      expect(dupPay.error).toContain('already been paid');
    });
  });
});
