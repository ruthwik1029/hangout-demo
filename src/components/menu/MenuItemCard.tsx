import React from 'react';
import { MenuItem } from '../../types';
import { VegIndicator, NonVegIndicator, SpecialBadge } from '../common/Badge';
import { Clock, Plus, SlidersHorizontal } from 'lucide-react';

interface MenuItemCardProps {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
}

export const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, onSelect, onQuickAdd }) => {
  const hasCustomizations = (item.variants && item.variants.length > 0) || (item.addons && item.addons.length > 0);

  return (
    <div
      onClick={() => onSelect(item)}
      className="group bg-white rounded-3xl border border-brand-border/70 p-3 sm:p-4 flex flex-col justify-between transition-all duration-300 hover:shadow-premium hover:-translate-y-1 cursor-pointer overflow-hidden relative"
    >
      {/* Top Media Container */}
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden mb-3 bg-brand-warm-white">
        <img
          src={item.image_url}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Veg/Non-Veg Badge */}
        <div className="absolute top-2.5 left-2.5">
          {item.is_veg ? <VegIndicator size="md" /> : <NonVegIndicator size="md" />}
        </div>

        {/* Today's Special or Featured Badge */}
        {item.is_today_special ? (
          <div className="absolute top-2.5 right-2.5">
            <SpecialBadge label="Chef's Special" />
          </div>
        ) : item.is_featured ? (
          <div className="absolute top-2.5 right-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-yellow text-brand-black px-2 py-0.5 rounded-full shadow-sm">
              Popular
            </span>
          </div>
        ) : null}

        {/* Prep Time pill */}
        <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
          <Clock className="w-3 h-3 text-brand-yellow" />
          <span>{item.preparation_time_mins} mins</span>
        </div>
      </div>

      {/* Item Info */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-heading font-bold text-base text-brand-black group-hover:text-amber-900 transition-colors line-clamp-1">
            {item.name}
          </h3>
        </div>

        <p className="text-xs text-brand-muted line-clamp-2 leading-relaxed mb-3">
          {item.description}
        </p>

        {/* Bottom Price & Add Action */}
        <div className="mt-auto pt-3 border-t border-brand-border/60 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-brand-muted uppercase tracking-wider block">
              {hasCustomizations ? 'From' : 'Price'}
            </span>
            <span className="font-heading font-extrabold text-lg text-brand-black">
              ₹{item.base_price.toFixed(0)}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasCustomizations) {
                onSelect(item);
              } else {
                onQuickAdd(item);
              }
            }}
            className="flex items-center gap-1 text-xs font-heading font-bold px-3 py-1.5 rounded-xl transition-all duration-200 bg-brand-soft-yellow/80 hover:bg-brand-yellow text-brand-black border border-brand-yellow/60 hover:shadow-glow-yellow active:scale-95"
            aria-label={`Add ${item.name} to cart`}
          >
            {hasCustomizations ? (
              <>
                <SlidersHorizontal className="w-3 h-3" />
                <span>Custom</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

