import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return <div className={`animate-pulse bg-brand-charcoal/10 rounded-xl ${className}`} />;
};

export const MenuItemSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl border border-brand-border p-4 flex flex-col gap-3 shadow-card-subtle">
      <Skeleton className="w-full h-44 rounded-xl" />
      <div className="flex items-center justify-between">
        <Skeleton className="w-16 h-4" />
        <Skeleton className="w-20 h-4" />
      </div>
      <Skeleton className="w-3/4 h-5" />
      <Skeleton className="w-full h-8" />
      <div className="flex items-center justify-between mt-auto pt-2">
        <Skeleton className="w-16 h-6" />
        <Skeleton className="w-24 h-9 rounded-xl" />
      </div>
    </div>
  );
};
