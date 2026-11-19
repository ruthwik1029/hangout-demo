import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerOrFindCustomer,
  createCustomerSession,
  createOrder,
  confirmDemoPayment,
  fetchAdminCustomers,
  fetchCustomerOrders,
  recordAdminAction,
  fetchAdminActivityLogs,
} from '../lib/supabase';
import { INITIAL_CUSTOMERS } from '../lib/mockData';

describe('Customer Directory, Registration Sync & Privacy (Release Freeze Verification)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Registration and Repeat Login Deduplication', () => {
    it('creates a new customer with NEW REGISTERED status on first registration', async () => {
      const newCust = await registerOrFindCustomer('Vikram Malhotra', '9811223344', 'vikram@example.com');

      expect(newCust.id).toBeDefined();
      expect(newCust.full_name).toBe('Vikram Malhotra');
      expect(newCust.mobile_number).toBe('9811223344');
      expect(newCust.email).toBe('vikram@example.com');
      expect(newCust.status).toBe('NEW REGISTERED');
      expect(newCust.total_orders).toBe(0);
      expect(newCust.total_spent).toBe(0);

      // Verify customer appears in admin directory
      const allCustomers = await fetchAdminCustomers();
      const found = allCustomers.find((c) => c.mobile_number === '9811223344');
      expect(found).toBeDefined();
      expect(found?.full_name).toBe('Vikram Malhotra');
    });

    it('deduplicates repeat logins with the same mobile number (with formatting or prefix)', async () => {
      // First registration with raw 10 digits
      const cust1 = await registerOrFindCustomer('Pooja Hegde', '9870001122', 'pooja@example.com');

      // Repeat login with +91 and spaces
      const cust2 = await registerOrFindCustomer('Pooja Hegde', '+91 98700 01122');

      expect(cust2.id).toBe(cust1.id);
      expect(cust2.mobile_number).toBe('9870001122');
      expect(cust2.email).toBe('pooja@example.com'); // retains email

      // Repeat login with name update
      const cust3 = await registerOrFindCustomer('Pooja H. Rao', '9870001122', 'pooja.rao@example.com');
      expect(cust3.id).toBe(cust1.id);
      expect(cust3.full_name).toBe('Pooja H. Rao');
      expect(cust3.email).toBe('pooja.rao@example.com');

      // Verify no duplicate customer was created
      const allCustomers = await fetchAdminCustomers();
      const matches = allCustomers.filter((c) => c.mobile_number === '9870001122');
      expect(matches.length).toBe(1);
    });

    it('creates customer session with secure token and 7-day expiration', async () => {
      const customer = await registerOrFindCustomer('Dev Patel', '9888877777');
      const session = await createCustomerSession(customer, 'dining', {
        id: 't-01',
        table_number: 'T-01',
        section: 'indoor',
        seating_capacity: 4,
        status: 'occupied',
        is_active: true,
      });

      expect(session.session_token).toBeDefined();
      expect(session.customer_id).toBe(customer.id);
      expect(session.table_number).toBe('T-01');
      expect(session.order_mode).toBe('dining');

      const expDate = new Date(session.expires_at).getTime();
      const now = Date.now();
      const approxDays = (expDate - now) / (1000 * 60 * 60 * 24);
      expect(approxDays).toBeGreaterThan(6.5);
      expect(approxDays).toBeLessThan(7.5);
    });
  });

  describe('2. Guest Checkout Sync & Honest Paid Spending Calculation', () => {
    it('automatically registers guest checkout customers into directory', async () => {
      const order = await createOrder({
        customerName: 'Meera Nair',
        customerMobile: '9988776655',
        customerEmail: 'meera.nair@example.com',
        orderType: 'TAKEAWAY',
        orderStatus: 'PENDING',
        paymentStatus: 'PENDING',
        items: [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000001',
            quantity: 2,
            unitPrice: 240,
            specialInstructions: 'Extra toum',
          },
        ],
        subtotal: 480,
        taxAmount: 24,
        totalAmount: 504,
      });

      expect(order.id).toBeDefined();

      // Check customer was created in directory
      const customers = await fetchAdminCustomers();
      const meera = customers.find((c) => c.mobile_number === '9988776655');
      expect(meera).toBeDefined();
      expect(meera?.full_name).toBe('Meera Nair');
      expect(meera?.email).toBe('meera.nair@example.com');
      expect(meera?.total_orders).toBe(1);
      // Because order is PENDING (unpaid), paid spend should be 0!
      expect(meera?.total_spent).toBe(0);
    });

    it('strictly counts paid orders toward lifetime spend and excludes unpaid / cancelled orders', async () => {
      // 1. Register customer
      const cust = await registerOrFindCustomer('Karan Johar', '9899112233');

      // 2. Place Order 1 (Total: 441, Paid)
      const ord1 = await createOrder({
        customerId: cust.id,
        customerName: 'Karan Johar',
        customerMobile: '9899112233',
        orderType: 'DINING',
        orderStatus: 'PENDING',
        paymentStatus: 'PENDING',
        items: [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000004',
            quantity: 2,
            unitPrice: 210,
          },
        ],
        subtotal: 420,
        taxAmount: 21,
        totalAmount: 441,
      });

      // Confirm payment on ord1
      const payResult = await confirmDemoPayment({
        orderId: ord1.id,
        amount: 441,
        paymentMethod: 'UPI',
      });
      expect(payResult.success).toBe(true);

      // 3. Place Order 2 (Total: 882, Unpaid / Cancelled)
      await createOrder({
        customerId: cust.id,
        customerName: 'Karan Johar',
        customerMobile: '9899112233',
        orderType: 'DINING',
        orderStatus: 'CANCELLED',
        paymentStatus: 'UNPAID',
        items: [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000007',
            quantity: 2,
            unitPrice: 420,
          },
        ],
        subtotal: 840,
        taxAmount: 42,
        totalAmount: 882,
      });

      // 4. Inspect Admin Customer Directory
      const directory = await fetchAdminCustomers();
      const karan = directory.find((c) => c.id === cust.id);
      expect(karan).toBeDefined();

      // Honest verification:
      // Total orders = 2
      // Paid spend = 441 (882 from unpaid cancelled order is EXCLUDED)
      expect(karan?.total_orders).toBe(2);
      expect(karan?.total_spent).toBe(441);
    });

    it('retrieves full order history for a customer profile drawer', async () => {
      const cust = await registerOrFindCustomer('Suresh Raina', '9812345678');

      const ord = await createOrder({
        customerId: cust.id,
        customerName: 'Suresh Raina',
        customerMobile: '9812345678',
        orderType: 'TAKEAWAY',
        orderStatus: 'COMPLETED',
        paymentStatus: 'PAID',
        items: [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000010',
            quantity: 1,
            unitPrice: 260,
          },
        ],
        subtotal: 260,
        taxAmount: 13,
        totalAmount: 273,
      });

      const orders = await fetchCustomerOrders(cust.id);
      expect(orders.length).toBeGreaterThanOrEqual(1);
      const foundOrd = orders.find((o) => o.id === ord.id);
      expect(foundOrd).toBeDefined();
      expect(foundOrd?.total_amount).toBe(273);
      expect(foundOrd?.items[0].unit_price_snapshot).toBe(260);
    });
  });

  describe('3. Multi-Field Search & Audit Logging', () => {
    it('searches customer directory by full name, mobile or email', async () => {
      await registerOrFindCustomer('Amit Trivedi', '9820011223', 'amit.t@music.com');
      await registerOrFindCustomer('Sunidhi Chauhan', '9830022334', 'sunidhi@music.com');

      // Search by partial name
      const byName = await fetchAdminCustomers('trivedi');
      expect(byName.some((c) => c.full_name === 'Amit Trivedi')).toBe(true);
      expect(byName.some((c) => c.full_name === 'Sunidhi Chauhan')).toBe(false);

      // Search by partial mobile
      const byMobile = await fetchAdminCustomers('30022');
      expect(byMobile.some((c) => c.full_name === 'Sunidhi Chauhan')).toBe(true);
      expect(byMobile.some((c) => c.full_name === 'Amit Trivedi')).toBe(false);

      // Search by email
      const byEmail = await fetchAdminCustomers('music.com');
      expect(byEmail.length).toBeGreaterThanOrEqual(2);
    });

    it('records administrative audit log on customer directory and profile access', async () => {
      await recordAdminAction(
        'Administrator',
        'Viewed customer profile for Aarav Sharma',
        'CUSTOMERS',
        'ID: e0000000-0000-0000-0000-000000000001, Mobile: 9876543210'
      );

      const logs = await fetchAdminActivityLogs();
      const customerAudit = logs.find(
        (l) => l.category === 'CUSTOMERS' && l.action.includes('Aarav Sharma')
      );

      expect(customerAudit).toBeDefined();
      expect(customerAudit?.actor).toBe('Administrator');
      expect(customerAudit?.details).toContain('9876543210');
    });

    it('verifies initial seed customers have authentic Bangalore profiles', async () => {
      const customers = await fetchAdminCustomers();
      expect(customers.length).toBeGreaterThanOrEqual(INITIAL_CUSTOMERS.length);

      const aarav = customers.find((c) => c.mobile_number === '9876543210');
      expect(aarav).toBeDefined();
      expect(aarav?.full_name).toBe('Aarav Sharma');
      expect(aarav?.status).toBe('ACTIVE');

      const rohan = customers.find((c) => c.mobile_number === '9900112233');
      expect(rohan).toBeDefined();
      expect(rohan?.full_name).toBe('Rohan Deshmukh');
      expect(rohan?.status).toBe('NEW REGISTERED');
    });
  });
});
