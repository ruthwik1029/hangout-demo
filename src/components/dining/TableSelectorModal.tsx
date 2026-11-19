import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useOrderMode } from '../../context/OrderModeContext';
import { CafeTable } from '../../types';
import { Button } from '../common/Button';
import { QrCode, Check, UtensilsCrossed, Users } from 'lucide-react';

interface TableSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TableSelectorModal: React.FC<TableSelectorModalProps> = ({ isOpen, onClose }) => {
  const { currentTable, setTable, clearTable, availableTables } = useOrderMode();
  const [selectedTable, setSelectedTable] = useState<CafeTable | null>(currentTable);

  const handleConfirm = () => {
    if (selectedTable) {
      setTable(selectedTable);
    } else {
      clearTable();
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Dining Table"
      subtitle="Choose your table in the cafe or simulate scanning a table QR code."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Active table banner if any */}
        {currentTable && (
          <div className="p-3.5 rounded-2xl bg-brand-soft-yellow/50 border border-brand-yellow/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-yellow flex items-center justify-center font-heading font-black text-brand-black text-sm">
                {currentTable.table_number}
              </div>
              <div>
                <p className="text-xs font-bold text-brand-black">Currently Assigned</p>
                <p className="text-[11px] text-brand-muted">
                  {currentTable.section} • {currentTable.seating_capacity} Seats
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                clearTable();
                setSelectedTable(null);
              }}
              className="text-xs text-red-600 hover:text-red-700 font-medium underline px-2 py-1"
            >
              Clear Table
            </button>
          </div>
        )}

        {/* Available Tables Grid */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-muted mb-2">
            Available Cafe Tables
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
            {availableTables.map((t) => {
              const isSelected = selectedTable?.id === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTable(t)}
                  className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-brand-black bg-brand-yellow/20 ring-2 ring-brand-yellow'
                      : 'border-brand-border bg-white hover:border-brand-charcoal/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading font-bold text-base text-brand-black">
                      {t.table_number}
                    </span>
                    {isSelected ? (
                      <span className="w-5 h-5 rounded-full bg-brand-black text-brand-yellow flex items-center justify-center text-xs">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                        Open
                      </span>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium text-brand-charcoal truncate">
                      {t.section}
                    </p>
                    <p className="text-[10px] text-brand-muted flex items-center gap-1">
                      <Users className="w-3 h-3" /> {t.seating_capacity} seats
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* QR Code demo helper */}
        <div className="bg-brand-charcoal text-white p-3.5 rounded-2xl flex items-center gap-3 text-xs">
          <QrCode className="w-5 h-5 text-brand-yellow shrink-0" />
          <div className="flex-1">
            <span className="text-brand-yellow font-semibold">QR Code Demo:</span> In real usage, scanning a table sticker opens <code className="bg-black/50 px-1 py-0.5 rounded text-amber-200">hangout.cafe/table/T-04</code> which locks the table context automatically.
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-brand-border">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            leftIcon={<UtensilsCrossed className="w-4 h-4" />}
            onClick={handleConfirm}
            disabled={!selectedTable}
          >
            Confirm Table {selectedTable ? selectedTable.table_number : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
