import { describe, it, expect } from 'vitest';
import {
  roundMoney,
  calculateOrderTaxes,
  validateAndApplyDiscount,
  processSimulatedPayment,
  generateDemoOrderNumber,
  updateOrderStatus,
} from '../lib/supabase';
import { TaxConfiguration } from '../types';

describe('Ordering Engine & Pricing Architecture (Batch 02)', () => {
  const sampleTaxConfig: TaxConfiguration = {
    id: 'tax-cfg-01',
    is_gst_enabled: true,
    default_tax_rate: 5.0,
    cgst_rate: 2.5,
    sgst_rate: 2.5,
    igst_rate: 0.0,
    is_tax_inclusive: false,
    gst_number: '29AAAAA0000A1Z5',
    legal_business_name: 'HANGOUT CAFE LLP',
  };

  it('generates safely formatted readable order numbers', () => {
    const orderNum1 = generateDemoOrderNumber();
    const currentYear = new Date().getFullYear();
    expect(orderNum1).toMatch(new RegExp(`^HG-${currentYear}-\\d{5}$`));
  });

  it('calculates decimal-safe monetary arithmetic without floating-point artifacts', () => {
    // 0.1 + 0.2 is normally 0.30000000000000004 in JavaScript IEEE 754
    const floatSum = 0.1 + 0.2;
    expect(roundMoney(floatSum)).toBe(0.3);

    // Rounding check for fractional paise
    expect(roundMoney(199.999)).toBe(200.0);
    expect(roundMoney(142.124)).toBe(142.12);
    expect(roundMoney(142.126)).toBe(142.13);
  });

  it('dynamically computes CGST, SGST and Grand Total from tax configuration', () => {
    const subtotal = 500;
    const discount = 50; // taxable subtotal = 450
    const result = calculateOrderTaxes(subtotal, discount, sampleTaxConfig);

    // 5% of 450 = 22.50
    // CGST = 2.5% = 11.25, SGST = 2.5% = 11.25
    expect(result.taxAmount).toBe(22.5);
    expect(result.taxBreakdown.cgstAmount).toBe(11.25);
    expect(result.taxBreakdown.sgstAmount).toBe(11.25);
    expect(result.totalPayable).toBe(472.5);
  });

  it('handles zero discount and inclusive tax configuration cleanly', () => {
    const inclusiveConfig: TaxConfiguration = {
      ...sampleTaxConfig,
      is_tax_inclusive: true,
    };

    const subtotal = 210;
    const result = calculateOrderTaxes(subtotal, 0, inclusiveConfig);

    // In inclusive tax: tax is already inside the 210
    // 210 - (210 / 1.05) = 10
    expect(result.taxAmount).toBe(10);
    expect(result.totalPayable).toBe(210);
  });

  it('validates discount coupons including minimum order and max caps', async () => {
    // 1. Valid coupon HANGOUT50 on subtotal >= 399
    const validRes = await validateAndApplyDiscount('HANGOUT50', 500);
    expect(validRes.isValid).toBe(true);
    expect(validRes.discountAmount).toBe(50);

    // 2. Coupon on order below minimum requirement
    const lowRes = await validateAndApplyDiscount('HANGOUT50', 200);
    expect(lowRes.isValid).toBe(false);
    expect(lowRes.error).toContain('Minimum order');

    // 3. Percentage discount with max cap: WELCOME20 (20% off up to ₹100, min ₹300)
    // 20% of 1000 is 200, but cap is 100
    const cappedRes = await validateAndApplyDiscount('WELCOME20', 1000);
    expect(cappedRes.isValid).toBe(true);
    expect(cappedRes.discountAmount).toBe(100);

    // 4. Invalid coupon code
    const invalidRes = await validateAndApplyDiscount('NOTEXISTING', 500);
    expect(invalidRes.isValid).toBe(false);
    expect(invalidRes.error).toBe('Invalid or expired coupon code');
  });

  it('simulates payment gateway with DEMO transaction IDs and failure isolation', async () => {
    // 1. Successful simulated payment
    const successRes = await processSimulatedPayment({
      orderId: 'test-order-01',
      amount: 450,
      paymentMethod: 'UPI',
      shouldFail: false,
    });

    expect(successRes.success).toBe(true);
    expect(successRes.transaction).toBeDefined();
    expect(successRes.transaction?.status).toBe('SUCCESS');
    expect(successRes.transaction?.transaction_number).toMatch(/^TXN-DEMO-2026-\d{5}$/);

    // 2. Failure simulation toggle
    const failRes = await processSimulatedPayment({
      orderId: 'test-order-02',
      amount: 450,
      paymentMethod: 'CARD',
      shouldFail: true,
    });

    expect(failRes.success).toBe(false);
    expect(failRes.transaction?.status).toBe('FAILURE');
    expect(failRes.error).toContain('Simulated payment processing failed');
  });

  it('enforces order lifecycle state machine transitions', async () => {
    // 1. Valid transition: PENDING -> ACCEPTED
    const acceptedOrder = await updateOrderStatus('ord-0003', 'ACCEPTED', 'Manager Approval');
    expect(acceptedOrder.order_status).toBe('ACCEPTED');

    // 2. Invalid transition: ACCEPTED directly to COMPLETED (must go PREPARING -> READY -> COMPLETED)
    await expect(
      updateOrderStatus('ord-0003', 'COMPLETED', 'Skip kitchen')
    ).rejects.toThrow(/Cannot transition order status/);
  });
});
