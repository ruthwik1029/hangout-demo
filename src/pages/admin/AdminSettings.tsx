import React, { useState, useEffect } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import {
  fetchCafeSettings,
  updateCafeSettings,
  fetchTaxConfiguration,
  updateTaxConfiguration,
  recordAdminAction,
} from '../../lib/supabase';
import { CafeSettings, TaxConfiguration } from '../../types';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import { useCart } from '../../context/CartContext';
import {
  ShoppingBag,
  UtensilsCrossed,
  Info,
  Save,
  Building,
  Volume2,
  VolumeX,
  Bell,
  RefreshCw,
  Monitor,
  FileText,
  PhoneCall,
  PauseCircle,
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const { showToast } = useToast();
  const { refreshTaxConfig } = useCart();

  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [taxConfig, setTaxConfig] = useState<TaxConfiguration | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchCafeSettings(), fetchTaxConfiguration()]).then(([s, t]) => {
      setSettings(s);
      setTaxConfig(t);
    });
  }, []);

  // Web Audio order chime sound test
  const handleTestSoundAlert = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        showToast({ type: 'warning', title: 'Audio Unsupported', message: 'Browser Web Audio not available.' });
        return;
      }
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
      showToast({ type: 'success', title: 'Sound Played', message: 'Order alert chime tested.' });
    } catch (err) {
      console.error('Audio test error:', err);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !taxConfig) return;

    setIsSaving(true);
    try {
      await updateCafeSettings(settings);
      await updateTaxConfiguration(taxConfig);
      await refreshTaxConfig();

      await recordAdminAction({
        actor: 'Administrator',
        action: 'Updated restaurant operations and billing settings',
        category: 'SETTINGS',
        details: `Ordering ${settings.is_online_ordering_paused ? 'PAUSED' : 'ACTIVE'}, Tax ${taxConfig.default_tax_rate}%, Alert Sound ${settings.sound_alert_enabled ? 'ON' : 'OFF'}.`,
      });

      showToast({
        type: 'success',
        title: 'Settings Saved',
        message: 'Restaurant configuration and operational switches updated successfully.',
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
        title="Operations & Restaurant Settings"
        subtitle="Manage live operations, order switches, sound alerts, display modes, and billing."
      />

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* 1. Live Operations & Emergency Controls */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <PauseCircle className="w-5 h-5 text-amber-500" />
              <div>
                <h2 className="font-heading font-bold text-base text-brand-black">
                  Operational Rush Controls & Online Ordering
                </h2>
                <p className="text-xs text-brand-muted">
                  Temporarily pause online ordering during extreme kitchen surges or private events.
                </p>
              </div>
            </div>

            <span
              className={`text-xs font-bold px-3 py-1 rounded-full ${
                settings.is_online_ordering_paused
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-emerald-100 text-emerald-900'
              }`}
            >
              {settings.is_online_ordering_paused ? 'ORDERING PAUSED' : 'ONLINE ORDERING ACTIVE'}
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="font-heading font-bold text-sm text-brand-black">
                Pause Online Customer Ordering
              </p>
              <p className="text-xs text-brand-muted mt-0.5">
                When enabled, checkout is blocked and customers are informed via an announcement banner.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(settings.is_online_ordering_paused)}
                onChange={(e) =>
                  setSettings({ ...settings, is_online_ordering_paused: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {settings.is_online_ordering_paused && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Pause Reason Displayed to Customers
              </label>
              <input
                type="text"
                value={settings.order_pause_reason || ''}
                onChange={(e) => setSettings({ ...settings, order_pause_reason: e.target.value })}
                placeholder="e.g. Kitchen is currently at full capacity. Online ordering will resume in 20 minutes."
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* 2. Audio Alerts, Kitchen Display & Refresh Interval */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-border">
            <Bell className="w-5 h-5 text-brand-yellow" />
            <div>
              <h2 className="font-heading font-bold text-base text-brand-black">
                Alerts, Display & Screen Refresh
              </h2>
              <p className="text-xs text-brand-muted">
                Audio notifications and display parameters for staff stations and KDS.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sound Alert Switch */}
            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {settings.sound_alert_enabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-brand-muted" />
                  )}
                  <span className="font-heading font-bold text-xs text-brand-black">
                    New Order Sound Chime
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.sound_alert_enabled ?? true}
                    onChange={(e) =>
                      setSettings({ ...settings, sound_alert_enabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-black"></div>
                </label>
              </div>
              <p className="text-[11px] text-brand-muted">
                Play acoustic chime upon arrival of incoming orders.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTestSoundAlert}
                leftIcon={<Volume2 className="w-3.5 h-3.5" />}
              >
                Test Sound Chime
              </Button>
            </div>

            {/* Auto-Refresh Interval */}
            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex flex-col justify-between space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-brand-yellow" />
                <span className="font-heading font-bold text-xs text-brand-black">
                  Auto-Refresh Interval
                </span>
              </div>
              <p className="text-[11px] text-brand-muted">
                Frequency for background sync across orders queue.
              </p>
              <select
                value={settings.auto_refresh_interval ?? 30}
                onChange={(e) =>
                  setSettings({ ...settings, auto_refresh_interval: parseInt(e.target.value) || 30 })
                }
                className="w-full p-2 bg-white border border-brand-border rounded-xl text-xs font-sans font-bold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              >
                <option value={10}>10 Seconds (Fast)</option>
                <option value={30}>30 Seconds (Default)</option>
                <option value={60}>60 Seconds (Relaxed)</option>
                <option value={0}>Manual Refresh Only</option>
              </select>
            </div>

            {/* Kitchen Display Mode */}
            <div className="p-4 rounded-2xl bg-brand-warm-white border border-brand-border flex flex-col justify-between space-y-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-brand-yellow" />
                <span className="font-heading font-bold text-xs text-brand-black">
                  Kitchen Display Mode
                </span>
              </div>
              <p className="text-[11px] text-brand-muted">
                Contrast and density on kitchen screens.
              </p>
              <select
                value={settings.kitchen_display_mode ?? 'standard'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    kitchen_display_mode: e.target.value as 'standard' | 'compact' | 'high-contrast',
                  })
                }
                className="w-full p-2 bg-white border border-brand-border rounded-xl text-xs font-sans font-bold focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              >
                <option value="standard">Standard (Full Cards)</option>
                <option value="compact">Compact (High Density)</option>
                <option value="high-contrast">High Contrast (Dark Kitchen)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Receipt Messages & Emergency Support */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-brand-border">
            <FileText className="w-5 h-5 text-brand-yellow" />
            <div>
              <h2 className="font-heading font-bold text-base text-brand-black">
                Receipt Footer & Emergency Escalation
              </h2>
              <p className="text-xs text-brand-muted">
                Information printed on thermal receipts and shared on customer order confirmation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Receipt Footer Message
              </label>
              <input
                type="text"
                value={settings.receipt_footer_message || ''}
                onChange={(e) => setSettings({ ...settings, receipt_footer_message: e.target.value })}
                placeholder="e.g. Thank you for dining at HANGOUT! Visit again soon."
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
              <p className="text-[11px] text-brand-muted mt-1">
                Appears at the bottom of digital and thermal bills.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5 flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-brand-yellow" /> Emergency Staff Hotline
              </label>
              <input
                type="text"
                value={settings.emergency_phone || ''}
                onChange={(e) => setSettings({ ...settings, emergency_phone: e.target.value })}
                placeholder="e.g. +91 80 4567 8900"
                className="w-full p-2.5 bg-brand-warm-white border border-brand-border rounded-xl text-xs sm:text-sm font-sans focus:ring-2 focus:ring-brand-yellow focus:outline-none"
              />
              <p className="text-[11px] text-brand-muted mt-1">
                Internal manager hotline for customer escalation.
              </p>
            </div>
          </div>
        </div>

        {/* 4. Restaurant Profile & Order Modes */}
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-yellow" />
            <h2 className="font-heading font-bold text-base text-brand-black">
              Restaurant Business Profile
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

          {/* Dining and Takeaway toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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

        {/* 5. Customer Self-Pickup Notice Text */}
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

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSaving}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save Operations & Restaurant Settings
          </Button>
        </div>
      </form>
    </div>
  );
};
