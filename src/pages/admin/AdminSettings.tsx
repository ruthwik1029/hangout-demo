import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchCafeSettings } from '../../lib/supabase';
import { CafeSettings } from '../../types';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Save,
  Percent,
  ShoppingBag,
  UtensilsCrossed,
  Info,
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCafeSettings().then((res) => setSettings(res));
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    // Simulate updating settings in database
    setTimeout(() => {
      setIsSaving(false);
      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Cafe configuration and GST rates updated successfully.',
      });
    }, 600);
  };

  if (!settings) {
    return <div className="p-12 text-center text-xs text-brand-muted">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-20">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-brand-border pb-4">
        <Link
          to="/admin"
          className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Admin Overview</span>
        </Link>
        <span className="text-xs font-bold text-brand-black uppercase tracking-wider">
          System Configuration
        </span>
      </div>

      <div className="space-y-1">
        <h1 className="font-heading font-extrabold text-3xl text-brand-black">
          Cafe & Billing Settings
        </h1>
        <p className="text-xs text-brand-muted">
          Manage HANGOUT business details, independent dining/takeaway availability, and tax parameters.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Order Mode Controls */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <h2 className="font-heading font-bold text-base text-brand-black">
            Order Modes Availability
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-brand-border flex items-center justify-center text-brand-black">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-brand-black">Takeaway (Pickup)</p>
                  <p className="text-[11px] text-brand-muted">Counter collection</p>
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

        {/* GST & Tax Configuration */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-brand-black flex items-center gap-2">
              <Percent className="w-4 h-4 text-brand-yellow" />
              <span>GST & Tax Parameters</span>
            </h2>
            <span className="text-xs bg-brand-soft-yellow px-2.5 py-0.5 rounded-full font-bold text-brand-black">
              Centralized Config
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                GST Rate Percentage (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="28"
                value={settings.gst_percentage}
                onChange={(e) =>
                  setSettings({ ...settings, gst_percentage: parseFloat(e.target.value) || 0 })
                }
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-black"
              />
              <p className="text-[11px] text-brand-muted mt-1">
                Standard Indian cafe GST is 5.00%. Applied automatically on cart orders.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                GST Registration Number (GSTIN)
              </label>
              <input
                type="text"
                value={settings.gst_number}
                onChange={(e) => setSettings({ ...settings, gst_number: e.target.value })}
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-black font-mono"
              />
              <p className="text-[11px] text-brand-muted mt-1">Printed on tax invoices and receipts.</p>
            </div>
          </div>
        </div>

        {/* Mandatory Customer-Facing Takeaway Notice */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center gap-2 text-brand-black">
            <Info className="w-4 h-4 text-brand-yellow" />
            <h2 className="font-heading font-bold text-base text-brand-black">
              Official Takeaway Notice Text
            </h2>
          </div>

          <p className="text-xs text-brand-muted">
            Displayed prominently across customer screens to reinforce that HANGOUT does not provide home delivery.
          </p>

          <textarea
            rows={3}
            value={settings.takeaway_notice}
            onChange={(e) => setSettings({ ...settings, takeaway_notice: e.target.value })}
            className="w-full p-3 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-black leading-relaxed"
          />
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
            Save Cafe Configuration
          </Button>
        </div>
      </form>
    </div>
  );
};
