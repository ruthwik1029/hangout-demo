import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useOrderMode } from '../../context/OrderModeContext';
import { useCart } from '../../context/CartContext';
import { useCustomer } from '../../context/CustomerContext';
import { Button } from '../common/Button';
import {
  UtensilsCrossed,
  ShoppingBag,
  ShoppingCart,
  User,
  Menu as MenuIcon,
  X,
  QrCode,
  Shield,
} from 'lucide-react';

interface NavbarProps {
  onOpenTableSelector: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenTableSelector, onOpenProfile }) => {
  const { mode, setMode, currentTable } = useOrderMode();
  const { activeItemCount, openCart } = useCart();
  const { currentCustomer, isAuthenticated, openRegisterModal } = useCustomer();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-brand-warm-white/90 backdrop-blur-md border-b border-brand-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-2xl bg-brand-yellow flex items-center justify-center font-heading font-black text-2xl text-brand-black shadow-sm group-hover:scale-105 transition-transform duration-200">
              H
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-heading font-extrabold text-2xl tracking-tighter text-brand-black leading-none">
                  HANGOUT
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-heading font-extrabold tracking-wider uppercase bg-brand-yellow/40 text-brand-black border border-brand-yellow">
                  DEMO
                </span>
              </div>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-brand-muted">
                Shawarma & Grills
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1 ml-4 text-xs font-heading font-bold uppercase tracking-wider">
            <Link
              to="/"
              className={`px-3.5 py-2 rounded-xl transition-colors ${
                isActive('/')
                  ? 'bg-brand-black text-brand-yellow'
                  : 'text-brand-charcoal hover:bg-brand-black/5 hover:text-brand-black'
              }`}
            >
              Home
            </Link>
            <Link
              to="/menu"
              className={`px-3.5 py-2 rounded-xl transition-colors ${
                isActive('/menu')
                  ? 'bg-brand-black text-brand-yellow'
                  : 'text-brand-charcoal hover:bg-brand-black/5 hover:text-brand-black'
              }`}
            >
              Menu
            </Link>
            <a
              href="/#specials"
              className="px-3.5 py-2 rounded-xl text-brand-charcoal hover:bg-brand-black/5 hover:text-brand-black transition-colors"
            >
              Specials
            </a>
            <a
              href="/#about"
              className="px-3.5 py-2 rounded-xl text-brand-charcoal hover:bg-brand-black/5 hover:text-brand-black transition-colors"
            >
              About
            </a>
            <a
              href="/#location"
              className="px-3.5 py-2 rounded-xl text-brand-charcoal hover:bg-brand-black/5 hover:text-brand-black transition-colors"
            >
              Visit Us
            </a>
          </nav>
        </div>

        {/* Center / Mode Selector */}
        <div className="hidden sm:flex items-center bg-white p-1 rounded-2xl border border-brand-border shadow-card-subtle">
          <button
            onClick={() => setMode('dining')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all ${
              mode === 'dining'
                ? 'bg-brand-black text-brand-yellow shadow-sm'
                : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Dining In</span>
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

        {/* Right Section: Table Pill, Cart, Profile & Portal */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Dining Table Pill */}
          {mode === 'dining' && (
            <button
              onClick={onOpenTableSelector}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-soft-yellow text-brand-black border border-brand-yellow/80 text-xs font-heading font-bold hover:bg-brand-yellow transition-all"
              title="Click to change or select table"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{currentTable ? `Table ${currentTable.table_number}` : 'Select Table'}</span>
            </button>
          )}

          {/* Cart Trigger */}
          <button
            onClick={openCart}
            className="relative p-2.5 rounded-2xl bg-white border border-brand-border text-brand-black hover:border-brand-charcoal/30 shadow-card-subtle transition-all active:scale-95"
            aria-label="Open Cart"
          >
            <ShoppingCart className="w-5 h-5 text-brand-black" />
            {activeItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-black text-brand-yellow text-[10px] font-heading font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-brand-warm-white">
                {activeItemCount}
              </span>
            )}
          </button>

          {/* Customer Profile / Register */}
          {isAuthenticated && currentCustomer ? (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-2xl bg-white border border-brand-border hover:border-brand-charcoal/30 text-xs font-heading font-bold text-brand-black shadow-card-subtle transition-all"
            >
              <div className="w-7 h-7 rounded-xl bg-brand-yellow flex items-center justify-center text-xs font-black">
                {currentCustomer.full_name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden md:inline max-w-[100px] truncate">
                {currentCustomer.full_name.split(' ')[0]}
              </span>
            </button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={openRegisterModal}
              className="hidden sm:inline-flex"
              leftIcon={<User className="w-3.5 h-3.5" />}
            >
              Check-In
            </Button>
          )}

          {/* Portal Gateway Pill */}
          <Link
            to="/auth/portal-login"
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-charcoal text-white hover:bg-brand-black border border-brand-charcoal text-xs font-heading font-semibold transition-all"
            title="Admin, Staff & Kitchen Portal Foundation"
          >
            <Shield className="w-3.5 h-3.5 text-brand-yellow" />
            <span>Portals</span>
          </Link>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-2xl bg-white border border-brand-border text-brand-black"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-brand-border px-4 py-4 space-y-3 animate-fade-in shadow-xl">
          {/* Mobile Mode Switcher */}
          <div className="bg-brand-warm-white p-1 rounded-2xl border border-brand-border flex items-center">
            <button
              onClick={() => {
                setMode('dining');
                setMobileMenuOpen(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-heading font-bold ${
                mode === 'dining'
                  ? 'bg-brand-black text-brand-yellow shadow-sm'
                  : 'text-brand-muted'
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              <span>Dining</span>
            </button>
            <button
              onClick={() => {
                setMode('takeaway');
                setMobileMenuOpen(false);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-heading font-bold ${
                mode === 'takeaway'
                  ? 'bg-brand-black text-brand-yellow shadow-sm'
                  : 'text-brand-muted'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Self-Pickup</span>
            </button>
          </div>

          <div className="flex flex-col gap-1 text-sm font-heading font-bold">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl text-brand-black hover:bg-brand-warm-white"
            >
              Home
            </Link>
            <Link
              to="/menu"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl text-brand-black hover:bg-brand-warm-white"
            >
              Menu
            </Link>
            <a
              href="/#specials"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl text-brand-black hover:bg-brand-warm-white"
            >
              Today&apos;s Specials
            </a>
            <a
              href="/#about"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl text-brand-black hover:bg-brand-warm-white"
            >
              About HANGOUT
            </a>
            <a
              href="/#location"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2.5 rounded-xl text-brand-black hover:bg-brand-warm-white"
            >
              Opening Hours & Location
            </a>
          </div>

          <div className="pt-2 border-t border-brand-border flex items-center justify-between">
            <Link
              to="/auth/portal-login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted hover:text-brand-black"
            >
              <Shield className="w-4 h-4 text-brand-yellow" />
              Staff / Admin Portals
            </Link>
            {!isAuthenticated && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openRegisterModal();
                }}
              >
                Customer Check-In
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
