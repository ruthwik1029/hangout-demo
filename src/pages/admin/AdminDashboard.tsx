import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import {
  Utensils,
  Settings,
  QrCode,
  DollarSign,
  TrendingUp,
  Users,
  LogOut,
  ArrowLeft,
  Shield,
  Layers,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-brand-yellow" />
            <span>HANGOUT Admin Portal Foundation</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-brand-black">
            Management Overview
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Logged in as <strong className="text-brand-black">{currentUser?.full_name}</strong> ({currentUser?.role_id})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Customer Site
            </Button>
          </Link>
          <Link to="/admin/settings">
            <Button variant="primary" size="sm" leftIcon={<Settings className="w-4 h-4" />}>
              Cafe & GST Settings
            </Button>
          </Link>
          <button
            onClick={logout}
            className="p-2.5 rounded-xl border border-brand-border hover:bg-red-50 text-red-600 transition-colors"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Today&apos;s Revenue (Demo)</span>
            <DollarSign className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-brand-black">₹18,450.00</p>
          <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +14.2% from yesterday
          </p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Active Cafe Tables</span>
            <QrCode className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-brand-black">6 / 8 Tables</p>
          <p className="text-[11px] text-brand-muted font-medium">Patio & Main Floor Active</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Registered Customers</span>
            <Users className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-brand-black">142 Guests</p>
          <p className="text-[11px] text-brand-muted font-medium">Safe session persistence</p>
        </div>

        <div className="p-5 bg-white rounded-3xl border border-brand-border shadow-card-subtle space-y-2">
          <div className="flex items-center justify-between text-brand-muted text-xs font-bold uppercase tracking-wider">
            <span>Active Menu Items</span>
            <Utensils className="w-4 h-4 text-brand-yellow" />
          </div>
          <p className="font-heading font-extrabold text-2xl text-brand-black">16 Dishes</p>
          <p className="text-[11px] text-brand-muted font-medium">6 Categories in DB</p>
        </div>
      </div>

      {/* Admin Quick Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
              <Settings className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-lg text-brand-black">
              Cafe Settings & GST Rates
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed font-sans">
              Configure business info, toggle Dining and Takeaway availability, set GST percentage and edit takeaway notice.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => navigate('/admin/settings')}>
            Manage Settings
          </Button>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-lg text-brand-black">
              Tables & QR Codes
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed font-sans">
              View floor layout, 8 seeded cafe tables, print QR codes, and monitor real-time occupancy state.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/staff')}>
            Floor / Table View
          </Button>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-brand-border shadow-card-subtle flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-lg text-brand-black">
              Kitchen Display Queue
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed font-sans">
              Monitor active cooking tickets, preparation time tracking, and order fulfillment status.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/kitchen')}>
            Open KDS Portal
          </Button>
        </div>
      </div>
    </div>
  );
};
