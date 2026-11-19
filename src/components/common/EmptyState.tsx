import React from 'react';
import { ShoppingBag, Search, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: 'cart' | 'search' | 'food';
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'cart',
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 sm:p-12 my-6 bg-white rounded-3xl border border-brand-border/60 shadow-card-subtle">
      <div className="w-16 h-16 rounded-2xl bg-brand-soft-yellow/60 flex items-center justify-center text-brand-black mb-4">
        {icon === 'cart' && <ShoppingBag className="w-8 h-8 text-brand-black" />}
        {icon === 'search' && <Search className="w-8 h-8 text-brand-black" />}
        {icon === 'food' && <Sparkles className="w-8 h-8 text-brand-black" />}
      </div>
      <h3 className="font-heading font-bold text-lg text-brand-black mb-1">{title}</h3>
      <p className="text-sm text-brand-muted max-w-sm mb-6">{description}</p>
      {actionText && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
