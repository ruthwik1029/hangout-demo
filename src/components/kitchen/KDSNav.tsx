import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { KitchenStation } from '../../types';
import {
  Flame,
  LayoutDashboard,
  UtensilsCrossed,
  ExternalLink,
  LogOut,
  Filter,
} from 'lucide-react';

interface KDSNavProps {
  stations: KitchenStation[];
  selectedStation: string;
  onSelectStation: (code: string) => void;
  statusFilter: 'active' | 'preparing' | 'ready' | 'completed' | 'all';
  onStatusFilterChange: (status: 'active' | 'preparing' | 'ready' | 'completed' | 'all') => void;
  modeFilter: 'all' | 'dining' | 'takeaway';
  onModeFilterChange: (mode: 'all' | 'dining' | 'takeaway') => void;
  activeTicketsCount: number;
  readyTicketsCount: number;
}

export const KDSNav: React.FC<KDSNavProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  statusFilter,
  onStatusFilterChange,
  modeFilter,
  onModeFilterChange,
  activeTicketsCount,
  readyTicketsCount,
}) => {
  const { currentUser, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-4 border-b border-brand-charcoal/20 pb-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-heading font-bold text-amber-500 uppercase tracking-wider mb-1">
            <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>HANGOUT KDS • Line Stations & Kitchen Operations • {currentUser?.full_name || 'Staff Member'}</span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-black flex items-center gap-3">
            <span>Kitchen Display System (KDS)</span>
            <span className="text-xs font-heading font-black px-2.5 py-1 rounded-full bg-brand-black text-brand-yellow uppercase tracking-wider">
              Live Cooking Queue
            </span>
          </h1>
        </div>

        {/* Shortcuts */}
        <div className="flex items-center flex-wrap gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
              Customer Site
            </Button>
          </Link>

          <Link to="/staff">
            <Button variant="outline" size="sm" leftIcon={<UtensilsCrossed className="w-3.5 h-3.5 text-brand-yellow" />}>
              Staff Floor
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
            title="Log out kitchen session"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Station Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-heading font-bold text-brand-muted shrink-0 flex items-center gap-1">
          <Filter className="w-3.5 h-3.5" /> Station:
        </span>

        <button
          onClick={() => onSelectStation('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all whitespace-nowrap ${
            selectedStation === 'all'
              ? 'bg-brand-black text-brand-yellow shadow-sm ring-1 ring-brand-black'
              : 'bg-white text-brand-charcoal hover:bg-brand-soft-yellow/50 border border-brand-border'
          }`}
        >
          All Stations
        </button>

        {stations.map((st) => (
          <button
            key={st.id}
            onClick={() => onSelectStation(st.code)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold transition-all whitespace-nowrap ${
              selectedStation === st.code
                ? 'bg-brand-black text-brand-yellow shadow-sm ring-1 ring-brand-black'
                : 'bg-white text-brand-charcoal hover:bg-brand-soft-yellow/50 border border-brand-border'
            }`}
          >
            {st.name}
          </button>
        ))}
      </div>

      {/* Filter Ribbon: Status & Order Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-brand-border shadow-card-subtle">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => onStatusFilterChange('active')}
            className={`px-3 py-1 rounded-xl text-xs font-heading font-bold transition-colors ${
              statusFilter === 'active'
                ? 'bg-brand-black text-brand-yellow'
                : 'bg-brand-warm-white text-brand-charcoal hover:bg-brand-border'
            }`}
          >
            Active Queue ({activeTicketsCount})
          </button>

          <button
            onClick={() => onStatusFilterChange('preparing')}
            className={`px-3 py-1 rounded-xl text-xs font-heading font-bold transition-colors ${
              statusFilter === 'preparing'
                ? 'bg-amber-500 text-brand-black'
                : 'bg-brand-warm-white text-brand-charcoal hover:bg-brand-border'
            }`}
          >
            Cooking Now
          </button>

          <button
            onClick={() => onStatusFilterChange('ready')}
            className={`px-3 py-1 rounded-xl text-xs font-heading font-bold transition-colors ${
              statusFilter === 'ready'
                ? 'bg-emerald-600 text-white'
                : 'bg-brand-warm-white text-brand-charcoal hover:bg-brand-border'
            }`}
          >
            Ready for Service / Pickup ({readyTicketsCount})
          </button>

          <button
            onClick={() => onStatusFilterChange('completed')}
            className={`px-3 py-1 rounded-xl text-xs font-heading font-bold transition-colors ${
              statusFilter === 'completed'
                ? 'bg-brand-charcoal text-white'
                : 'bg-brand-warm-white text-brand-charcoal hover:bg-brand-border'
            }`}
          >
            Completed / Bumped
          </button>

          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-3 py-1 rounded-xl text-xs font-heading font-bold transition-colors ${
              statusFilter === 'all'
                ? 'bg-zinc-800 text-zinc-100'
                : 'bg-brand-warm-white text-brand-charcoal hover:bg-brand-border'
            }`}
          >
            All Tickets
          </button>
        </div>

        {/* Order Mode Filter */}
        <div className="flex items-center gap-1 shrink-0 bg-brand-warm-white p-1 rounded-xl border border-brand-border">
          <button
            onClick={() => onModeFilterChange('all')}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-heading font-bold transition-colors ${
              modeFilter === 'all' ? 'bg-white text-brand-black shadow-xs' : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            All Modes
          </button>
          <button
            onClick={() => onModeFilterChange('dining')}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-heading font-bold transition-colors ${
              modeFilter === 'dining' ? 'bg-white text-brand-black shadow-xs' : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            Dining Only
          </button>
          <button
            onClick={() => onModeFilterChange('takeaway')}
            className={`px-2.5 py-0.5 rounded-lg text-xs font-heading font-bold transition-colors ${
              modeFilter === 'takeaway' ? 'bg-white text-brand-black shadow-xs' : 'text-brand-muted hover:text-brand-black'
            }`}
          >
            Takeaway Only
          </button>
        </div>
      </div>
    </div>
  );
};
