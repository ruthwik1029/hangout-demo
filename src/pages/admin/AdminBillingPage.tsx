import React, { useState, useEffect } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import {
  fetchCafeSettings,
  updateCafeSettings,
  fetchTaxConfiguration,
  updateTaxConfiguration,
  calculateOrderTaxes,
  recordAdminAction,
} from '../../lib/supabase';
import { CafeSettings, TaxConfiguration } from '../../types';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { useCart } from '../../context/CartContext';
import {
  Percent,
  Receipt,
  Save,
  Calculator,
  Info,
} from 'lucide-react';

export const AdminBillingPage: React.FC = () => {
  const { showToast } = useToast();
  const { refreshTaxConfig } = useCart();

  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [taxConfig, setTaxConfig] = useState<TaxConfiguration | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live Test Calculator Subtotal
  const [testSubtotal, setTestSubtotal] = useState<number>(400);

  useEffect(() => {
    Promise.all([fetchCafeSettings(), fetchTaxConfiguration()]).then(([s, t]) => {
      setSettings(s);
      setTaxConfig(t);
    });
  }, []);

  // Compute live tax breakdown preview
  const livePreview = taxConfig ? calculateOrderTaxes(testSubtotal, 0, taxConfig) : null;

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !taxConfig) return;

    setIsSaving(true);
    try {
      await updateCafeSettings(settings);
      await updateTaxConfiguration(taxConfig);
      await refreshTaxConfig();
      await recordAdminAction('Administrator', 'Updated GST tax parameters & billing settings', 'BILLING');

      showToast({
        type: 'success',
        title: 'Billing Settings Saved',
        message: 'GST rate parameters and receipt billing configuration updated.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update billing configuration.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings || !taxConfig) {
    return <div className="p-16 text-center text-xs text-brand-muted">Loading billing configuration...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Header */}
      <AdminNav
        title="Pricing, Taxes & Billing Settings"
        subtitle="Configure centralized restaurant GST rates, tax inclusive/exclusive rules, and digital receipt business credentials."
      />

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* 1. Centralized GST Tax Architecture */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-brand-yellow" />
              <div>
                <h3 className="font-heading font-bold text-base text-brand-black">Centralized Restaurant GST</h3>
                <p className="text-xs text-brand-muted">Configures tax application across customer checkout and digital receipts</p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-brand-black cursor-pointer">
              <input
                type="checkbox"
                checked={taxConfig.is_gst_enabled}
                onChange={(e) =>
                  setTaxConfig({
                    ...taxConfig,
                    is_gst_enabled: e.target.checked,
                  })
                }
                className="rounded text-brand-yellow focus:ring-brand-yellow w-4 h-4"
              />
              <span>Enable GST Calculation</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Total GST Rate (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="28"
                value={taxConfig.default_tax_rate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setTaxConfig({
                    ...taxConfig,
                    default_tax_rate: val,
                    cgst_rate: val / 2,
                    sgst_rate: val / 2,
                  });
                }}
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-bold text-brand-black"
              />
              <span className="text-[10px] text-brand-muted mt-1 block">Standard 5.0% for restaurant dining/takeaway</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                CGST Split (%)
              </label>
              <input
                type="number"
                step="0.05"
                readOnly
                value={taxConfig.cgst_rate}
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-gray-100 text-xs font-mono font-bold text-brand-charcoal cursor-not-allowed"
              />
              <span className="text-[10px] text-brand-muted mt-1 block">Auto-derived 50% central split</span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                SGST Split (%)
              </label>
              <input
                type="number"
                step="0.05"
                readOnly
                value={taxConfig.sgst_rate}
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-gray-100 text-xs font-mono font-bold text-brand-charcoal cursor-not-allowed"
              />
              <span className="text-[10px] text-brand-muted mt-1 block">Auto-derived 50% state split</span>
            </div>
          </div>

          {/* Tax Inclusive / Exclusive Toggle */}
          <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-heading font-bold text-xs text-brand-black block">Tax Calculation Method</span>
              <p className="text-[11px] text-brand-muted">
                {taxConfig.is_tax_inclusive
                  ? 'Inclusive: Menu base prices already include GST taxes.'
                  : 'Exclusive: GST taxes are calculated on top of item subtotal at checkout.'}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-brand-black cursor-pointer">
              <input
                type="checkbox"
                checked={taxConfig.is_tax_inclusive}
                onChange={(e) => setTaxConfig({ ...taxConfig, is_tax_inclusive: e.target.checked })}
                className="rounded text-brand-yellow focus:ring-brand-yellow w-4 h-4"
              />
              <span>Prices Inclusive of Tax</span>
            </label>
          </div>
        </div>

        {/* 2. Interactive Tax Test Sandbox */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-yellow" />
            <h3 className="font-heading font-bold text-base text-brand-black">Live Tax Calculator Sandbox</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Test Order Subtotal (₹)
              </label>
              <input
                type="number"
                min="10"
                step="10"
                value={testSubtotal}
                onChange={(e) => setTestSubtotal(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-sm font-bold text-brand-black"
              />
              <p className="text-[11px] text-brand-muted mt-1">
                Enter any test amount to verify that rounding and GST lines match the backend calculation rules.
              </p>
            </div>

            {livePreview && (
              <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border space-y-2 text-xs font-mono">
                <div className="flex justify-between text-brand-muted">
                  <span>Subtotal:</span>
                  <span className="font-bold text-brand-black">₹{testSubtotal.toFixed(2)}</span>
                </div>
                {taxConfig.is_gst_enabled && livePreview.taxAmount > 0 ? (
                  <>
                    <div className="flex justify-between text-brand-muted">
                      <span>CGST ({taxConfig.cgst_rate}%):</span>
                      <span>₹{(livePreview.taxBreakdown.cgst_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-brand-muted">
                      <span>SGST ({taxConfig.sgst_rate}%):</span>
                      <span>₹{(livePreview.taxBreakdown.sgst_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-brand-muted font-bold">
                      <span>Total GST:</span>
                      <span className="text-emerald-700">₹{livePreview.taxAmount.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="text-brand-muted italic">GST calculation disabled (₹0.00 tax)</div>
                )}
                <div className="flex justify-between font-bold text-sm text-brand-black pt-2 border-t border-brand-border">
                  <span>Total Payable:</span>
                  <span className="text-brand-black">
                    ₹{livePreview.totalPayable.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Business Information & Receipt Watermarks */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-yellow" />
            <h3 className="font-heading font-bold text-base text-brand-black">Digital Receipt Business Details</h3>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>
              <strong>Authentic Receipt Standards:</strong> Any unconfigured registration numbers (such as GSTIN or FSSAI license) remain cleanly hidden on digital bills. No placeholder or fake registration numbers will ever be printed.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Official Business Name
              </label>
              <input
                type="text"
                value={settings.cafe_name}
                onChange={(e) => setSettings({ ...settings, cafe_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                GSTIN / Tax ID (Leave blank if unconfigured)
              </label>
              <input
                type="text"
                value={taxConfig.gst_number || ''}
                onChange={(e) => {
                  const val = e.target.value.trim().toUpperCase();
                  setTaxConfig({ ...taxConfig, gst_number: val });
                  setSettings({ ...settings, gst_number: val });
                }}
                placeholder="Unconfigured (Hidden on receipts)"
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-mono font-medium text-brand-black uppercase"
              />
            </div>
          </div>
        </div>

        {/* Save Controls */}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            {isSaving ? 'Updating Parameters...' : 'Save Billing & Tax Parameters'}
          </Button>
        </div>
      </form>
    </div>
  );
};
