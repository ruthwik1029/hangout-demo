import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOrderMode } from '../../context/OrderModeContext';
import { Button } from '../../components/common/Button';
import {
  Users,
  UtensilsCrossed,
  ArrowLeft,
  Shield,
  Coffee,
} from 'lucide-react';

export const StaffPortal: React.FC = () => {
  const { currentUser } = useAuth();
  const { availableTables } = useOrderMode();

  const [activeFilter, setActiveFilter] = useState<'all' | 'available' | 'occupied'>('all');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted uppercase tracking-wider mb-1">
            <Shield className="w-4 h-4 text-brand-yellow" />
            <span>HANGOUT Service Crew Portal</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-brand-black">
            Floor & Waiter Service Station
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Active Crew: <strong className="text-brand-black">{currentUser?.full_name}</strong> ({currentUser?.role_id})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Customer Site
            </Button>
          </Link>
          <Link to="/kitchen">
            <Button variant="secondary" size="sm">
              Kitchen Display (KDS)
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Overview Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-brand-border flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-muted font-bold uppercase">Total Tables</p>
            <p className="font-heading font-black text-2xl text-brand-black mt-1">
              {availableTables.length} Tables
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
            <UtensilsCrossed className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-brand-border flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-muted font-bold uppercase">Assigned Service Staff</p>
            <p className="font-heading font-black text-2xl text-brand-black mt-1">4 Waiters On Floor</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-brand-border flex items-center justify-between">
          <div>
            <p className="text-xs text-brand-muted font-bold uppercase">Active Dining Orders</p>
            <p className="font-heading font-black text-2xl text-brand-black mt-1">5 Kitchen Tickets</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-soft-yellow flex items-center justify-center text-brand-black">
            <Coffee className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Floor Table Map Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-heading font-bold text-xl text-brand-black">
            Cafe Tables & QR Code Floor Map
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold border ${
                activeFilter === 'all'
                  ? 'bg-brand-black text-brand-yellow border-brand-black'
                  : 'bg-white text-brand-black border-brand-border'
              }`}
            >
              All ({availableTables.length})
            </button>
            <button
              onClick={() => setActiveFilter('available')}
              className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold border ${
                activeFilter === 'available'
                  ? 'bg-brand-black text-brand-yellow border-brand-black'
                  : 'bg-white text-brand-black border-brand-border'
              }`}
            >
              Available Only
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {availableTables.map((table, idx) => {
            const isOccupiedDemo = idx % 3 === 0;
            return (
              <div
                key={table.id}
                className={`p-5 rounded-3xl border bg-white shadow-card-subtle flex flex-col justify-between space-y-4 ${
                  isOccupiedDemo ? 'border-amber-300 ring-1 ring-amber-300/50' : 'border-brand-border'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading font-black text-2xl text-brand-black">
                      {table.table_number}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isOccupiedDemo
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}
                    >
                      {isOccupiedDemo ? 'Dining Active' : 'Available'}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-brand-charcoal">{table.section}</p>
                  <p className="text-[11px] text-brand-muted flex items-center gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5" /> Max {table.seating_capacity} seats
                  </p>
                </div>

                <div className="pt-2 border-t border-brand-border/60 flex items-center justify-between text-xs">
                  <span className="font-mono text-[10px] text-brand-muted">
                    QR: {table.qr_code_identifier.replace('hangout-qr-', '')}
                  </span>
                  <Link
                    to={`/table/${table.table_number}`}
                    target="_blank"
                    className="font-bold text-brand-black hover:underline"
                  >
                    Open Link ↗
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
