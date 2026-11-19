import React, { useState, useEffect } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import {
  fetchCafeSettings,
  updateCafeSettings,
  fetchTaxConfiguration,
  updateTaxConfiguration,
  calculateOrderTaxes,
} from '../../lib/supabase';
import { CafeSettings, TaxConfiguration } from '../../types';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { useCart } from '../../context/CartContext';
import {
  Percent,
  ShoppingBag,
  UtensilsCrossed,
  Info,
  Save,
  Calculator,
  Building,
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const { showToast } = useToast();
  const { refreshTaxConfig } = useCart();

  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [taxConfig, setTaxConfig] = useState<TaxConfiguration | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Live Tax Calculator State
  const [testSubtotal, setTestSubtotal] = useState<number>(500);

  useEffect(() => {
    Promise.all([fetchCafeSettings(), fetchTaxConfiguration()]).then(([s, t]) => {
      setSettings(s);
      setTaxConfig(t);
    });
  }, []);

  // Compute live tax breakdown preview
  const livePreview = taxConfig
    ? calculateOrderTaxes(testSubtotal, 0, taxConfig)
    : null;

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !taxConfig) return;

    setIsSaving(true);
    try {
      await updateCafeSettings(settings);
      await updateTaxConfiguration(taxConfig);
      await refreshTaxConfig();

      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Cafe configuration and centralized GST parameters updated successfully.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update configuration.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings || !taxConfig) {
    return <div className="p-16 text-center text-xs text-brand-muted">Loading settings...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      <AdminNav
        title="Cafe & Billing Settings"
        subtitle="Manage business details, mode availability, pickup slots, and centralized GST rates."
      />

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* Business Profile */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-yellow" />
            <h2 className="font-heading font-bold text-base text-brand-black">
              Cafe Business Profile
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Brand Name
              </label>
              <input
                type="text"
                value={settings.cafe_name}
                onChange={(e) => setSettings({ ...settings, cafe_name: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Contact Phone
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Store Location / Address
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Ordering Availability & Operational Switches */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <h2 className="font-heading font-bold text-base text-brand-black">
            Order Modes & Operational Switches
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dining In */}
            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-brand-border flex items-center justify-center text-brand-black">
                  <UtensilsCrossed className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-brand-black">Dining In</p>
                  <p className="text-[11px] text-brand-muted">Table QR code ordering</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.dining_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, dining_enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-black"></div>
              </label>
            </div>

            {/* Takeaway */}
            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-brand-border flex items-center justify-center text-brand-black">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-brand-black">Takeaway (Pickup)</p>
                  <p className="text-[11px] text-brand-muted">Self-pickup from counter</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.takeaway_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, takeaway_enabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-black"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Mandatory Customer-Facing Takeaway Notice */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center gap-2 text-brand-black">
            <Info className="w-4 h-4 text-brand-yellow" />
            <h2 className="font-heading font-bold text-base text-brand-black">
              Official Self-Pickup Notice Text
            </h2>
          </div>

          <p className="text-xs text-brand-muted">
            Displayed prominently across customer screens to reinforce that HANGOUT does not provide home delivery.
          </p>

          <textarea
            rows={3}
            value={settings.takeaway_notice}
            onChange={(e) => setSettings({ ...settings, takeaway_notice: e.target.value })}
            className="w-full p-3 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand-yellow leading-relaxed"
          />
        </div>

        {/* Centralized GST Rates & Live Tax Calculator */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-brand-yellow" />
              <div>
                <h2 className="font-heading font-bold text-base text-brand-black">
                  Centralized GST & Tax Architecture
                </h2>
                <p className="text-xs text-brand-muted">
                  Configurable tax rate with automatic CGST and SGST equal split.
                </p>
              </div>
            </div>
            <span className="text-xs bg-brand-soft-yellow px-2.5 py-1 rounded-full font-bold text-brand-black">
              Dynamic Config
            </span>
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
                    tax_rate_percentage: val,
                    cgst_rate: val / 2,
                    cgst_percentage: val / 2,
                    sgst_rate: val / 2,
                    sgst_percentage: val / 2,
                  });
                }}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
              <p className="text-[11px] text-brand-muted mt-1">Standard Indian cafe GST is 5.00%</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                CGST Split (%)
              </label>
              <input
                type="number"
                disabled
                value={taxConfig.cgst_rate}
                className="w-full p-2.5 bg-gray-100 border border-brand-border rounded-xl text-sm font-mono text-brand-muted"
              />
              <p className="text-[11px] text-brand-muted mt-1">Auto 50% of total GST</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                SGST Split (%)
              </label>
              <input
                type="number"
                disabled
                value={taxConfig.sgst_rate}
                className="w-full p-2.5 bg-gray-100 border border-brand-border rounded-xl text-sm font-mono text-brand-muted"
              />
              <p className="text-[11px] text-brand-muted mt-1">Auto 50% of total GST</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                GSTIN / Tax Registration
              </label>
              <input
                type="text"
                value={settings.gst_number}
                onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-mono uppercase focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Tax Mode
              </label>
              <div className="p-2.5 rounded-xl border border-brand-border bg-brand-warm-white flex items-center justify-between text-xs">
                <span className="font-bold text-brand-black">
                  {taxConfig.is_tax_inclusive ? 'Tax Inclusive in Prices' : 'Tax Exclusive (Added at Checkout)'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxConfig.is_tax_inclusive}
                    onChange={(e) =>
                      setTaxConfig({ ...taxConfig, is_tax_inclusive: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-black"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Interactive Live Tax Calculator Preview */}
          <div className="p-5 rounded-3xl bg-brand-warm-white border border-brand-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-brand-black flex items-center gap-2">
                <Calculator className="w-4 h-4 text-brand-black" />
                <span>Live Tax Calculation Preview</span>
              </h3>
              <span className="text-[11px] font-bold text-brand-muted">
                Decimal-Safe KaTeX Arithmetic
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div>
                <label className="block text-xs font-bold text-brand-black mb-1">
                  Test Subtotal (₹)
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={testSubtotal}
                  onChange={(e) => setTestSubtotal(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 bg-white border border-brand-border rounded-xl text-sm font-mono focus:ring-2 focus:ring-brand-yellow focus:outline-none"
                />
                <p className="text-[11px] text-brand-muted mt-1">
                  Adjust test amount to preview real-time tax rounding.
                </p>
              </div>

              {livePreview && (
                <div className="p-3 bg-white rounded-2xl border border-brand-border space-y-1.5 text-xs">
                  <div className="flex justify-between text-brand-muted">
                    <span>Subtotal:</span>
                    <span>₹{testSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-brand-muted">
                    <span>CGST ({livePreview.taxBreakdown.cgst_rate}%):</span>
                    <span>₹{livePreview.taxBreakdown.cgst_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-brand-muted">
                    <span>SGST ({livePreview.taxBreakdown.sgst_rate}%):</span>
                    <span>₹{livePreview.taxBreakdown.sgst_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-heading font-extrabold text-brand-black pt-1 border-t border-brand-border text-sm">
                    <span>Final Amount:</span>
                    <span>₹{livePreview.totalPayable.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save All Cafe & Tax Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
