import React from 'react';
import { ShoppingBag, AlertCircle } from 'lucide-react';
import { EXACT_TAKEAWAY_NOTICE } from '../../context/OrderModeContext';

export const TakeawayNoticeBanner: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="bg-brand-charcoal text-white px-4 py-2 text-xs flex items-center justify-between gap-3 border-b border-brand-yellow/30">
        <div className="flex items-center gap-2 overflow-hidden">
          <ShoppingBag className="w-3.5 h-3.5 text-brand-yellow shrink-0" />
          <span className="font-heading font-medium tracking-wide text-brand-yellow shrink-0">
            SELF-PICKUP ONLY:
          </span>
          <span className="truncate text-gray-300">
            {EXACT_TAKEAWAY_NOTICE}
          </span>
        </div>
        <span className="shrink-0 text-[10px] bg-brand-yellow text-brand-black px-2 py-0.5 rounded-full font-bold">
          No Delivery
        </span>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-brand-charcoal to-brand-black text-white p-4 sm:p-5 rounded-2xl border border-brand-yellow/30 shadow-premium relative overflow-hidden my-4">
      {/* Decorative accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-yellow/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-brand-yellow/20 border border-brand-yellow/40 flex items-center justify-center shrink-0 mt-0.5">
            <ShoppingBag className="w-5 h-5 text-brand-yellow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-sm text-brand-yellow uppercase tracking-wider">
                Self-Pickup Order Policy
              </span>
              <span className="bg-brand-yellow/20 text-brand-yellow text-[10px] px-2 py-0.5 rounded-full font-semibold border border-brand-yellow/30">
                Notice
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-200 mt-1 leading-relaxed max-w-2xl font-sans">
              &ldquo;{EXACT_TAKEAWAY_NOTICE}&rdquo;
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 text-xs text-brand-muted bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
          <AlertCircle className="w-4 h-4 text-brand-yellow shrink-0" />
          <span>Collect at HANGOUT Counter</span>
        </div>
      </div>
    </div>
  );
};

