import React, { useState, useEffect } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchCafeSettings, updateCafeSettings, recordAdminAction } from '../../lib/supabase';
import { CafeSettings } from '../../types';
import { Button } from '../../components/common/Button';
import { useToast } from '../../context/ToastContext';
import {
  Save,
  Eye,
  Megaphone,
  Clock,
  Sparkles,
} from 'lucide-react';

export const AdminWebsitePage: React.FC = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<CafeSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [heroHeadline, setHeroHeadline] = useState('');
  const [heroSubheadline, setHeroSubheadline] = useState('');
  const [heroImage, setHeroImage] = useState('/images/food/item-01-classic-shawarma-salad.jpg');
  const [bannerEnabled, setBannerEnabled] = useState(true);
  const [bannerText, setBannerText] = useState('');
  const [mondayFriday, setMondayFriday] = useState('');
  const [saturdaySunday, setSaturdaySunday] = useState('');
  const [takeawayNotice, setTakeawayNotice] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    fetchCafeSettings().then((s) => {
      setSettings(s);
      setHeroHeadline(s.hero_headline || 'Flame-Roasted Arabian Shawarma & Grills');
      setHeroSubheadline(
        s.hero_subheadline ||
          'Authentic vertical rotisserie carved chicken, velvety garlic toum, and crispy griddled murtabak.'
      );
      setHeroImage(s.hero_image_url || '/images/food/item-01-classic-shawarma-salad.jpg');
      setBannerEnabled(s.announcement_banner?.is_enabled ?? true);
      setBannerText(
        s.announcement_banner?.text ||
          '🔥 Authentic flame-roasted shawarma, flaky chicken murtabak & crispy starters served fresh daily!'
      );
      setMondayFriday(s.opening_hours?.monday_to_friday || '12:00 PM - 11:30 PM');
      setSaturdaySunday(s.opening_hours?.saturday_sunday || '12:00 PM - 12:00 Midnight');
      setTakeawayNotice(s.takeaway_notice || '');
      setPhone(s.phone || '');
      setEmail(s.email || '');
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    try {
      const updated: CafeSettings = {
        ...settings,
        hero_headline: heroHeadline.trim(),
        hero_subheadline: heroSubheadline.trim(),
        hero_image_url: heroImage.trim(),
        announcement_banner: {
          is_enabled: bannerEnabled,
          text: bannerText.trim(),
        },
        opening_hours: {
          monday_to_friday: mondayFriday.trim(),
          saturday_sunday: saturdaySunday.trim(),
        },
        takeaway_notice: takeawayNotice.trim(),
        phone: phone.trim(),
        email: email.trim(),
      };

      await updateCafeSettings(updated);
      setSettings(updated);
      await recordAdminAction('Administrator', 'Updated website CMS appearance and content', 'SETTINGS');

      showToast({
        type: 'success',
        title: 'Website Updated',
        message: 'Customer-facing hero, announcement banner, and hours updated successfully.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to update website settings.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return <div className="p-16 text-center text-xs text-brand-muted">Loading website CMS...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Header */}
      <AdminNav
        title="Website Appearance & Content (CMS)"
        subtitle="Manage customer homepage headlines, promotional banners, operating hours, and live preview."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Column (7 Cols) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
          {/* 1. Announcement Banner */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-yellow" />
                <h3 className="font-heading font-bold text-base text-brand-black">Top Announcement Banner</h3>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-brand-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={bannerEnabled}
                  onChange={(e) => setBannerEnabled(e.target.checked)}
                  className="rounded text-brand-yellow focus:ring-brand-yellow w-4 h-4"
                />
                <span>Active</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Banner Message Text
              </label>
              <input
                type="text"
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="Announcement message displayed to customer visitors"
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black focus:outline-none focus:border-brand-yellow"
              />
            </div>
          </div>

          {/* 2. Homepage Hero Section */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-yellow" />
              <h3 className="font-heading font-bold text-base text-brand-black">Homepage Hero Section</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Main Headline
                </label>
                <input
                  type="text"
                  value={heroHeadline}
                  onChange={(e) => setHeroHeadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black focus:outline-none focus:border-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Supporting Tagline / Description
                </label>
                <textarea
                  rows={2}
                  value={heroSubheadline}
                  onChange={(e) => setHeroSubheadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black focus:outline-none focus:border-brand-yellow"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Hero Showcase Image
                </label>
                <select
                  value={heroImage}
                  onChange={(e) => setHeroImage(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black focus:outline-none focus:border-brand-yellow"
                >
                  <option value="/images/food/item-01-classic-shawarma-salad.jpg">
                    Classic Chicken Shawarma (With Salad)
                  </option>
                  <option value="/images/food/item-02-grilled-shawarma-salad.jpg">
                    Grilled Chicken Shawarma (With Salad)
                  </option>
                  <option value="/images/food/item-04-classic-shawarma-no-salad.jpg">
                    Classic Shawarma (No Salad / All-Meat)
                  </option>
                  <option value="/images/food/item-05-grilled-shawarma-no-salad.jpg">
                    Grilled Shawarma (No Salad / All-Meat)
                  </option>
                  <option value="/images/food/item-07-classic-murtabak.jpg">
                    Classic Chicken Murtabak
                  </option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. Operational Hours & Pickup Policy */}
          <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-yellow" />
              <h3 className="font-heading font-bold text-base text-brand-black">Hours & Pickup Policy</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Monday – Friday Hours
                </label>
                <input
                  type="text"
                  value={mondayFriday}
                  onChange={(e) => setMondayFriday(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                  Saturday – Sunday Hours
                </label>
                <input
                  type="text"
                  value={saturdaySunday}
                  onChange={(e) => setSaturdaySunday(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-black mb-1.5">
                Self-Pickup Instructions
              </label>
              <textarea
                rows={2}
                value={takeawayNotice}
                onChange={(e) => setTakeawayNotice(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black"
              />
              <p className="text-[11px] text-brand-muted mt-1">
                Clearly states counter collection guidelines. HANGOUT does not provide home delivery.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSaving}
              leftIcon={<Save className="w-4 h-4" />}
            >
              {isSaving ? 'Publishing Changes...' : 'Save & Publish to Customer Site'}
            </Button>
          </div>
        </form>

        {/* Right Column: Live Interactive Preview (5 Cols) */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-24">
          <div className="flex items-center justify-between pb-2 border-b border-brand-border">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-brand-yellow" />
              <span className="font-heading font-extrabold text-xs uppercase tracking-wider text-brand-black">
                Live Customer Site Preview
              </span>
            </div>
            <span className="text-[10px] text-brand-muted uppercase font-bold">Real-time sync</span>
          </div>

          {/* Preview Canvas */}
          <div className="rounded-3xl border-2 border-brand-charcoal bg-brand-warm-white overflow-hidden shadow-dark-float">
            {/* Mock Browser Titlebar */}
            <div className="bg-brand-black px-4 py-2.5 flex items-center justify-between border-b border-brand-charcoal">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <span className="text-[10px] text-gray-400 font-mono">hangout.restaurant</span>
              <div className="w-4" />
            </div>

            {/* Announcement Banner in Preview */}
            {bannerEnabled && bannerText && (
              <div className="bg-brand-black text-brand-yellow px-3 py-1.5 text-center text-[10px] font-heading font-bold tracking-wide border-b border-brand-yellow/30">
                {bannerText}
              </div>
            )}

            {/* Mock Hero Header in Preview */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <span className="px-2.5 py-0.5 rounded-full bg-brand-yellow/30 text-brand-black text-[9px] font-heading font-extrabold uppercase tracking-wider border border-brand-yellow">
                  Shawarma & Murtabak
                </span>
                <h2 className="font-heading font-black text-xl text-brand-black leading-tight">
                  {heroHeadline || 'Headline'}
                </h2>
                <p className="text-xs text-brand-muted leading-relaxed">
                  {heroSubheadline || 'Subheadline'}
                </p>
              </div>

              {/* Showcase Image in Preview */}
              <div className="w-full aspect-[16/10] rounded-2xl overflow-hidden border border-brand-border bg-brand-black relative shadow-card-subtle">
                <img
                  src={heroImage}
                  alt="Hero Preview"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Hours in Preview */}
              <div className="p-3 rounded-xl bg-white border border-brand-border space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5 font-bold text-brand-black">
                  <Clock className="w-3 h-3 text-brand-yellow" />
                  <span>Operating Hours</span>
                </div>
                <div className="text-brand-muted flex justify-between">
                  <span>Mon - Fri:</span>
                  <span className="font-medium text-brand-black">{mondayFriday}</span>
                </div>
                <div className="text-brand-muted flex justify-between">
                  <span>Sat - Sun:</span>
                  <span className="font-medium text-brand-black">{saturdaySunday}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
