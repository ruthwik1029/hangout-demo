import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  UtensilsCrossed,
  Globe,
  Tag,
  QrCode,
  Users,
  UserCheck,
  Receipt,
  Settings,
  History,
  LogOut,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';

interface AdminNavProps {
  title?: string;
  subtitle?: string;
}

export const AdminNav: React.FC<AdminNavProps> = ({ title, subtitle }) => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const navLinks = [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
    { to: '/admin/menu', label: 'Menu Catalog', icon: UtensilsCrossed },
    { to: '/admin/website', label: 'Website CMS', icon: Globe },
    { to: '/admin/promotions', label: 'Promotions', icon: Tag },
    { to: '/admin/qr', label: 'Tables & QR', icon: QrCode },
    { to: '/admin/customers', label: 'Customers', icon: Users },
    { to: '/admin/staff', label: 'Staff & Roles', icon: UserCheck },
    { to: '/admin/billing', label: 'Billing & Tax', icon: Receipt },
    { to: '/admin/settings', label: 'Operations', icon: Settings },
    { to: '/admin/activity', label: 'Activity History', icon: History },
  ];

  return (
    <div className="space-y-4 border-b border-brand-border pb-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-brand-yellow" />
            <span>HANGOUT Admin Command Centre {currentUser?.full_name ? `• ${currentUser.full_name}` : ''}</span>
            <span className="px-2 py-0.5 rounded-full bg-brand-yellow/30 text-brand-black text-[10px] font-bold">
              DEMO ENVIRONMENT
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black">
            {title || 'Management Portal'}
          </h1>
          {subtitle && <p className="text-xs text-brand-muted mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
              Customer Site
            </Button>
          </Link>

          <Link to="/staff">
            <Button variant="outline" size="sm" leftIcon={<QrCode className="w-3.5 h-3.5" />}>
              Staff Floor
            </Button>
          </Link>

          <Link to="/kitchen">
            <Button variant="outline" size="sm" leftIcon={<Layers className="w-3.5 h-3.5" />}>
              KDS
            </Button>
          </Link>

          <button
            onClick={() => {
              logout();
              navigate('/auth/portal-login');
            }}
            className="p-2 rounded-xl border border-brand-border hover:bg-red-50 text-red-600 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-heading font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-brand-black text-brand-yellow shadow-sm'
                    : 'bg-white border border-brand-border text-brand-charcoal hover:bg-brand-warm-white'
                }`
              }
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
};
