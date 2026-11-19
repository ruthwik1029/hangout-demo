import React from 'react';
import { MenuCategory } from '../../types';
import { Coffee, Sparkles, Utensils, Flame, Soup, Cake, Grid } from 'lucide-react';

interface CategoryPillsProps {
  categories: MenuCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
}

export const CategoryPills: React.FC<CategoryPillsProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
}) => {
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Coffee':
        return <Coffee className="w-4 h-4" />;
      case 'Sparkles':
        return <Sparkles className="w-4 h-4" />;
      case 'Utensils':
        return <Utensils className="w-4 h-4" />;
      case 'Flame':
        return <Flame className="w-4 h-4" />;
      case 'Bowl':
        return <Soup className="w-4 h-4" />;
      case 'Cake':
        return <Cake className="w-4 h-4" />;
      default:
        return <Grid className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 hide-scrollbar">
      {/* "All Items" Pill */}
      <button
        onClick={() => onSelectCategory(null)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-heading font-bold whitespace-nowrap transition-all select-none shrink-0 ${
          selectedCategoryId === null
            ? 'bg-brand-black text-brand-yellow shadow-sm border border-brand-charcoal'
            : 'bg-white text-brand-black hover:bg-brand-soft-yellow/40 border border-brand-border'
        }`}
      >
        <Grid className="w-4 h-4" />
        <span>All Items</span>
      </button>

      {/* Category List */}
      {categories.map((cat) => {
        const isSelected = selectedCategoryId === cat.id;
        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-heading font-bold whitespace-nowrap transition-all select-none shrink-0 ${
              isSelected
                ? 'bg-brand-black text-brand-yellow shadow-sm border border-brand-charcoal'
                : 'bg-white text-brand-black hover:bg-brand-soft-yellow/40 border border-brand-border'
            }`}
          >
            {getIcon(cat.icon_name)}
            <span>{cat.name}</span>
          </button>
        );
      })}
    </div>
  );
};

