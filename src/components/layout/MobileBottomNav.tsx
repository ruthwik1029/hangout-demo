import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Utensils, ShoppingCart, User, ClipboardList } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useCustomer } from '../../context/CustomerContext';

interface MobileBottomNavProps {
  onOpenProfile: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenProfile }) => {
  const location = useLocation();
  const { activeItemCount, openCart } = useCart();
  const { isAuthenticated, openRegisterModal } = useCustomer();

  const isHome = location.pathname === '/';
  const isMenu = location.pathname === '/menu';
  const isOrders = location.pathname === '/my-orders' || location.pathname.startsWith('/track/');

  return (
    <div className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-brand-border px-3 py-2 flex items-center justify-around shadow-2xl">
      {/* Home */}
      <Link
        to="/"
        className={`flex flex-col items-center gap-1 p-1.5 transition-colors ${
          isHome ? 'text-brand-black' : 'text-brand-muted hover:text-brand-black'
        }`}
      >
        <div className={`p-1 rounded-xl ${isHome ? 'bg-brand-yellow/30' : ''}`}>
          <Home className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-heading font-bold">Home</span>
      </Link>

      {/* Menu */}
      <Link
        to="/menu"
        className={`flex flex-col items-center gap-1 p-1.5 transition-colors ${
          isMenu ? 'text-brand-black' : 'text-brand-muted hover:text-brand-black'
        }`}
      >
        <div className={`p-1 rounded-xl ${isMenu ? 'bg-brand-yellow/30' : ''}`}>
          <Utensils className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-heading font-bold">Menu</span>
      </Link>

      {/* Track Orders */}
      <Link
        to="/my-orders"
        className={`flex flex-col items-center gap-1 p-1.5 transition-colors ${
          isOrders ? 'text-brand-black' : 'text-brand-muted hover:text-brand-black'
        }`}
      >
        <div className={`p-1 rounded-xl ${isOrders ? 'bg-brand-yellow/30' : ''}`}>
          <ClipboardList className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-heading font-bold">Orders</span>
      </Link>

      {/* Cart */}
      <button
        onClick={openCart}
        className="relative flex flex-col items-center gap-1 p-1.5 text-brand-muted hover:text-brand-black transition-colors"
      >
        <div className="p-1 rounded-xl relative">
          <ShoppingCart className="w-5 h-5 text-brand-black" />
          {activeItemCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-brand-yellow text-brand-black text-[10px] font-heading font-black w-4 h-4 rounded-full flex items-center justify-center border border-white">
              {activeItemCount}
            </span>
          )}
        </div>
        <span className="text-[10px] font-heading font-bold text-brand-black">Cart</span>
      </button>

      {/* Profile */}
      <button
        onClick={isAuthenticated ? onOpenProfile : openRegisterModal}
        className="flex flex-col items-center gap-1 p-1.5 text-brand-muted hover:text-brand-black transition-colors"
      >
        <div className="p-1 rounded-xl">
          <User className="w-5 h-5" />
        </div>
        <span className="text-[10px] font-heading font-bold">
          {isAuthenticated ? 'Profile' : 'Sign In'}
        </span>
      </button>
    </div>
  );
};

