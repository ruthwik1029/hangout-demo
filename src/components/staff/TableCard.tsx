import React from 'react';
import { CafeTable, TableStatus } from '../../types';
import { Users, User, AlertCircle } from 'lucide-react';

interface TableCardProps {
  table: CafeTable;
  onSelectTable: (table: CafeTable) => void;
  onOpenOrderModal: (table: CafeTable) => void;
  onMarkCleaning?: (tableId: string) => void;
  onMarkAvailable: (tableId: string) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onSelectTable,
  onOpenOrderModal,
  onMarkCleaning: _onMarkCleaning,
  onMarkAvailable,
}) => {
  const getStatusBadge = (status: TableStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-200">
            Available
          </span>
        );
      case 'occupied':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
            Occupied
          </span>
        );
      case 'cleaning':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold uppercase tracking-wider bg-sky-100 text-sky-900 border border-sky-300">
            Cleaning Req.
          </span>
        );
      case 'reserved':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-heading font-extrabold uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200">
            Reserved
          </span>
        );
      default:
        return null;
    }
  };

  const getCardBorder = (status: TableStatus) => {
    switch (status) {
      case 'occupied':
        return 'border-amber-300 bg-amber-50/20 hover:border-amber-400 ring-1 ring-amber-200';
      case 'cleaning':
        return 'border-sky-300 bg-sky-50/20 hover:border-sky-400 ring-1 ring-sky-200';
      case 'reserved':
        return 'border-purple-200 bg-purple-50/20 hover:border-purple-300';
      default:
        return 'border-brand-border bg-white hover:border-brand-black/30';
    }
  };

  return (
    <div
      onClick={() => onSelectTable(table)}
      className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between shadow-card-subtle space-y-4 hover:shadow-card-hover ${getCardBorder(
        table.status
      )}`}
    >
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-heading font-black text-2xl sm:text-3xl text-brand-black tracking-tight">
            {table.table_number}
          </span>
          {getStatusBadge(table.status)}
        </div>

        <p className="text-xs font-semibold text-brand-charcoal">{table.section}</p>
        <p className="text-[11px] text-brand-muted flex items-center gap-1 mt-0.5">
          <Users className="w-3.5 h-3.5" /> Max {table.seating_capacity || table.capacity || 4} guests
        </p>
      </div>

      {/* Middle Status Details */}
      <div className="py-2 border-t border-brand-border/60 text-xs space-y-1.5">
        {table.status === 'occupied' && (
          <>
            <div className="flex items-center justify-between text-brand-black">
              <span className="text-[11px] text-brand-muted flex items-center gap-1">
                <Users className="w-3 h-3 text-brand-charcoal" />
                <span>Guests:</span>
              </span>
              <span className="font-bold">{table.guest_count || 1} Seated</span>
            </div>

            {table.assigned_waiter_name && (
              <div className="flex items-center justify-between text-brand-black">
                <span className="text-[11px] text-brand-muted flex items-center gap-1">
                  <User className="w-3 h-3 text-brand-charcoal" />
                  <span>Crew:</span>
                </span>
                <span className="font-medium truncate max-w-[110px]">{table.assigned_waiter_name}</span>
              </div>
            )}

            {table.active_order_number && (
              <div className="flex items-center justify-between text-brand-black">
                <span className="text-[11px] text-brand-muted">Active Order:</span>
                <span className="font-mono text-[11px] font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">
                  {table.active_order_number}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-dashed border-amber-200">
              <span className="text-[11px] font-bold text-brand-muted">Running Bill:</span>
              <span className="font-mono font-black text-brand-black text-sm">
                ₹{(table.current_bill_amount || 0).toFixed(2)}
              </span>
            </div>
          </>
        )}

        {table.status === 'cleaning' && (
          <div className="flex items-center gap-1.5 text-sky-800 text-[11px] font-medium py-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>Table bussing & sanitization in progress</span>
          </div>
        )}

        {table.status === 'available' && (
          <p className="text-[11px] text-emerald-800 font-medium py-1">
            Table ready for walk-in or QR dining
          </p>
        )}

        {table.status === 'reserved' && (
          <p className="text-[11px] text-purple-800 font-medium py-1">
            Reserved for scheduled party
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div
        className="pt-2 border-t border-brand-border/60 flex items-center justify-between gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {table.status === 'available' && (
          <button
            onClick={() => onSelectTable(table)}
            className="w-full py-1.5 px-2 bg-brand-black hover:bg-brand-charcoal text-brand-yellow rounded-xl text-xs font-heading font-bold transition-colors"
          >
            Open Table
          </button>
        )}

        {table.status === 'occupied' && (
          <>
            <button
              onClick={() => onOpenOrderModal(table)}
              className="flex-1 py-1.5 px-2 bg-brand-yellow hover:bg-brand-yellow/90 text-brand-black rounded-xl text-xs font-heading font-bold transition-colors text-center"
            >
              + Order
            </button>
            <button
              onClick={() => onSelectTable(table)}
              className="py-1.5 px-2.5 bg-white border border-brand-border hover:bg-brand-soft-yellow/50 text-brand-black rounded-xl text-xs font-heading font-bold transition-colors"
            >
              Manage
            </button>
          </>
        )}

        {table.status === 'cleaning' && (
          <button
            onClick={() => onMarkAvailable(table.id)}
            className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-heading font-bold transition-colors"
          >
            Mark Cleaned & Available
          </button>
        )}

        {table.status === 'reserved' && (
          <button
            onClick={() => onSelectTable(table)}
            className="w-full py-1.5 px-2 bg-white border border-brand-border hover:bg-brand-soft-yellow/50 text-brand-black rounded-xl text-xs font-heading font-bold transition-colors"
          >
            Seat Guests
          </button>
        )}
      </div>
    </div>
  );
};
