import { describe, it, expect } from 'vitest';
import { EXACT_TAKEAWAY_NOTICE } from '../context/OrderModeContext';
import { INITIAL_CAFE_SETTINGS, INITIAL_TABLES, INITIAL_MENU_ITEMS } from '../lib/mockData';

describe('HANGOUT Business Rules Verification', () => {
  it('strictly adheres to the exact customer-facing Takeaway Pickup notice', () => {
    const requiredNotice =
      'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.';
    expect(EXACT_TAKEAWAY_NOTICE).toBe(requiredNotice);
    expect(INITIAL_CAFE_SETTINGS.takeaway_notice).toBe(requiredNotice);
  });

  it('configures standard cafe GST at 5.00% in cafe settings', () => {
    expect(INITIAL_CAFE_SETTINGS.gst_enabled).toBe(true);
    expect(INITIAL_CAFE_SETTINGS.gst_percentage).toBe(5.0);
  });

  it('seeds active cafe tables with unique QR identifiers', () => {
    expect(INITIAL_TABLES.length).toBeGreaterThanOrEqual(8);
    const tableNumbers = INITIAL_TABLES.map((t) => t.table_number);
    const uniqueNumbers = new Set(tableNumbers);
    expect(tableNumbers.length).toBe(uniqueNumbers.size);

    const qrIdentifiers = INITIAL_TABLES.map((t) => t.qr_code_identifier);
    const uniqueQRs = new Set(qrIdentifiers);
    expect(qrIdentifiers.length).toBe(uniqueQRs.size);
  });

  it('validates menu items have veg/non-veg indicator and realistic prep times', () => {
    INITIAL_MENU_ITEMS.forEach((item) => {
      expect(typeof item.is_veg).toBe('boolean');
      expect(item.base_price).toBeGreaterThan(0);
      expect(item.preparation_time_mins).toBeGreaterThan(0);
      expect(item.image_url).toBeDefined();
    });
  });

  it('validates mobile number format for Indian standard numbers', () => {
    const validate = (mobile: string) => {
      const digits = mobile.replace(/\D/g, '');
      if (digits.length === 10) {
        return /^[6-9]\d{9}$/.test(digits);
      }
      if (digits.length === 12 && digits.startsWith('91')) {
        return /^[6-9]\d{9}$/.test(digits.slice(2));
      }
      return false;
    };

    expect(validate('9876543210')).toBe(true);
    expect(validate('+91 98765 43210')).toBe(true);
    expect(validate('8123456789')).toBe(true);
    expect(validate('1234567890')).toBe(false); // Does not start with 6-9
    expect(validate('98765')).toBe(false); // Less than 10 digits
    expect(validate('9876543210123')).toBe(false); // More than 10 digits
  });
});
