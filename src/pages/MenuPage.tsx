import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MenuItem, MenuCategory, CafeSettings } from '../types';
import { CategoryPills } from '../components/menu/CategoryPills';
import { MenuFilterBar } from '../components/menu/MenuFilterBar';
import { MenuItemCard } from '../components/menu/MenuItemCard';
import { TakeawayNoticeBanner } from '../components/layout/TakeawayNoticeBanner';
import { fetchCafeSettings } from '../lib/supabase';
import { useOrderMode } from '../context/OrderModeContext';
import { useCart } from '../context/CartContext';
import { EmptyState } from '../components/common/EmptyState';
import { UtensilsCrossed, ShoppingBag, QrCode, AlertTriangle, Sparkles } from 'lucide-react';

interface MenuPageProps {
  categories: MenuCategory[];
  menuItems: MenuItem[];
  onSelectItem: (item: MenuItem) => void;
  onOpenTableSelector: () => void;
}

export const MenuPage: React.FC<MenuPageProps> = ({
  categories,
  menuItems,
  onSelectItem,
  onOpenTableSelector,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategorySlug = searchParams.get('category');

  const { mode, setMode, currentTable } = useOrderMode();
  const { addItem } = useCart();
  const [settings, setSettings] = useState<CafeSettings | null>(null);

  useEffect(() => {
    fetchCafeSettings().then(setSettings);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [vegOnly, setVegOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc' | 'prep-time'>(
    'featured'
  );

  // Find active category ID based on slug
  const selectedCategoryId = useMemo(() => {
    if (!activeCategorySlug) return null;
    const matched = categories.find((c) => c.slug === activeCategorySlug);
    return matched ? matched.id : null;
  }, [activeCategorySlug, categories]);

  const handleSelectCategory = (id: string | null) => {
    if (!id) {
      searchParams.delete('category');
      setSearchParams(searchParams);
    } else {
      const cat = categories.find((c) => c.id === id);
      if (cat) {
        setSearchParams({ category: cat.slug });
      }
    }
  };

  // Filter items
  const filteredItems = useMemo(() => {
    let result = [...menuItems];

    // Category filter
    if (selectedCategoryId) {
      result = result.filter((item) => item.category_id === selectedCategoryId);
    }

    // Veg Only filter
    if (vegOnly) {
      result = result.filter((item) => item.is_veg);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          (item.allergens && item.allergens.some((a) => a.toLowerCase().includes(q)))
      );
    }

    // Sorting
    switch (sortBy) {
      case 'price-asc':
        result.sort((a, b) => a.base_price - b.base_price);
        break;
      case 'price-desc':
        result.sort((a, b) => b.base_price - a.base_price);
        break;
      case 'prep-time':
        result.sort((a, b) => a.preparation_time_mins - b.preparation_time_mins);
        break;
      case 'featured':
      default:
        result.sort((a, b) => {
          if (a.is_today_special !== b.is_today_special) return a.is_today_special ? -1 : 1;
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
          return a.display_order - b.display_order;
        });
        break;
    }

    return result;
  }, [menuItems, selectedCategoryId, vegOnly, searchQuery, sortBy]);

  const activeCategoryName = useMemo(() => {
    if (!selectedCategoryId) return 'Complete Menu';
    const cat = categories.find((c) => c.id === selectedCategoryId);
    return cat ? cat.name : 'Complete Menu';
  }, [selectedCategoryId, categories]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-24">
      {/* Dynamic Announcement Banner */}
      {settings?.announcement_banner?.is_enabled && settings.announcement_banner.text && (
        <div className="bg-brand-black text-brand-yellow px-4 py-2.5 rounded-2xl text-center text-xs font-heading font-bold flex items-center justify-center gap-2 border border-brand-yellow/30 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-brand-yellow animate-pulse" />
          <span>{settings.announcement_banner.text}</span>
        </div>
      )}

      {/* Online Ordering Paused Notice */}
      {settings?.is_online_ordering_paused && (
        <div className="p-4 bg-amber-500/15 border-2 border-amber-500/50 rounded-2xl flex items-center gap-3 text-amber-950 font-medium text-xs sm:text-sm">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
          <div>
            <span className="font-heading font-extrabold uppercase tracking-wide mr-2 text-amber-900">
              Online Ordering Notice:
            </span>
            <span>
              {settings.order_pause_reason ||
                settings.pause_ordering_message ||
                'Online ordering is currently suspended. Please visit our restaurant counter.'}
            </span>
          </div>
        </div>
      )}

      {/* Top Header & Mode Status Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-brand-black tracking-tight">
            HANGOUT Restaurant Menu
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1 font-sans">
            Authentic rotisserie chicken shawarmas, freshly griddled flaky murtabak & crispy chicken starters.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-white p-1 rounded-2xl border border-brand-border shadow-card-subtle">
          <button
            onClick={() => setMode('dining')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              mode === 'dining'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Dining</span>
          </button>
          <button
            onClick={() => setMode('takeaway')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              mode === 'takeaway'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Self-Pickup</span>
          </button>
        </div>
      </div>

      {/* Mode Status Pill & Takeaway Notice */}
      {mode === 'dining' ? (
        <div className="p-3.5 rounded-2xl bg-brand-soft-yellow/60 border border-brand-yellow/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 font-heading font-bold text-brand-black">
            <QrCode className="w-4 h-4 text-brand-black" />
            <span>
              {currentTable
                ? `Dine-In Session: Table ${currentTable.table_number} (${currentTable.section})`
                : 'Dine-In Session: Please assign your table before submitting orders.'}
            </span>
          </div>
          <button
            onClick={onOpenTableSelector}
            className="text-xs font-bold text-brand-black underline hover:text-amber-900"
          >
            {currentTable ? 'Change Table' : 'Select Table'}
          </button>
        </div>
      ) : (
        <TakeawayNoticeBanner />
      )}

      {/* Categories Navigation Bar */}
      <div className="sticky top-20 z-20 bg-brand-warm-white/95 backdrop-blur-md pt-2 pb-2">
        <CategoryPills
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
        />
      </div>

      {/* Filter and Search Bar */}
      <MenuFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        vegOnly={vegOnly}
        onVegOnlyChange={setVegOnly}
        sortBy={sortBy}
        onSortChange={setSortBy}
        totalFilteredCount={filteredItems.length}
      />

      {/* Section Title */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading font-bold text-xl text-brand-black">
          {activeCategoryName}{' '}
          <span className="text-xs font-normal text-brand-muted">
            ({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'})
          </span>
        </h2>
      </div>

      {/* Menu Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="search"
          title="No Matching Items Found"
          description="We couldn't find any dishes or drinks matching your current filters. Try resetting the filters or clearing your search."
          actionText="Reset All Filters"
          onAction={() => {
            setSearchQuery('');
            setVegOnly(false);
            handleSelectCategory(null);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              onSelect={onSelectItem}
              onQuickAdd={(item) => addItem(item, 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

