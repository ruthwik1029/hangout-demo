import React, { useState } from 'react';
import { CafeTable, Order, UserProfile } from '../../types';
import { Drawer } from '../common/Drawer';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  openTable,
  markTableCleaning,
  markTableAvailable,
  assignWaiterToTable,
} from '../../lib/supabase';
import {
  UtensilsCrossed,
  Receipt,
} from 'lucide-react';

interface TableDetailDrawerProps {
  table: CafeTable | null;
  activeOrder?: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenOrderModal: (table: CafeTable) => void;
  onOpenBillModal: (order: Order) => void;
  onTableUpdated: (table: CafeTable) => void;
  crewUsers: UserProfile[];
}

export const TableDetailDrawer: React.FC<TableDetailDrawerProps> = ({
  table,
  activeOrder,
  isOpen,
  onClose,
  onOpenOrderModal,
  onOpenBillModal,
  onTableUpdated,
  crewUsers,
}) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [guestCountInput, setGuestCountInput] = useState<number>(table?.guest_count || 2);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>(table?.assigned_waiter_id || '');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!table) return null;

  const handleOpenTable = async () => {
    setIsProcessing(true);
    try {
      const waiter = crewUsers.find((u) => u.id === selectedWaiterId) || currentUser;
      const updated = await openTable(
        table.id,
        guestCountInput,
        waiter?.id,
        waiter?.full_name,
        currentUser?.full_name || 'Staff'
      );
      showToast({
        type: 'success',
        title: 'Table Opened',
        message: `Table ${table.table_number} seated with ${guestCountInput} guests.`,
      });
      onTableUpdated(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to open table';
      showToast({ type: 'error', title: 'Action Failed', message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignWaiter = async (waiterId: string) => {
    const waiter = crewUsers.find((u) => u.id === waiterId);
    if (!waiter) return;
    setIsProcessing(true);
    try {
      const updated = await assignWaiterToTable(
        table.id,
        waiter.id,
        waiter.full_name,
        currentUser?.full_name || 'Staff'
      );
      showToast({
        type: 'success',
        title: 'Waiter Assigned',
        message: `${waiter.full_name} assigned to Table ${table.table_number}`,
      });
      onTableUpdated(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign waiter';
      showToast({ type: 'error', title: 'Assignment Failed', message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkCleaning = async () => {
    setIsProcessing(true);
    try {
      const updated = await markTableCleaning(table.id, currentUser?.full_name || 'Staff');
      showToast({
        type: 'info',
        title: 'Table Needs Cleaning',
        message: `Table ${table.table_number} marked for bussing & sanitation.`,
      });
      onTableUpdated(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast({ type: 'error', title: 'Action Failed', message: msg });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAvailable = async () => {
    setIsProcessing(true);
    try {
      const updated = await markTableAvailable(table.id, currentUser?.full_name || 'Staff');
      showToast({
        type: 'success',
        title: 'Table Available',
        message: `Table ${table.table_number} is now ready for service.`,
      });
      onTableUpdated(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast({
        type: 'error',
        title: 'Cannot Mark Available',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={`Table ${table.table_number} Management`}
      maxWidth="md"
    >
      <div className="space-y-6 text-brand-black pb-10">
        {/* Top Information Box */}
        <div className="p-4 rounded-3xl bg-brand-warm-white border border-brand-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-heading font-black text-2xl">{table.table_number}</span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-heading font-extrabold uppercase tracking-wider ${
                table.status === 'occupied'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : table.status === 'cleaning'
                  ? 'bg-sky-100 text-sky-900 border border-sky-300'
                  : table.status === 'reserved'
                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}
            >
              Status: {table.status}
            </span>
          </div>

          <div className="text-xs text-brand-muted space-y-1 pt-1">
            <p>
              Section: <strong className="text-brand-black font-semibold">{table.section}</strong>
            </p>
            <p>
              Capacity: <strong className="text-brand-black font-semibold">{table.seating_capacity || 4} seats</strong>
            </p>
            <p className="font-mono text-[11px]">
              QR Code: <strong>{table.qr_code_identifier}</strong>
            </p>
          </div>
        </div>

        {/* Assigned Waiter & Crew Controls */}
        <div className="space-y-2">
          <label className="block text-xs font-heading font-bold text-brand-black uppercase tracking-wider">
            Assigned Floor Waiter:
          </label>
          <div className="flex items-center gap-2">
            <select
              value={table.assigned_waiter_id || selectedWaiterId}
              onChange={(e) => {
                setSelectedWaiterId(e.target.value);
                handleAssignWaiter(e.target.value);
              }}
              className="flex-1 text-xs p-2.5 rounded-xl border border-brand-border bg-white font-medium outline-none"
            >
              <option value="">-- Unassigned / Pool --</option>
              {crewUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role_id.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Order Snapshot */}
        {activeOrder ? (
          <div className="p-4 rounded-3xl bg-white border border-amber-300 ring-2 ring-amber-300/30 space-y-3">
            <div className="flex items-center justify-between border-b border-brand-border/60 pb-2">
              <div>
                <span className="font-heading font-bold text-xs uppercase text-brand-muted">
                  Active Table Order
                </span>
                <p className="font-mono font-bold text-sm text-brand-black">
                  #{activeOrder.order_number}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-brand-muted">Current Tab</span>
                <p className="font-mono font-black text-lg text-brand-black">
                  ₹{activeOrder.total_amount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Item list */}
            <div className="divide-y divide-brand-border/40 max-h-40 overflow-y-auto pr-1">
              {activeOrder.items?.map((it) => (
                <div key={it.id} className="py-1.5 text-xs flex items-center justify-between">
                  <span className="font-medium text-brand-black">
                    {it.quantity}× {it.item_name_snapshot}
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        (it.item_status || it.status) === 'READY'
                          ? 'bg-emerald-100 text-emerald-800'
                          : (it.item_status || it.status) === 'PREPARING'
                          ? 'bg-amber-100 text-amber-800'
                          : (it.item_status || it.status) === 'SERVED'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      {it.item_status || it.status || 'QUEUED'}
                    </span>
                    <span className="font-mono">₹{it.total_price.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Table Order Actions */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-brand-border/60">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<UtensilsCrossed className="w-3.5 h-3.5" />}
                onClick={() => onOpenOrderModal(table)}
              >
                + Add Items
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<Receipt className="w-3.5 h-3.5" />}
                onClick={() => onOpenBillModal(activeOrder)}
              >
                Bill & Split
              </Button>
            </div>
          </div>
        ) : (
          table.status === 'available' && (
            <div className="p-4 rounded-3xl bg-brand-warm-white border border-brand-border space-y-3">
              <p className="font-heading font-bold text-xs text-brand-black uppercase tracking-wider">
                Open Table for Seating
              </p>

              <div>
                <label className="block text-[11px] text-brand-muted mb-1 font-semibold">
                  Number of Guests Seated:
                </label>
                <input
                  type="number"
                  min={1}
                  max={table.seating_capacity || 8}
                  value={guestCountInput}
                  onChange={(e) => setGuestCountInput(parseInt(e.target.value) || 1)}
                  className="w-full text-xs p-2.5 rounded-xl border border-brand-border bg-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleOpenTable}
                  disabled={isProcessing}
                >
                  Open Table
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onOpenOrderModal(table)}
                  disabled={isProcessing}
                >
                  Open & Take Order
                </Button>
              </div>
            </div>
          )
        )}

        {/* Status Transition Buttons */}
        <div className="space-y-2 pt-2 border-t border-brand-border/60">
          <label className="block text-xs font-heading font-bold text-brand-muted uppercase tracking-wider">
            Floor Management Actions:
          </label>

          <div className="grid grid-cols-2 gap-2">
            {table.status !== 'cleaning' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkCleaning}
                disabled={isProcessing}
              >
                Mark Cleaning
              </Button>
            )}

            {table.status !== 'available' && (
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                onClick={handleMarkAvailable}
                disabled={isProcessing}
              >
                Mark Available
              </Button>
            )}
          </div>

          <p className="text-[11px] text-brand-muted italic mt-1">
            * Safeguard active: Tables with unpaid orders cannot be reset to available until bill is settled.
          </p>
        </div>
      </div>
    </Drawer>
  );
};
