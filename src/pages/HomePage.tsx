import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOrderMode } from '../context/OrderModeContext';
import { useCart } from '../context/CartContext';
import { fetchCafeSettings } from '../lib/supabase';
import { MenuItem, MenuCategory, CafeSettings } from '../types';
import { Button } from '../components/common/Button';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { TakeawayNoticeBanner } from '../components/layout/TakeawayNoticeBanner';
import {
  UtensilsCrossed,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  Flame,
  Heart,
  Clock,
  MapPin,
  QrCode,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

interface HomePageProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  onSelectItem: (item: MenuItem) => void;
  onOpenTableSelector: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  categories,
  menuItems,
  onSelectItem,
  onOpenTableSelector,
}) => {
  const { mode, setMode, currentTable } = useOrderMode();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<CafeSettings | null>(null);

  useEffect(() => {
    fetchCafeSettings().then(setSettings);
  }, []);

  // Featured and specials
  const todaysSpecials = menuItems.filter((i) => i.is_today_special);
  const popularItems = menuItems.filter((i) => i.is_featured);

  const handleQuickAdd = (item: MenuItem) => {
    addItem(item, 1);
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* Dynamic Announcement Banner from Website CMS */}
      {settings?.announcement_banner?.is_enabled && settings.announcement_banner.text && (
        <div className="bg-brand-black text-brand-yellow px-4 py-2.5 text-center text-xs font-heading font-bold flex items-center justify-center gap-2 border-b border-brand-yellow/30 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-brand-yellow animate-pulse" />
          <span>{settings.announcement_banner.text}</span>
        </div>
      )}

      {/* Online Ordering Paused Warning Notice */}
      {settings?.is_online_ordering_paused && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="p-4 bg-amber-500/15 border-2 border-amber-500/50 rounded-3xl flex items-center gap-3 text-amber-950 font-medium text-xs sm:text-sm shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <span className="font-heading font-extrabold uppercase tracking-wide mr-2 text-amber-900">
                Online Ordering Notice:
              </span>
              <span>
                {settings.order_pause_reason ||
                  settings.pause_ordering_message ||
                  'Online ordering is currently paused by restaurant management. Please visit our counter in person.'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Hero Section */}
      <section className="relative overflow-hidden pt-6 sm:pt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
              {/* Pill badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-soft-yellow/80 border border-brand-yellow/60 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-brand-black animate-pulse" />
                <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-brand-black">
                  Rotisserie • Char-Grill • Flaky Murtabak
                </span>
              </div>

              {/* Headline */}
              <h1 className="font-heading font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-brand-black leading-[1.08]">
                {settings?.hero_headline ? (
                  settings.hero_headline
                ) : (
                  <>
                    Authentic Flame-Roasted{' '}
                    <span className="relative inline-block text-brand-black underline decoration-brand-yellow decoration-wavy decoration-from-font">
                      Shawarma & Grills.
                    </span>
                  </>
                )}
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-brand-charcoal/80 max-w-xl font-sans leading-relaxed">
                {settings?.hero_subheadline ||
                  'Hand-stacked chicken rotisserie, authentic garlic toum, freshly griddled flaky chicken Murtabak, and golden crispy chicken starters.'}
              </p>

              {/* Mode Selector Card */}
              <div className="p-4 sm:p-5 rounded-3xl bg-white border border-brand-border shadow-card-subtle space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted">
                    How would you like to order today?
                  </span>
                  <span className="text-xs font-bold text-brand-black">
                    {mode === 'dining' ? 'Dine-In Active' : 'Self-Pickup Active'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('dining')}
                    className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      mode === 'dining'
                        ? 'border-brand-black bg-brand-yellow/30 ring-2 ring-brand-yellow shadow-sm'
                        : 'border-brand-border bg-brand-warm-white hover:border-brand-charcoal/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          mode === 'dining'
                            ? 'bg-brand-black text-brand-yellow'
                            : 'bg-white text-brand-black border border-brand-border'
                        }`}
                      >
                        <UtensilsCrossed className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-black/5 text-brand-black">
                        At Restaurant
                      </span>
                    </div>
                    <p className="font-heading font-bold text-sm sm:text-base text-brand-black">
                      Dine In
                    </p>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      {currentTable ? `Table ${currentTable.table_number}` : 'Scan table QR code'}
                    </p>
                  </button>

                  <button
                    onClick={() => setMode('takeaway')}
                    className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                      mode === 'takeaway'
                        ? 'border-brand-black bg-brand-yellow/30 ring-2 ring-brand-yellow shadow-sm'
                        : 'border-brand-border bg-brand-warm-white hover:border-brand-charcoal/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          mode === 'takeaway'
                            ? 'bg-brand-black text-brand-yellow'
                            : 'bg-white text-brand-black border border-brand-border'
                        }`}
                      >
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-brand-black/5 text-brand-black">
                        Self-Pickup
                      </span>
                    </div>
                    <p className="font-heading font-bold text-sm sm:text-base text-brand-black">
                      Takeaway
                    </p>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      Counter collection only
                    </p>
                  </button>
                </div>

                {/* Dining Table button helper */}
                {mode === 'dining' && (
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="text-brand-muted">
                      {currentTable
                        ? `Ordering for ${currentTable.section} (${currentTable.table_number})`
                        : 'No table assigned yet'}
                    </span>
                    <button
                      onClick={onOpenTableSelector}
                      className="font-bold text-brand-black hover:underline flex items-center gap-1"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>{currentTable ? 'Change Table' : 'Select / Scan Table'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/menu')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Explore Full Menu
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/my-orders')}
                  leftIcon={<Clock className="w-4 h-4 text-brand-black" />}
                >
                  Track Order
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onOpenTableSelector}
                  leftIcon={<QrCode className="w-4 h-4" />}
                >
                  Table QR Demo
                </Button>
              </div>

              {/* Quick Tracking Helper Callout */}
              <div className="pt-1">
                <Link
                  to="/my-orders"
                  className="inline-flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black transition-colors p-2 rounded-xl hover:bg-brand-soft-yellow/50"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Looking for an active order? Click here to view live kitchen progress & digital bill &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Right Media Grid */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Main Hero Photo */}
                <div className="relative z-10 rounded-3xl overflow-hidden shadow-dark-float border-4 border-white aspect-[4/5] bg-brand-black">
                  <img
                    src={settings?.hero_image_url || '/images/food/item-01-classic-shawarma-salad.jpg'}
                    alt="HANGOUT Authentic flame-roasted chicken shawarma"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                  {/* Overlaid Pill Badge */}
                  <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-white/20 shadow-lg text-brand-black flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                        House Specialty
                      </p>
                      <p className="font-heading font-extrabold text-sm text-brand-black">
                        Classic Chicken Shawarma (No Salad)
                      </p>
                    </div>
                    <span className="font-heading font-black text-brand-black text-sm bg-brand-yellow px-2.5 py-1 rounded-xl">
                      ₹180
                    </span>
                  </div>
                </div>

                {/* Floating Micro-Badge Top Left */}
                <div className="absolute -top-4 -left-4 z-20 bg-brand-black text-brand-yellow px-4 py-2.5 rounded-2xl shadow-premium border border-brand-charcoal flex items-center gap-2">
                  <Flame className="w-4 h-4 text-brand-yellow" />
                  <span className="font-heading font-bold text-xs">100% Rotisserie Chicken</span>
                </div>

                {/* Floating Micro-Badge Bottom Right */}
                <div className="absolute -bottom-4 -right-4 z-20 bg-brand-yellow text-brand-black px-4 py-2.5 rounded-2xl shadow-premium border border-brand-black/10 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-heading font-bold text-xs">Fresh Garlic Toum</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mandatory Takeaway Notice (Always present if takeaway mode is selected) */}
      {mode === 'takeaway' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <TakeawayNoticeBanner />
        </div>
      )}

      {/* 2. Menu Categories Preview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted">
              Curated Offerings
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-brand-black mt-1">
              Explore Our Categories
            </h2>
          </div>
          <Link
            to="/menu"
            className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-brand-black hover:text-amber-900 transition-colors group"
          >
            <span>View All Categories</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              to={`/menu?category=${cat.slug}`}
              className="group bg-white rounded-2xl border border-brand-border/80 p-3 hover:shadow-premium hover:-translate-y-1 transition-all duration-200 flex flex-col items-center text-center"
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 bg-brand-warm-white">
                <img
                  src={cat.image_url}
                  alt={cat.name}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <h3 className="font-heading font-bold text-xs sm:text-sm text-brand-black group-hover:text-amber-900 line-clamp-1">
                {cat.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Today's Specials */}
      {todaysSpecials.length > 0 && (
        <section id="specials" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="p-6 sm:p-10 rounded-3xl bg-brand-charcoal text-white relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand-yellow/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-yellow text-brand-black text-xs font-heading font-black uppercase tracking-wider mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Chef&apos;s Recommendations</span>
                  </div>
                  <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-white">
                    Today&apos;s Specials
                  </h2>
                </div>
                <Link
                  to="/menu"
                  className="text-xs font-heading font-bold text-brand-yellow hover:underline flex items-center gap-1"
                >
                  Full Menu Specials <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {todaysSpecials.slice(0, 4).map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onSelect={onSelectItem}
                    onQuickAdd={handleQuickAdd}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Popular Food Items */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-xs font-heading font-bold uppercase tracking-wider text-brand-muted">
              Most Loved
            </span>
            <h2 className="font-heading font-extrabold text-2xl sm:text-4xl text-brand-black mt-1">
              Popular at HANGOUT
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/menu')}
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
          >
            Explore Complete Menu
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {popularItems.slice(0, 8).map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onSelect={onSelectItem}
              onQuickAdd={handleQuickAdd}
            />
          ))}
        </div>
      </section>

      {/* 5. Dining vs Self-Pickup Policy Highlight */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dining Card */}
          <div className="p-8 rounded-3xl bg-white border border-brand-border flex flex-col justify-between shadow-card-subtle">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-yellow flex items-center justify-center text-brand-black">
                <QrCode className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-2xl text-brand-black">
                Seamless QR Table Ordering
              </h3>
              <p className="text-sm text-brand-muted leading-relaxed font-sans">
                Sit down at any dining table. Simply scan the table QR code to lock in your table number and order hot shawarmas, murtabak, and starters straight from your mobile screen.
              </p>
            </div>
            <div className="pt-6">
              <Button
                variant="secondary"
                size="md"
                onClick={onOpenTableSelector}
                leftIcon={<UtensilsCrossed className="w-4 h-4 text-brand-yellow" />}
              >
                Simulate QR Table Scan
              </Button>
            </div>
          </div>

          {/* Self-Pickup Card */}
          <div className="p-8 rounded-3xl bg-brand-black text-white border border-brand-charcoal flex flex-col justify-between shadow-premium relative overflow-hidden">
            <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-brand-charcoal border border-brand-yellow/40 flex items-center justify-center text-brand-yellow">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-bold text-2xl text-white">
                Zero Wait Self-Pickup
              </h3>
              <div className="p-3.5 rounded-xl bg-brand-charcoal border border-brand-charcoal text-xs text-gray-300">
                <span className="font-bold text-brand-yellow block mb-1">
                  NO HOME DELIVERY NOTICE:
                </span>
                <p className="text-[11px] leading-relaxed text-gray-300">
                  &ldquo;Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.&rdquo;
                </p>
              </div>
            </div>
            <div className="pt-6 relative z-10">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setMode('takeaway');
                  navigate('/menu');
                }}
                leftIcon={<ShoppingBag className="w-4 h-4" />}
              >
                Order for Counter Pickup
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. About Section */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="relative rounded-3xl overflow-hidden aspect-[4/3] bg-brand-charcoal shadow-premium">
            <img
              src="/images/food/item-02-grilled-shawarma-salad.jpg"
              alt="Authentic shawarma rotisserie cooking at HANGOUT"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <p className="font-heading font-bold text-lg">Indiranagar Kitchen</p>
              <p className="text-xs text-gray-300">100 Feet Road, Bengaluru</p>
            </div>
          </div>

          <div className="space-y-6 text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft-yellow text-brand-black text-xs font-heading font-extrabold uppercase tracking-wider">
              <Heart className="w-3.5 h-3.5 fill-brand-black" />
              <span>Our Philosophy</span>
            </div>
            <h2 className="font-heading font-extrabold text-3xl sm:text-5xl text-brand-black leading-tight">
              Slow-roasted to perfection. Carved fresh daily.
            </h2>
            <p className="text-sm sm:text-base text-brand-charcoal/80 leading-relaxed font-sans">
              HANGOUT is dedicated to authentic street-style shawarma, griddled chicken murtabak, and crispy chicken comfort foods. We marinate our whole cuts of fresh chicken for 24 hours in authentic Middle Eastern spices, stack each vertical spit daily, and serve every roll toasted with homemade garlic toum.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-brand-border">
              <div>
                <p className="font-heading font-black text-2xl text-brand-black">24 hrs</p>
                <p className="text-xs text-brand-muted mt-0.5">Spice Marination</p>
              </div>
              <div>
                <p className="font-heading font-black text-2xl text-brand-black">100%</p>
                <p className="text-xs text-brand-muted mt-0.5">Whole Chicken Cuts</p>
              </div>
              <div>
                <p className="font-heading font-black text-2xl text-brand-black">0 min</p>
                <p className="text-xs text-brand-muted mt-0.5">QR Wait Time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Location and Opening Hours */}
      <section id="location" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-3xl bg-white border border-brand-border shadow-card-subtle">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-xl text-brand-black">Location</h3>
              <p className="text-xs sm:text-sm text-brand-charcoal leading-relaxed font-sans">
                Plot 42, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038
              </p>
              <p className="text-xs text-brand-muted">Opposite Metro Pillar 124 • Valet Available</p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-xl text-brand-black">Timings</h3>
              <div className="space-y-1 text-xs sm:text-sm text-brand-charcoal font-sans">
                <p>
                  <strong className="font-bold text-brand-black">Mon — Sun:</strong> 12:00 PM – 11:30 PM
                </p>
                <p>
                  <strong className="font-bold text-brand-black">Late Night Spit:</strong> Till Midnight on Weekends
                </p>
              </div>
              <p className="text-xs text-emerald-700 font-semibold">Rotisserie spit active all day</p>
            </div>

            <div className="space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-xl text-brand-black">Orders & Inquiries</h3>
              <p className="text-xs sm:text-sm text-brand-charcoal font-sans">
                Direct phone: <strong className="font-bold text-brand-black">+91 80 4567 8900</strong>
              </p>
              <p className="text-xs sm:text-sm text-brand-charcoal font-sans">
                Email: <strong className="font-bold text-brand-black">contact@hangout.in</strong>
              </p>
              <div className="pt-1">
                <Button variant="secondary" size="sm" onClick={() => navigate('/menu')}>
                  Browse Menu & Prices
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

