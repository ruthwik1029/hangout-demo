import React, { useState, useEffect } from 'react';
import { AdminNav } from '../../components/admin/AdminNav';
import { fetchAdminActivityLogs } from '../../lib/supabase';
import { AdminActivityLog } from '../../types';
import {
  History,
  Search,
  UtensilsCrossed,
  Settings,
  Users,
  QrCode,
  Tag,
  DollarSign,
  ClipboardList,
} from 'lucide-react';

export const AdminActivityPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchAdminActivityLogs().then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesCategory = categoryFilter === 'ALL' || log.category === categoryFilter;
    const matchesSearch =
      !searchQuery ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'MENU':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200">
            <UtensilsCrossed className="w-3 h-3 text-amber-700" /> Menu
          </span>
        );
      case 'SETTINGS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-200">
            <Settings className="w-3 h-3 text-blue-700" /> Settings
          </span>
        );
      case 'BILLING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
            <DollarSign className="w-3 h-3 text-emerald-700" /> Billing / GST
          </span>
        );
      case 'STAFF':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
            <Users className="w-3 h-3 text-purple-700" /> Staff
          </span>
        );
      case 'TABLES':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-900 border border-sky-200">
            <QrCode className="w-3 h-3 text-sky-700" /> Tables / QR
          </span>
        );
      case 'PROMOTIONS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-900 border border-rose-200">
            <Tag className="w-3 h-3 text-rose-700" /> Promotions
          </span>
        );
      case 'ORDERS':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-800 border border-gray-200">
            <ClipboardList className="w-3 h-3 text-gray-600" /> Orders
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      {/* Header */}
      <AdminNav
        title="Admin Activity History & Audit Trail"
        subtitle="Chronological audit records of administrative operations, menu modifications, tax changes, and staff roster updates."
      />

      {/* Toolbar & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-brand-border shadow-card-subtle">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-brand-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search activity records by action, actor, or details..."
            className="w-full pl-9 pr-4 py-2 rounded-2xl border border-brand-border bg-brand-warm-white text-xs font-medium text-brand-black focus:outline-none focus:border-brand-yellow"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {['ALL', 'MENU', 'BILLING', 'TABLES', 'STAFF', 'SETTINGS', 'PROMOTIONS'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl font-heading font-bold text-[11px] transition-all ${
                categoryFilter === cat
                  ? 'bg-brand-black text-brand-yellow shadow-sm'
                  : 'bg-brand-warm-white text-brand-muted hover:text-brand-black border border-brand-border'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-brand-yellow border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-brand-muted">Loading activity trail...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-brand-border space-y-3">
          <History className="w-12 h-12 text-brand-muted mx-auto" />
          <h3 className="font-heading font-bold text-lg text-brand-black">No Activity Records Found</h3>
          <p className="text-xs text-brand-muted max-w-sm mx-auto">
            No administrative actions match your current search or category filter.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-brand-border shadow-card-subtle overflow-hidden">
          <div className="divide-y divide-brand-border/60">
            {filteredLogs.map((log) => {
              const dateObj = new Date(log.timestamp);
              return (
                <div key={log.id} className="p-5 hover:bg-brand-warm-white/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCategoryBadge(log.category)}
                      <span className="font-heading font-bold text-sm text-brand-black">
                        {log.action}
                      </span>
                    </div>
                    {log.details && (
                      <p className="text-xs text-brand-muted font-sans pl-1">
                        {log.details}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[10px] text-brand-muted pl-1">
                      <span>Recorded by <strong>{log.actor}</strong></span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono font-medium text-brand-charcoal block">
                      {dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-brand-muted font-mono">
                      {dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
