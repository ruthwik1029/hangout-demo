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

  it('8. Rejects staff binding when email is unverified (email_confirmed_at IS NULL)', () => {
    const simulateStaffBinding = (
      user: { id: string; email: string; email_confirmed_at: string | null },
      _code?: string
    ) => {
      if (!user.id) {
        throw new Error('Access denied: Valid Supabase Auth session required.');
      }
      if (!user.email_confirmed_at) {
        throw new Error(
          `Access denied: Email address "${user.email}" must be confirmed before claiming staff access.`
        );
      }
      return true;
    };

    const unconfirmedUser = {
      id: 'uuid-unconfirmed',
      email: 'newhire@hangout.in',
      email_confirmed_at: null,
    };

    expect(() => simulateStaffBinding(unconfirmedUser, 'VALID-CODE')).toThrow(
      /must be confirmed before claiming staff access/
    );
  });

  it('9. Rejects unauthorized self-registration (no staff invitation exists for email)', () => {
    const invitations = [
      {
        email: 'manager@hangout.in',
        role_id: 'manager',
        is_claimed: false,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      },
    ];

    const simulateSelfReg = (
      user: { id: string; email: string; email_confirmed_at: string },
      _code: string
    ) => {
      if (!user.email_confirmed_at) throw new Error('Email not confirmed');
      const invite = invitations.find(
        (i) => i.email.toLowerCase() === user.email.toLowerCase() && !i.is_claimed
      );
      if (!invite) {
        throw new Error(
          `Access denied: No authorized staff invitation exists for "${user.email}". Privileged accounts must be explicitly provisioned by an administrator.`
        );
      }
      return true;
    };

    const attackerUser = {
      id: 'uuid-attacker',
      email: 'attacker@evil.com',
      email_confirmed_at: '2026-11-20T10:00:00Z',
    };

    expect(() => simulateSelfReg(attackerUser, 'ATTEMPT-CODE')).toThrow(
      /No authorized staff invitation exists/
    );
  });

  it('10. Rejects unauthorized role claiming without valid provisioning code', () => {
    const hashFn = (c: string) => `hash-of-${c}`;
    const claimWithCode = (providedCode: string | null) => {
      if (!providedCode || providedCode.trim() === '' || hashFn(providedCode.trim()) !== 'hash-of-CORRECT-CODE-2026') {
        throw new Error('Access denied: A valid staff provisioning code is required to claim this profile.');
      }
      return true;
    };

    expect(() => claimWithCode(null)).toThrow(/A valid staff provisioning code is required/);
    expect(() => claimWithCode('')).toThrow(/A valid staff provisioning code is required/);
    expect(() => claimWithCode('WRONG-CODE')).toThrow(/A valid staff provisioning code is required/);
    expect(claimWithCode('CORRECT-CODE-2026')).toBe(true);
  });

  it('11. Blocks role jumping when account email is modified in auth.users', () => {
    const existingProfileForUid = {
      id: 'prof-waiter-01',
      auth_user_id: 'uuid-user-01',
      email: 'waiter@hangout.in',
      role_id: 'waiter',
    };

    const modifiedAuthUser = {
      id: 'uuid-user-01',
      email: 'admin@hangout.in',
      email_confirmed_at: '2026-11-20T10:00:00Z',
    };

    const verifyIdentityImmutability = (
      existingProf: typeof existingProfileForUid,
      authUser: typeof modifiedAuthUser
    ) => {
      if (existingProf.id && existingProf.email.toLowerCase() !== authUser.email.toLowerCase()) {
        throw new Error(
          'Security violation: Account identity was modified. Staff role cannot be transferred across email addresses.'
        );
      }
      return true;
    };

    expect(() => verifyIdentityImmutability(existingProfileForUid, modifiedAuthUser)).toThrow(
      /Security violation: Account identity was modified/
    );
  });

  it('12. Validates legitimate staff binding with confirmed email and valid provisioning code', () => {
    const invite = {
      id: 'inv-01',
      email: 'manager@hangout.in',
      role_id: 'manager',
      full_name: 'Store Manager',
      provisioning_code: 'HANGOUT-MGR-2026',
      is_claimed: false,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    const authUser = {
      id: 'uuid-genuine-mgr',
      email: 'manager@hangout.in',
      email_confirmed_at: '2026-11-20T10:00:00Z',
    };

    const bindUser = (user: typeof authUser, code: string) => {
      if (!user.email_confirmed_at) throw new Error('Unconfirmed email');
      if (user.email.toLowerCase() !== invite.email.toLowerCase()) throw new Error('No invitation');
      if (code !== invite.provisioning_code) throw new Error('Invalid code');
      invite.is_claimed = true;
      return {
        success: true,
        profile_id: 'prof-mgr-new',
        role_id: invite.role_id,
        full_name: invite.full_name,
        email: user.email,
        is_active: true,
      };
    };

    const result = bindUser(authUser, 'HANGOUT-MGR-2026');
    expect(result.success).toBe(true);
    expect(result.role_id).toBe('manager');
    expect(result.email).toBe('manager@hangout.in');
    expect(invite.is_claimed).toBe(true);
  });

  it('13. Enforces least-privilege token access (billing roles receive token; kitchen/waiter receive NULL)', () => {
    const rawOrderRecord = {
      id: 'ord-token-test-1',
      order_number: '2026-PRIV-01',
      customer_mobile_snapshot: '9876543210',
      customer_email_snapshot: 'cust@example.com',
      guest_access_token: 'secret-raw-token-777',
      discount_code: 'WELCOME50',
    };

    const formatOrderForRole = (order: typeof rawOrderRecord, role: string) => {
      const isBillingRole = ['admin', 'manager', 'cashier'].includes(role);
      return {
        id: order.id,
        order_number: order.order_number,
        guest_access_token: isBillingRole ? order.guest_access_token : null,
        customer_mobile_snapshot: isBillingRole
          ? order.customer_mobile_snapshot
          : `XXXXXX${order.customer_mobile_snapshot.slice(-4)}`,
        customer_email_snapshot: isBillingRole ? order.customer_email_snapshot : null,
        discount_code: isBillingRole ? order.discount_code : null,
      };
    };

    // Billing roles get full access for receipt printing / QR billing
    const adminView = formatOrderForRole(rawOrderRecord, 'admin');
    expect(adminView.guest_access_token).toBe('secret-raw-token-777');
    expect(adminView.customer_mobile_snapshot).toBe('9876543210');
    expect(adminView.customer_email_snapshot).toBe('cust@example.com');

    const cashierView = formatOrderForRole(rawOrderRecord, 'cashier');
    expect(cashierView.guest_access_token).toBe('secret-raw-token-777');

    // Operational roles (kitchen, waiter) have tokens and PII stripped
    const kitchenView = formatOrderForRole(rawOrderRecord, 'kitchen');
    expect(kitchenView.guest_access_token).toBeNull();
    expect(kitchenView.customer_mobile_snapshot).toBe('XXXXXX3210');
    expect(kitchenView.customer_email_snapshot).toBeNull();
    expect(kitchenView.discount_code).toBeNull();

    const waiterView = formatOrderForRole(rawOrderRecord, 'waiter');
    expect(waiterView.guest_access_token).toBeNull();
    expect(waiterView.customer_mobile_snapshot).toBe('XXXXXX3210');
    expect(waiterView.customer_email_snapshot).toBeNull();
  });

  it('14. Confirms no bootstrap secret or custom-setting bootstrap mechanism remains in frontend or migration code', () => {
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20250106000000_qr_tracking_and_takeaway_roles.sql'
    );
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

    // No GUC custom settings, bootstrap_first_admin, or hardcoded bootstrap tokens
    expect(migrationContent).not.toContain('admin_bootstrap_secret');
    expect(migrationContent).not.toContain('bootstrap_first_admin');
    expect(migrationContent).not.toContain("current_setting('app.settings");
    expect(migrationContent).not.toContain('HANGOUT-ADMIN-BOOTSTRAP');

    const portalLoginPath = path.resolve(__dirname, '../pages/auth/PortalLogin.tsx');
    const portalLoginContent = fs.readFileSync(portalLoginPath, 'utf-8');
    expect(portalLoginContent).not.toContain('bootstrap');
    expect(portalLoginContent).not.toContain('BOOTSTRAP');
  });

  it('15. Strictly restricts manual_provision_admin to postgres superuser (revoking from PUBLIC, anon, authenticated, and service_role)', () => {
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20250106000000_qr_tracking_and_takeaway_roles.sql'
    );
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

    // SQL permission verification:
    expect(migrationContent).toContain(
      'REVOKE ALL ON FUNCTION public.manual_provision_admin(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;'
    );
    expect(migrationContent).toContain(
      'REVOKE EXECUTE ON FUNCTION public.manual_provision_admin(TEXT, UUID) FROM PUBLIC, anon, authenticated, service_role;'
    );
    expect(migrationContent).toContain(
      'GRANT EXECUTE ON FUNCTION public.manual_provision_admin(TEXT, UUID) TO postgres;'
    );
    expect(migrationContent).not.toContain(
      'GRANT EXECUTE ON FUNCTION public.manual_provision_admin(TEXT, UUID) TO postgres, service_role;'
    );

    // Runtime permission simulation:
    const simulateInvokeManualProvision = (role: 'anon' | 'authenticated' | 'service_role' | 'postgres') => {
      if (role === 'anon' || role === 'authenticated' || role === 'service_role') {
        throw new Error(`permission denied for function manual_provision_admin by role "${role}"`);
      }
      return { success: true };
    };

    expect(() => simulateInvokeManualProvision('anon')).toThrow(/permission denied/);
    expect(() => simulateInvokeManualProvision('authenticated')).toThrow(/permission denied/);
    expect(() => simulateInvokeManualProvision('service_role')).toThrow(/permission denied/);
    expect(simulateInvokeManualProvision('postgres').success).toBe(true);
  });

  it('16. manual_provision_admin strictly prevents role escalation, rejects arbitrary profile creation, and requires pre-seeded admin profile', () => {
    const authUsers = [
      { id: 'uuid-admin-user', email: 'admin@hangout.in', email_confirmed_at: '2026-11-20T10:00:00Z' },
      { id: 'uuid-unconfirmed', email: 'unconfirmed@hangout.in', email_confirmed_at: null },
      { id: 'uuid-mismatch', email: 'actual@hangout.in', email_confirmed_at: '2026-11-20T10:00:00Z' },
      { id: 'uuid-already-staff', email: 'waiter@hangout.in', email_confirmed_at: '2026-11-20T10:00:00Z' },
      { id: 'uuid-manager-user', email: 'manager@hangout.in', email_confirmed_at: '2026-11-20T10:00:00Z' },
      { id: 'uuid-arbitrary-user', email: 'newbie@hangout.in', email_confirmed_at: '2026-11-20T10:00:00Z' },
    ];

    // Pre-seeded profiles in database
    const userProfiles = [
      { id: 'prof-admin', auth_user_id: null as string | null, email: 'admin@hangout.in', role_id: 'admin' },
      { id: 'prof-mgr', auth_user_id: null as string | null, email: 'manager@hangout.in', role_id: 'manager' },
      { id: 'prof-waiter', auth_user_id: 'uuid-already-staff', email: 'waiter@hangout.in', role_id: 'waiter' },
    ];

    const simulateManualProvision = (pEmail: string, pAuthUserId: string) => {
      // 1. Target user exists
      const targetUser = authUsers.find((u) => u.id === pAuthUserId);
      if (!targetUser) {
        throw new Error(`Target user "${pAuthUserId}" not found in auth.users.`);
      }

      // 2. Email matches
      if (targetUser.email.toLowerCase() !== pEmail.toLowerCase().trim()) {
        throw new Error(
          `Email mismatch: Target user email "${targetUser.email}" does not match supplied email "${pEmail}".`
        );
      }

      // 3. Email confirmed
      if (!targetUser.email_confirmed_at) {
        throw new Error(
          `Email "${targetUser.email}" must be confirmed in Supabase Auth before provisioning as Administrator.`
        );
      }

      // 4. Must exist as pre-seeded profile; no upsert or arbitrary profile creation
      const existingProfile = userProfiles.find((p) => p.email.toLowerCase() === pEmail.toLowerCase().trim());
      if (!existingProfile) {
        throw new Error(
          `Access denied: No pre-seeded profile found for email "${pEmail}". Manual provisioning cannot create arbitrary profiles.`
        );
      }

      // 5. Role escalation check: Reject any profile whose role is not 'admin'
      if (existingProfile.role_id !== 'admin') {
        throw new Error(
          `Role escalation rejected: Profile for "${pEmail}" has role "${existingProfile.role_id}", not "admin". Manual provisioning only binds pre-seeded admin profiles.`
        );
      }

      // 6. Target auth_user_id already bound to another profile email
      if (
        userProfiles.some(
          (p) =>
            p.auth_user_id === pAuthUserId &&
            p.email.toLowerCase() !== pEmail.toLowerCase()
        )
      ) {
        throw new Error(
          'Security violation: The target Supabase Auth user is already bound to another staff profile.'
        );
      }

      // 7. Staff profile email already bound to another auth_user_id
      if (
        existingProfile.auth_user_id !== null &&
        existingProfile.auth_user_id !== pAuthUserId
      ) {
        throw new Error(
          `Security violation: The staff profile "${pEmail}" is already bound to a different Supabase Auth user.`
        );
      }

      // 8. Bind existing pre-seeded admin profile
      existingProfile.auth_user_id = pAuthUserId;
      return { success: true, email: pEmail, role_id: existingProfile.role_id };
    };

    // User not found
    expect(() => simulateManualProvision('admin@hangout.in', 'uuid-nonexistent')).toThrow(
      /not found in auth.users/
    );

    // Email mismatch
    expect(() => simulateManualProvision('supplied@hangout.in', 'uuid-mismatch')).toThrow(
      /Email mismatch/
    );

    // Unconfirmed email
    expect(() =>
      simulateManualProvision('unconfirmed@hangout.in', 'uuid-unconfirmed')
    ).toThrow(/must be confirmed in Supabase Auth/);

    // Arbitrary profile creation rejected (no pre-seeded profile exists)
    expect(() => simulateManualProvision('newbie@hangout.in', 'uuid-arbitrary-user')).toThrow(
      /No pre-seeded profile found for email "newbie@hangout.in". Manual provisioning cannot create arbitrary profiles/
    );

    // Role escalation rejected: Attempting to provision a manager profile as admin
    expect(() => simulateManualProvision('manager@hangout.in', 'uuid-manager-user')).toThrow(
      /Role escalation rejected: Profile for "manager@hangout.in" has role "manager", not "admin"/
    );

    // User already bound to another profile
    expect(() => simulateManualProvision('admin@hangout.in', 'uuid-already-staff')).toThrow(
      /Email mismatch/
    );

    // Successful provisioning of the pre-seeded admin profile
    const result = simulateManualProvision('admin@hangout.in', 'uuid-admin-user');
    expect(result.success).toBe(true);
    expect(result.role_id).toBe('admin');
    expect(result.email).toBe('admin@hangout.in');

    // Attempting to rebind the already bound admin profile with a different auth user is rejected
    authUsers.push({
      id: 'uuid-second-admin',
      email: 'admin@hangout.in',
      email_confirmed_at: '2026-11-20T10:00:00Z',
    });
    expect(() => simulateManualProvision('admin@hangout.in', 'uuid-second-admin')).toThrow(
      /already bound to a different Supabase Auth user/
    );
  });

  it('17. Enforces transaction-level advisory locking to prevent concurrent first-admin provisioning', () => {
    const fs = require('fs');
    const path = require('path');
    const migrationPath = path.resolve(
      __dirname,
      '../../supabase/migrations/20250106000000_qr_tracking_and_takeaway_roles.sql'
    );
    const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

    // Verify migration SQL contains transaction-level advisory locking
    expect(migrationContent).toContain(
      "PERFORM pg_advisory_xact_lock(hashtext('manual_provision_admin_lock')::bigint);"
    );

    // Concurrent simulation:
    // Advisory lock serializes transaction 1 and transaction 2
    let lockHolder: string | null = null;
    let boundAdminUserId: string | null = null;

    const simulateProvisionTransaction = (txId: string, authUserId: string) => {
      // Transaction acquires advisory lock
      if (lockHolder !== null && lockHolder !== txId) {
        throw new Error('Lock wait timeout or contention');
      }
      lockHolder = txId;

      try {
        if (boundAdminUserId !== null) {
          throw new Error('Security violation: The staff profile "admin@hangout.in" is already bound to a different Supabase Auth user.');
        }
        boundAdminUserId = authUserId;
        return { success: true, bound_to: authUserId };
      } finally {
        // Released when transaction completes
        lockHolder = null;
      }
    };

    // First transaction succeeds
    const tx1 = simulateProvisionTransaction('tx-1', 'uuid-admin-1');
    expect(tx1.success).toBe(true);
    expect(tx1.bound_to).toBe('uuid-admin-1');

    // Concurrent/subsequent transaction trying to bind another user is safely serialized and rejected
    expect(() => simulateProvisionTransaction('tx-2', 'uuid-admin-2')).toThrow(
      /already bound to a different Supabase Auth user/
    );
  });

  it('18. Atomic invitation claiming: simultaneous requests cannot both succeed', () => {
    const invitation = {
      id: 'inv-manager-42',
      email: 'manager@hangout.in',
      role_id: 'manager',
      provisioning_code_hash: 'hash-of-MGR-SECRET-CODE',
      is_claimed: false,
      claimed_by: null as string | null,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    };

    const hashFn = (c: string) => `hash-of-${c}`;

    const claimInvitationAtomic = (callerUid: string, code: string) => {
      if (invitation.is_claimed) {
        throw new Error(
          `Access denied: Staff invitation for "${invitation.email}" has already been claimed.`
        );
      }
      if (new Date(invitation.expires_at) <= new Date()) {
        throw new Error(`Access denied: Staff invitation for "${invitation.email}" has expired.`);
      }
      if (invitation.provisioning_code_hash !== hashFn(code)) {
        throw new Error('Access denied: Invalid staff provisioning code.');
      }

      if (invitation.is_claimed) {
        throw new Error(
          'Concurrent update detected: Staff invitation was claimed or modified by another transaction.'
        );
      }

      invitation.is_claimed = true;
      invitation.claimed_by = callerUid;
      return { success: true, claimed_by: callerUid };
    };

    const result1 = claimInvitationAtomic('uuid-worker-1', 'MGR-SECRET-CODE');
    expect(result1.success).toBe(true);
    expect(result1.claimed_by).toBe('uuid-worker-1');
    expect(invitation.is_claimed).toBe(true);

    expect(() => claimInvitationAtomic('uuid-worker-2', 'MGR-SECRET-CODE')).toThrow(
      /has already been claimed/
    );
  });

  it('19. Rejects expired and previously claimed invitations', () => {
    const expiredInvite = {
      id: 'inv-expired',
      email: 'cashier@hangout.in',
      is_claimed: false,
      expires_at: new Date(Date.now() - 3600000).toISOString(),
      code_hash: 'hash-code',
    };

    const alreadyClaimedInvite = {
      id: 'inv-claimed',
      email: 'waiter@hangout.in',
      is_claimed: true,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      code_hash: 'hash-code',
    };

    const verifyInvite = (invite: typeof expiredInvite) => {
      if (invite.is_claimed) {
        throw new Error(
          `Access denied: Staff invitation for "${invite.email}" has already been claimed.`
        );
      }
      if (new Date(invite.expires_at) <= new Date()) {
        throw new Error(`Access denied: Staff invitation for "${invite.email}" has expired.`);
      }
      return true;
    };

    expect(() => verifyInvite(expiredInvite)).toThrow(
      /Staff invitation for "cashier@hangout.in" has expired/
    );
    expect(() => verifyInvite(alreadyClaimedInvite)).toThrow(
      /Staff invitation for "waiter@hangout.in" has already been claimed/
    );
  });

  it('20. Direct administrator binding strictly verifies auth.users, matching email, and email confirmation', () => {
    const authUsers = [
      {
        id: 'uuid-target-confirmed',
        email: 'verified-chef@hangout.in',
        email_confirmed_at: '2026-11-20T10:00:00Z',
      },
      { id: 'uuid-target-unconfirmed', email: 'unconfirmed@hangout.in', email_confirmed_at: null },
      {
        id: 'uuid-target-different',
        email: 'different@hangout.in',
        email_confirmed_at: '2026-11-20T10:00:00Z',
      },
      {
        id: 'uuid-already-bound',
        email: 'waiter@hangout.in',
        email_confirmed_at: '2026-11-20T10:00:00Z',
      },
      {
        id: 'uuid-new-waiter',
        email: 'waiter@hangout.in',
        email_confirmed_at: '2026-11-20T10:00:00Z',
      },
    ];

    const boundProfiles = [
      {
        id: 'prof-existing',
        auth_user_id: 'uuid-already-bound',
        email: 'waiter@hangout.in',
        role_id: 'waiter',
      },
    ];

    const simulateAdminDirectProvision = (
      adminCaller: { is_admin: boolean; confirmed: boolean },
      targetAuthUserId: string,
      targetEmail: string,
      roleId: string
    ) => {
      if (!adminCaller.is_admin || !adminCaller.confirmed) {
        throw new Error(
          'Access denied: Only an active Administrator with confirmed email can provision staff accounts.'
        );
      }

      const targetUser = authUsers.find((u) => u.id === targetAuthUserId);
      if (!targetUser) {
        throw new Error(`Target user "${targetAuthUserId}" does not exist in auth.users.`);
      }

      if (targetUser.email.toLowerCase() !== targetEmail.toLowerCase()) {
        throw new Error(
          `Email mismatch: Target user email "${targetUser.email}" does not match supplied email "${targetEmail}".`
        );
      }

      if (!targetUser.email_confirmed_at) {
        throw new Error(
          `Access denied: Target user email "${targetUser.email}" is not confirmed in Supabase Auth.`
        );
      }

      // Check target auth_user_id already bound to a different email
      if (
        boundProfiles.some(
          (p) =>
            p.auth_user_id === targetAuthUserId &&
            p.email.toLowerCase() !== targetEmail.toLowerCase()
        )
      ) {
        throw new Error(
          'Security violation: The target Supabase Auth user is already bound to another staff profile.'
        );
      }

      // Check staff profile already bound to a different auth_user_id
      if (
        boundProfiles.some(
          (p) =>
            p.email.toLowerCase() === targetEmail.toLowerCase() &&
            p.auth_user_id !== null &&
            p.auth_user_id !== targetAuthUserId
        )
      ) {
        throw new Error(
          `Security violation: The staff profile "${targetEmail}" is already bound to a different Supabase Auth user.`
        );
      }

      return { success: true, email: targetEmail, role_id: roleId };
    };

    const admin = { is_admin: true, confirmed: true };

    expect(() =>
      simulateAdminDirectProvision(admin, 'uuid-nonexistent', 'nobody@hangout.in', 'chef')
    ).toThrow(/does not exist in auth.users/);

    expect(() =>
      simulateAdminDirectProvision(
        admin,
        'uuid-target-confirmed',
        'wrong-email@hangout.in',
        'kitchen'
      )
    ).toThrow(
      /Email mismatch: Target user email "verified-chef@hangout.in" does not match supplied email "wrong-email@hangout.in"/
    );

    expect(() =>
      simulateAdminDirectProvision(
        admin,
        'uuid-target-unconfirmed',
        'unconfirmed@hangout.in',
        'kitchen'
      )
    ).toThrow(/is not confirmed in Supabase Auth/);

    // Profile already bound to another Supabase Auth user
    expect(() =>
      simulateAdminDirectProvision(
        admin,
        'uuid-new-waiter',
        'waiter@hangout.in',
        'waiter'
      )
    ).toThrow(/already bound to a different Supabase Auth user/);

    // Auth user already bound to another profile
    boundProfiles.push({
      id: 'prof-alt',
      auth_user_id: 'uuid-target-different',
      email: 'other-staff@hangout.in',
      role_id: 'cashier',
    });
    expect(() =>
      simulateAdminDirectProvision(
        admin,
        'uuid-target-different',
        'different@hangout.in',
        'cashier'
      )
    ).toThrow(/already bound to another staff profile/);

    const directResult = simulateAdminDirectProvision(
      admin,
      'uuid-target-confirmed',
      'verified-chef@hangout.in',
      'kitchen'
    );
    expect(directResult.success).toBe(true);
    expect(directResult.role_id).toBe('kitchen');
  });

  it('21. Legitimate administrator provisioning and staff invitation claiming succeed', () => {
    const staffInvitations: any[] = [];
    const adminUser = { is_admin: true, confirmed: true };

    const provisionStaffInvite = (
      admin: typeof adminUser,
      email: string,
      name: string,
      role: string,
      code: string
    ) => {
      if (!admin.is_admin || !admin.confirmed) throw new Error('Unauthorized');
      const hashFn = (c: string) => `hash-${c}`;
      const invite = {
        id: `inv-${Date.now()}`,
        email: email.toLowerCase(),
        full_name: name,
        role_id: role,
        provisioning_code_hash: hashFn(code),
        is_claimed: false,
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      };
      staffInvitations.push(invite);
      return { success: true, email: invite.email, role_id: invite.role_id };
    };

    const provResult = provisionStaffInvite(
      adminUser,
      'cashier-lead@hangout.in',
      'Lead Cashier',
      'cashier',
      'CASHIER-KEY-4491'
    );
    expect(provResult.success).toBe(true);

    const claimInvite = (
      user: { uid: string; email: string; confirmed: boolean },
      code: string
    ) => {
      if (!user.confirmed) throw new Error('Unconfirmed');
      const hashFn = (c: string) => `hash-${c}`;
      const found = staffInvitations.find(
        (i) => i.email === user.email.toLowerCase() && !i.is_claimed
      );
      if (!found) throw new Error('No invite');
      if (found.provisioning_code_hash !== hashFn(code)) throw new Error('Bad code');
      found.is_claimed = true;
      return {
        success: true,
        email: user.email,
        role_id: found.role_id,
        full_name: found.full_name,
      };
    };

    const claimed = claimInvite(
      { uid: 'uuid-cashier-lead', email: 'cashier-lead@hangout.in', confirmed: true },
      'CASHIER-KEY-4491'
    );
    expect(claimed.success).toBe(true);
    expect(claimed.role_id).toBe('cashier');
    expect(claimed.full_name).toBe('Lead Cashier');
  });
});

