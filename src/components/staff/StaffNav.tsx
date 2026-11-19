import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import {
  Shield,
  UtensilsCrossed,
  Layers,
  LayoutDashboard,
  ExternalLink,
  LogOut,
  Coffee,
} from 'lucide-react';

interface StaffNavProps {
  activeTab: 'tables' | 'approvals' | 'active_orders' | 'billing';
  onTabChange: (tab: 'tables' | 'approvals' | 'active_orders' | 'billing') => void;
  pendingApprovalsCount: number;
  activeOrdersCount: number;
}

export const StaffNav: React.FC<StaffNavProps> = ({
  activeTab,
  onTabChange,
  pendingApprovalsCount,
  activeOrdersCount,
}) => {
  const { currentUser, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 border-b border-brand-border pb-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-brand-yellow" />
            <span>HANGOUT Service Crew Floor • {currentUser?.full_name || 'Staff Member'}</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black flex items-center gap-2.5">
            <span>Floor & Waiter Operations</span>
            <span className="text-xs font-heading font-bold px-2.5 py-1 rounded-full bg-brand-soft-yellow text-brand-black uppercase border border-brand-yellow">
              {currentUser?.role_id || 'waiter'}
            </span>
          </h1>
        </div>

        {/* Cross-portal Shortcuts */}
        <div className="flex items-center flex-wrap gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
              Customer Site
            </Button>
          </Link>

          <Link to="/kitchen">
            <Button variant="outline" size="sm" leftIcon={<Layers className="w-3.5 h-3.5 text-amber-500" />}>
              Kitchen KDS
            </Button>
          </Link>

          {hasRole(['admin']) && (
            <Link to="/admin">
              <Button variant="outline" size="sm" leftIcon={<LayoutDashboard className="w-3.5 h-3.5 text-purple-600" />}>
                Admin Portal
              </Button>
            </Link>
          )}

          <button
            onClick={() => {
              logout();
              navigate('/auth/portal-login');
            }}
            className="p-2 rounded-xl border border-brand-border hover:bg-red-50 text-red-600 transition-colors"
            title="Log out staff session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pt-2 scrollbar-none">
        <button
          onClick={() => onTabChange('tables')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all whitespace-nowrap ${
            activeTab === 'tables'
              ? 'bg-brand-black text-brand-yellow shadow-sm'
              : 'bg-white text-brand-charcoal hover:bg-brand-soft-yellow/50 border border-brand-border'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>Table & Floor Map</span>
        </button>

        <button
          onClick={() => onTabChange('approvals')}
          className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all whitespace-nowrap ${
            activeTab === 'approvals'
              ? 'bg-brand-black text-brand-yellow shadow-sm'
              : 'bg-white text-brand-charcoal hover:bg-brand-soft-yellow/50 border border-brand-border'
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>Dining Order Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-brand-black animate-pulse">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('active_orders')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all whitespace-nowrap ${
            activeTab === 'active_orders'
              ? 'bg-brand-black text-brand-yellow shadow-sm'
              : 'bg-white text-brand-charcoal hover:bg-brand-soft-yellow/50 border border-brand-border'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Active Service Orders</span>
          {activeOrdersCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-brand-charcoal text-brand-yellow">
              {activeOrdersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => onTabChange('billing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-heading font-bold transition-all whitespace-nowrap ${
            activeTab === 'billing'
              ? 'bg-brand-black text-brand-yellow shadow-sm'
              : 'bg-white text-brand-charcoal hover:bg-brand-soft-yellow/50 border border-brand-border'
          }`}
        >
          <span className="font-mono text-sm font-black">₹</span>
          <span>Billing & Split Bills</span>
        </button>
      </div>
    </div>
  );
};
