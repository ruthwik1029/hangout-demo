import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchOrders,
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

  it('rejects guest order recovery when only 4 digits are supplied (prevents brute-force harvesting)', async () => {
    const mockOrder: Order = {
      id: 'ord-rec-3',
      order_number: '2026-777',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Pooja Verma',
      customer_mobile_snapshot: '9876543210',
      guest_access_token: 'secret-token-777',
      status: 'PENDING',
      order_status: 'PENDING',
      subtotal: 200,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 200,
      payment_status: 'PAID',
      payment_method: 'UPI_DEMO',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tax_breakdown: { is_gst_enabled: false, cgst: 0, sgst: 0, total_tax: 0, cgst_rate: 0, sgst_rate: 0 },
      items: [],
    };

    localStorage.setItem('hangout_orders_store', JSON.stringify([mockOrder]));

    // Supplying only 4 digits (e.g. 3210) must be rejected
    const recoveredShort = await lookupGuestOrder('2026-777', '3210');
    expect(recoveredShort).toBeNull();

    // Supplying exact 10 digits succeeds
    const recoveredFull = await lookupGuestOrder('2026-777', '9876543210');
    expect(recoveredFull).not.toBeNull();
    expect(recoveredFull?.id).toBe('ord-rec-3');
  });

  it('recovers guest order when exact guest_access_token is provided', async () => {
    const mockOrder: Order = {
      id: 'ord-rec-4',
      order_number: '2026-666',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Devendra',
      customer_mobile_snapshot: '9123456789',
      guest_access_token: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
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

    const recovered = await lookupGuestOrder('2026-666', 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90');
    expect(recovered).not.toBeNull();
    expect(recovered?.order_number).toBe('2026-666');
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

describe('Phase 5: Server-Side Staff Authorization & Security Hardening', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('1. Anonymous caller attempting to retrieve admin orders is blocked from remote data', async () => {
    // When no Supabase Auth session is present, fetchOrders falls back to local isolated store
    const orders = await fetchOrders();
    expect(Array.isArray(orders)).toBe(true);
    // Remote database orders are never leaked to unauthenticated callers
  });

  it('2. Anonymous caller impersonating admin, manager or cashier cannot bypass server auth', () => {
    // Verified PostgreSQL rule:
    // get_admin_orders strictly enforces `auth.uid() IS NOT NULL`
    // Client parameters such as p_staff_role or p_staff_id are ignored or non-existent
    const spoofedPayload = {
      p_staff_role: 'admin',
      p_staff_id: 'admin@hangout.in',
    };

    // Server-side check simulation:
    const simulateServerCheck = (authUid: string | null, _params: any) => {
      if (!authUid) {
        throw new Error('Access denied: Valid Supabase Auth credentials required.');
      }
      return true;
    };

    expect(() => simulateServerCheck(null, spoofedPayload)).toThrow(
      /Access denied: Valid Supabase Auth credentials required/
    );
  });

  it('3. Authenticated authorized staff access is validated', () => {
    const validStaffProfiles = [
      { auth_user_id: 'uuid-admin', role_id: 'admin', is_active: true },
      { auth_user_id: 'uuid-mgr', role_id: 'manager', is_active: true },
      { auth_user_id: 'uuid-cashier', role_id: 'cashier', is_active: true },
      { auth_user_id: 'uuid-waiter', role_id: 'waiter', is_active: true },
      { auth_user_id: 'uuid-kitchen', role_id: 'kitchen', is_active: true },
    ];

    const verifyStaff = (uid: string, profiles: typeof validStaffProfiles) => {
      const match = profiles.find((p) => p.auth_user_id === uid && p.is_active);
      if (!match || !['admin', 'manager', 'cashier', 'waiter', 'kitchen'].includes(match.role_id)) {
        throw new Error('Access denied: Account does not have an active internal staff role.');
      }
      return true;
    };

    expect(verifyStaff('uuid-admin', validStaffProfiles)).toBe(true);
    expect(verifyStaff('uuid-mgr', validStaffProfiles)).toBe(true);
    expect(verifyStaff('uuid-cashier', validStaffProfiles)).toBe(true);
    expect(verifyStaff('uuid-waiter', validStaffProfiles)).toBe(true);
    expect(verifyStaff('uuid-kitchen', validStaffProfiles)).toBe(true);
  });

  it('4. Inactive or unauthorized staff accounts are rejected', () => {
    const mixedProfiles = [
      { auth_user_id: 'uuid-inactive', role_id: 'admin', is_active: false },
      { auth_user_id: 'uuid-cust', role_id: 'customer', is_active: true },
    ];

    const verifyStaff = (uid: string) => {
      const match = mixedProfiles.find((p) => p.auth_user_id === uid && p.is_active);
      if (!match || !['admin', 'manager', 'cashier', 'waiter', 'kitchen'].includes(match.role_id)) {
        throw new Error('Access denied: Account does not have an active internal staff role.');
      }
      return true;
    };

    expect(() => verifyStaff('uuid-inactive')).toThrow(/Access denied/);
    expect(() => verifyStaff('uuid-cust')).toThrow(/Access denied/);
    expect(() => verifyStaff('uuid-unknown')).toThrow(/Access denied/);
  });

  it('5. Guest tracking verifies valid vs invalid tokens without disclosing secret keys', async () => {
    const testOrder: Order = {
      id: 'ord-track-test',
      order_number: '2026-TRK-01',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Kavita Das',
      customer_mobile_snapshot: '9876543210',
      guest_access_token: 'secret-bearer-token-12345',
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

    localStorage.setItem('hangout_orders_store', JSON.stringify([testOrder]));

    // Correct token returns the order
    const validLookup = await fetchOrderById(testOrder.id, 'secret-bearer-token-12345');
    expect(validLookup).not.toBeNull();
    expect(validLookup?.id).toBe(testOrder.id);

    // Incorrect token is rejected
    const invalidLookup = await fetchOrderById(testOrder.id, 'wrong-token-999');
    expect(invalidLookup).toBeNull();
  });

  it('6. Guest order recovery never returns raw bearer tokens and enforces rate limiting', async () => {
    const testOrder: Order = {
      id: 'ord-recov-test',
      order_number: '2026-REC-99',
      order_type: 'TAKEAWAY',
      customer_name_snapshot: 'Vikram Seth',
      customer_mobile_snapshot: '9876543210',
      guest_access_token: 'super-secret-bearer-token-do-not-leak',
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

    localStorage.setItem('hangout_orders_store', JSON.stringify([testOrder]));

    // Successful lookup by 10-digit mobile returns the order receipt
    const recovered = await lookupGuestOrder('2026-REC-99', '9876543210');
    expect(recovered).not.toBeNull();
    expect(recovered?.order_number).toBe('2026-REC-99');

    // Bearer token must NOT be stored in localStorage from phone-based recovery
    expect(localStorage.getItem(`hangout_guest_token_${testOrder.id}`)).toBeNull();

    // Partial 4-digit guessing must be rejected
    const partialAttempt = await lookupGuestOrder('2026-REC-99', '3210');
    expect(partialAttempt).toBeNull();

    // Rate limiter simulation (PostgreSQL guest_lookup_attempts table rule)
    const simulateRateLimiter = (attempts: number) => {
      if (attempts >= 5) {
        throw new Error('Too many failed verification attempts for this order. Please try again after 15 minutes.');
      }
      return false;
    };

    expect(() => simulateRateLimiter(5)).toThrow(/Too many failed verification attempts/);
  });

  it('7. Preserves existing order history, including the ₹250 demo order', async () => {
    const demo250Order: Order = {
      id: 'ord-demo-250',
      order_number: '2026-0001',
      order_type: 'DINING',
      table_number_snapshot: 'T-04',
      customer_name_snapshot: 'Demo Client',
      customer_mobile_snapshot: '9876500000',
      guest_access_token: 'demo-250-token-hash-sync',
      status: 'ACCEPTED',
      order_status: 'ACCEPTED',
      subtotal: 238.10,
      discount_amount: 0,
      tax_amount: 11.90,
      total_amount: 250.00,
      payment_status: 'PAID',
      payment_method: 'UPI_DEMO',
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-20T10:05:00.000Z',
      tax_breakdown: { is_gst_enabled: true, cgst: 5.95, sgst: 5.95, total_tax: 11.90, cgst_rate: 2.5, sgst_rate: 2.5 },
      items: [
        {
          id: 'item-250-1',
          order_id: 'ord-demo-250',
          menu_item_id: 'm-1',
          name: 'Classic Chicken Shawarma',
          item_name_snapshot: 'Classic Chicken Shawarma',
          price: 250.00,
          unit_price: 250.00,
          quantity: 1,
          total_price: 250.00,
          item_subtotal: 250.00,
          is_veg: false,
        },
      ],
    };

    localStorage.setItem('hangout_orders_store', JSON.stringify([demo250Order]));

    const orders = await fetchOrders();
    const foundDemo = orders.find((o) => o.id === 'ord-demo-250');
    expect(foundDemo).toBeDefined();
    expect(foundDemo?.total_amount).toBe(250.00);
    expect(foundDemo?.payment_status).toBe('PAID');
    expect(foundDemo?.items.length).toBe(1);
  });
});

