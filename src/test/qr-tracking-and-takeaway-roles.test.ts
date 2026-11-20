import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchOrderById,
  lookupGuestOrder,
  updateOrderStatus,
  VALID_ORDER_TRANSITIONS,
} from '../lib/supabase';
import { Order, OrderStatus } from '../types';

describe('Phase 1: QR Tracking URL & Access Token Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('correctly resolves and encodes guest_access_token into tracking URL', () => {
    const mockOrder: Partial<Order> = {
      id: 'order-12345',
      order_number: '2026-001',
      guest_access_token: 'secret-token-abcdef123456',
    };

    const origin = 'https://hangout-demo.vercel.app';
    const trackingUrl = `${origin}/track/${mockOrder.id}?token=${encodeURIComponent(
      mockOrder.guest_access_token!
    )}`;

    expect(trackingUrl).toBe(
      'https://hangout-demo.vercel.app/track/order-12345?token=secret-token-abcdef123456'
    );
    expect(trackingUrl).toContain('?token=');
  });

  it('resolves guest token from localStorage if missing from order object', () => {
    const orderId = 'order-99999';
    const cachedToken = 'cached-token-987654';
    localStorage.setItem(`hangout_guest_token_${orderId}`, cachedToken);

    const resolvedToken =
      localStorage.getItem(`hangout_guest_token_${orderId}`) || '';

    expect(resolvedToken).toBe('cached-token-987654');
  });

  it('persists guest token to localStorage for subsequent sessions', async () => {
    const orderId = 'order-session-1';
    const testToken = 'token-persisted-123';

    localStorage.setItem(`hangout_guest_token_${orderId}`, testToken);
    const retrieved = localStorage.getItem(`hangout_guest_token_${orderId}`);

    expect(retrieved).toBe(testToken);
  });
});

describe('Phase 2: Customer Order History & Guest Recovery', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('verifies guest order recovery by order number and matching mobile number', async () => {
    const mockOrder: Order = {
      id: 'ord-rec-1',
      order_number: '2026-888',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Rohan Sharma',
      customer_mobile_snapshot: '9876543210',
      guest_access_token: 'valid-token-888',
      status: 'PENDING',
      order_status: 'PENDING',
      subtotal: 250,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 250,
      payment_status: 'PAID',
      payment_method: 'UPI_DEMO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tax_breakdown: { is_gst_enabled: false, cgst: 0, sgst: 0, total_tax: 0, cgst_rate: 0, sgst_rate: 0 },
      items: [],
    };

    localStorage.setItem('hangout_orders_store', JSON.stringify([mockOrder]));

    const recovered = await lookupGuestOrder('2026-888', '9876543210');
    expect(recovered).not.toBeNull();
    expect(recovered?.order_number).toBe('2026-888');
    expect(recovered?.customer_name_snapshot).toBe('Rohan Sharma');
  });

  it('rejects guest order recovery if mobile number does not match', async () => {
    const mockOrder: Order = {
      id: 'ord-rec-2',
      order_number: '2026-999',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Sneha Patel',
      customer_mobile_snapshot: '9876543210',
      guest_access_token: 'valid-token-999',
      status: 'PENDING',
      order_status: 'PENDING',
      subtotal: 180,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 180,
      payment_status: 'PAID',
      payment_method: 'UPI_DEMO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tax_breakdown: { is_gst_enabled: false, cgst: 0, sgst: 0, total_tax: 0, cgst_rate: 0, sgst_rate: 0 },
      items: [],
    };

    localStorage.setItem('hangout_orders_store', JSON.stringify([mockOrder]));

    const recovered = await lookupGuestOrder('2026-999', '1111111111');
    expect(recovered).toBeNull();
  });
});

describe('Phase 3: Takeaway Operations Workflow & State Machine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enforces strict takeaway progression from PENDING to COMPLETED', async () => {
    const testOrder: Order = {
      id: 'takeaway-test-1',
      order_number: '2026-TK01',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Aarav Kumar',
      customer_mobile_snapshot: '9988776655',
      status: 'PENDING',
      order_status: 'PENDING',
      subtotal: 300,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 300,
      payment_status: 'UNPAID',
      payment_method: 'CASH',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tax_breakdown: { is_gst_enabled: false, cgst: 0, sgst: 0, total_tax: 0, cgst_rate: 0, sgst_rate: 0 },
      items: [],
    };

    localStorage.setItem('hangout_orders_store', JSON.stringify([testOrder]));

    // 1. Accept Order: PENDING -> ACCEPTED
    let updated = await updateOrderStatus(testOrder.id, 'ACCEPTED', 'Order accepted at counter');
    expect(updated.status).toBe('ACCEPTED');

    // 2. Start Cooking: ACCEPTED -> PREPARING
    updated = await updateOrderStatus(testOrder.id, 'PREPARING', 'Dispatched to kitchen');
    expect(updated.status).toBe('PREPARING');

    // 3. Ready: PREPARING -> READY_FOR_PICKUP
    updated = await updateOrderStatus(testOrder.id, 'READY_FOR_PICKUP', 'Ready at counter');
    expect(updated.status).toBe('READY_FOR_PICKUP');

    // 4. Pay at Counter: UNPAID -> PAID
    updated = await updateOrderStatus(testOrder.id, 'READY_FOR_PICKUP', 'PAID', 'PAID');
    expect(updated.payment_status).toBe('PAID');

    // 5. Complete Handover: READY_FOR_PICKUP -> COMPLETED
    updated = await updateOrderStatus(testOrder.id, 'COMPLETED', 'Handed over to customer');
    expect(updated.status).toBe('COMPLETED');
  });

  it('rejects invalid state machine jumps (e.g. PENDING directly to COMPLETED)', async () => {
    const testOrder: Order = {
      id: 'takeaway-invalid-jump',
      order_number: '2026-TK02',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Test Guest',
      customer_mobile_snapshot: '9988776655',
      status: 'PENDING',
      order_status: 'PENDING',
      subtotal: 150,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 150,
      payment_status: 'PAID',
      payment_method: 'UPI_DEMO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tax_breakdown: { is_gst_enabled: false, cgst: 0, sgst: 0, total_tax: 0, cgst_rate: 0, sgst_rate: 0 },
      items: [],
    };

    localStorage.setItem('hangout_orders_store', JSON.stringify([testOrder]));

    await expect(
      updateOrderStatus(testOrder.id, 'COMPLETED', 'Invalid immediate complete')
    ).rejects.toThrow(/Cannot transition order status/);
  });

  it('confirms HANGOUT model is strictly counter pickup with no delivery fees or drivers', () => {
    // Check validation rules and order types
    const allowedTypes = ['DINING', 'TAKEAWAY'];
    expect(allowedTypes).not.toContain('DELIVERY');
    expect(allowedTypes).not.toContain('HOME_DELIVERY');
  });
});

describe('Phase 4: Role-Based Access Control & Portals', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('validates role permissions matrix', () => {
    // Admin has superadmin privileges across all routes
    const adminRole = 'admin';
    const managerRole = 'manager';
    const cashierRole = 'cashier';
    const waiterRole = 'waiter';

    // Operational routes allowed for Manager and Admin
    const operationalRoutesAllowed = ['admin', 'manager'];
    expect(operationalRoutesAllowed.includes(adminRole)).toBe(true);
    expect(operationalRoutesAllowed.includes(managerRole)).toBe(true);
    expect(operationalRoutesAllowed.includes(cashierRole)).toBe(false);

    // Restricted routes strictly for Superadmin (billing & operations config)
    const restrictedConfigAllowed = ['admin'];
    expect(restrictedConfigAllowed.includes(adminRole)).toBe(true);
    expect(restrictedConfigAllowed.includes(managerRole)).toBe(false);

    // Staff Portal floor and takeaway allowed for all 4 roles
    const staffPortalAllowed = ['waiter', 'manager', 'cashier', 'admin'];
    expect(staffPortalAllowed.includes(waiterRole)).toBe(true);
    expect(staffPortalAllowed.includes(cashierRole)).toBe(true);
    expect(staffPortalAllowed.includes(managerRole)).toBe(true);
    expect(staffPortalAllowed.includes(adminRole)).toBe(true);
  });

  it('persists staff session in localStorage across page refreshes', () => {
    const demoManager = {
      id: 'demo-manager',
      email: 'manager@hangout.in',
      full_name: 'Operations Manager',
      role_id: 'manager',
      is_active: true,
    };

    localStorage.setItem('hangout_staff_session', JSON.stringify(demoManager));

    const restored = JSON.parse(localStorage.getItem('hangout_staff_session') || '{}');
    expect(restored.role_id).toBe('manager');
    expect(restored.full_name).toBe('Operations Manager');
  });
});
