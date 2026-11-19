import React from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import { VegIndicator } from '../common/Badge';

interface MenuFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  vegOnly: boolean;
  onVegOnlyChange: (vegOnly: boolean) => void;
  sortBy: 'featured' | 'price-asc' | 'price-desc' | 'prep-time';
  onSortChange: (sort: 'featured' | 'price-asc' | 'price-desc' | 'prep-time') => void;
  totalFilteredCount: number;
}

export const MenuFilterBar: React.FC<MenuFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  vegOnly,
  onVegOnlyChange,
  sortBy,
  onSortChange,
  totalFilteredCount,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-brand-border/80 shadow-card-subtle mb-6">
      {/* Search Input */}
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-brand-muted">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search shawarmas, murtabak, starters..."
          className="w-full pl-9 pr-8 py-2 bg-brand-warm-white border border-brand-border/60 rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-brand-black transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-brand-muted hover:text-brand-black"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter and Sort Controls */}
      <div className="flex items-center gap-2">
        {/* Veg-Only Toggle */}
        <button
          onClick={() => onVegOnlyChange(!vegOnly)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-heading font-semibold border transition-all ${
            vegOnly
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-2 ring-emerald-400/30'
              : 'bg-brand-warm-white text-brand-black border-brand-border hover:border-brand-charcoal/40'
          }`}
        >
          <VegIndicator size="sm" />
          <span>Veg Only</span>
        </button>

        {/* Sort Select */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) =>
              onSortChange(
                e.target.value as 'featured' | 'price-asc' | 'price-desc' | 'prep-time'
              )
            }
            className="appearance-none bg-brand-warm-white border border-brand-border text-xs font-heading font-semibold text-brand-black rounded-xl px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-brand-yellow cursor-pointer"
          >
            <option value="featured">Featured First</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="prep-time">Fastest Prep</option>
          </select>
          <SlidersHorizontal className="w-3 h-3 text-brand-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Counter */}
        <span className="hidden md:inline-block text-[11px] font-semibold text-brand-muted px-2 py-1 bg-brand-warm-white rounded-lg border border-brand-border/60">
          {totalFilteredCount} {totalFilteredCount === 1 ? 'item' : 'items'}
        </span>
      </div>
    </div>
  );
};

