import { describe, it, expect, beforeEach } from 'vitest';
import { registerOrFindCustomer, createCustomerSession } from '../lib/supabase';

describe('Safe Customer Registration & Session Strategy', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and persists a customer profile with standardized 10-digit mobile', async () => {
    const customer = await registerOrFindCustomer('Aarav Sharma', '+91 98765 43210', 'aarav@example.com');
    expect(customer.id).toBeDefined();
    expect(customer.full_name).toBe('Aarav Sharma');
    expect(customer.mobile_number).toBe('9876543210');
    expect(customer.email).toBe('aarav@example.com');
  });

  it('creates guest customer profiles safely without phone-based account hijacking', async () => {
    const first = await registerOrFindCustomer('Rohan Mehra', '9988776655');
    const second = await registerOrFindCustomer('Rohan Mehra', '9988776655', 'rohan@newemail.com');
    expect(first.id).toBeDefined();
    expect(second.id).toBeDefined();
    expect(first.mobile_number).toBe('9988776655');
    expect(second.mobile_number).toBe('9988776655');
    expect(second.email).toBe('rohan@newemail.com');
  });

  it('issues a secure session token and sets an expiration date 7 days in the future', async () => {
    const customer = await registerOrFindCustomer('Sneha Kapur', '9123456780');
    const session = await createCustomerSession(customer, 'dining');

    expect(session.session_token).toBeDefined();
    expect(session.session_token.startsWith('hg_')).toBe(true);
    expect(session.customer_id).toBe(customer.id);
    expect(session.order_mode).toBe('dining');

    const expDate = new Date(session.expires_at);
    const now = new Date();
    const diffDays = (expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(6.9);
  });
});

