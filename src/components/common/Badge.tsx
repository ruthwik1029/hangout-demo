import React from 'react';
import { OrderMode } from '../../types';
import { Sparkles, UtensilsCrossed, ShoppingBag } from 'lucide-react';

export const VegIndicator: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  const container = size === 'sm' ? 'w-4 h-4 p-[2px]' : 'w-5 h-5 p-[3px]';
  const dot = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';

  return (
    <div
      className={`inline-flex items-center justify-center border-2 border-emerald-600 rounded-[3px] bg-white ${container}`}
      title="Vegetarian"
      aria-label="Vegetarian item"
    >
      <div className={`rounded-full bg-emerald-600 ${dot}`} />
    </div>
  );
};

export const NonVegIndicator: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => {
  const container = size === 'sm' ? 'w-4 h-4 p-[2px]' : 'w-5 h-5 p-[3px]';
  const triangle =
    size === 'sm'
      ? 'border-l-[4px] border-r-[4px] border-b-[7px]'
      : 'border-l-[5px] border-r-[5px] border-b-[9px]';

  return (
    <div
      className={`inline-flex items-center justify-center border-2 border-amber-800 rounded-[3px] bg-white ${container}`}
      title="Non-Vegetarian"
      aria-label="Non-Vegetarian item"
    >
      <div
        className={`w-0 h-0 border-l-transparent border-r-transparent border-b-amber-800 ${triangle}`}
      />
    </div>
  );
};

export const DietBadge: React.FC<{ isVeg: boolean }> = ({ isVeg }) => {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/90 shadow-sm border border-black/5 backdrop-blur-sm">
      {isVeg ? <VegIndicator size="sm" /> : <NonVegIndicator size="sm" />}
      <span className={isVeg ? 'text-emerald-800' : 'text-amber-900'}>
        {isVeg ? 'Veg' : 'Non-Veg'}
      </span>
    </div>
  );
};

export const ModeBadge: React.FC<{ mode: OrderMode; tableNumber?: string | null }> = ({
  mode,
  tableNumber,
}) => {
  if (mode === 'dining') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-yellow text-brand-black border border-brand-yellow shadow-sm">
        <UtensilsCrossed className="w-3.5 h-3.5" />
        Dining {tableNumber ? `• Table ${tableNumber}` : '• Select Table'}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-charcoal text-white border border-brand-charcoal shadow-sm">
      <ShoppingBag className="w-3.5 h-3.5 text-brand-yellow" />
      Self-Pickup Only
    </span>
  );
};

export const SpecialBadge: React.FC<{ label?: string }> = ({ label = "Today's Special" }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-black text-brand-yellow border border-brand-yellow/30 shadow-sm">
      <Sparkles className="w-3 h-3 text-brand-yellow" />
      {label}
    </span>
  );
};
