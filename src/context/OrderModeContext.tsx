import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CafeTable, OrderMode } from '../types';
import { fetchCafeTables, fetchTableByIdentifier } from '../lib/supabase';
import { useToast } from './ToastContext';

interface OrderModeContextType {
  mode: OrderMode;
  setMode: (mode: OrderMode) => void;
  currentTable: CafeTable | null;
  setTable: (table: CafeTable | null) => void;
  clearTable: () => void;
  availableTables: CafeTable[];
  isLoadingTables: boolean;
  takeawayNotice: string;
}

const STORAGE_MODE_KEY = 'hangout_order_mode';
const STORAGE_TABLE_KEY = 'hangout_dining_table';

export const EXACT_TAKEAWAY_NOTICE =
  'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.';

const OrderModeContext = createContext<OrderModeContextType | undefined>(undefined);

export const OrderModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [mode, setModeState] = useState<OrderMode>(() => {
    const saved = localStorage.getItem(STORAGE_MODE_KEY);
    return saved === 'dining' ? 'dining' : 'takeaway';
  });

  const [currentTable, setCurrentTableState] = useState<CafeTable | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TABLE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [availableTables, setAvailableTables] = useState<CafeTable[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);

  // Load available tables from repository
  useEffect(() => {
    let mounted = true;
    fetchCafeTables().then((tables) => {
      if (mounted) {
        setAvailableTables(tables);
        setIsLoadingTables(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Check URL query parameters for QR code entry (e.g. ?table=T-04 or ?qr=hangout-qr-table-t04)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tableParam = urlParams.get('table') || urlParams.get('tableNumber') || urlParams.get('qr');

    if (tableParam) {
      fetchTableByIdentifier(tableParam).then((matchedTable) => {
        if (matchedTable) {
          setCurrentTableState(matchedTable);
          setModeState('dining');
          localStorage.setItem(STORAGE_TABLE_KEY, JSON.stringify(matchedTable));
          localStorage.setItem(STORAGE_MODE_KEY, 'dining');
          showToast({
            type: 'success',
            title: `Table ${matchedTable.table_number} Identified`,
            message: `QR verified for ${matchedTable.section}. Dining mode activated.`,
          });
        }
      });
    }
  }, [showToast]);

  const setMode = useCallback(
    (newMode: OrderMode) => {
      setModeState(newMode);
      localStorage.setItem(STORAGE_MODE_KEY, newMode);

      if (newMode === 'dining') {
        showToast({
          type: 'info',
          title: 'Dining In Mode',
          message: currentTable
            ? `Ordering for Table ${currentTable.table_number} (${currentTable.section})`
            : 'Select or scan your table QR code to proceed.',
        });
      } else {
        showToast({
          type: 'warning',
          title: 'Self-Pickup Mode',
          message: 'Takeaway orders are self-pickup only at HANGOUT counter.',
          duration: 5000,
        });
      }
    },
    [currentTable, showToast]
  );

  const setTable = useCallback(
    (table: CafeTable | null) => {
      setCurrentTableState(table);
      if (table) {
        localStorage.setItem(STORAGE_TABLE_KEY, JSON.stringify(table));
        setModeState('dining');
        localStorage.setItem(STORAGE_MODE_KEY, 'dining');
        showToast({
          type: 'success',
          title: `Table ${table.table_number} Assigned`,
          message: `Your orders will be brought to ${table.section}.`,
        });
      } else {
        localStorage.removeItem(STORAGE_TABLE_KEY);
      }
    },
    [showToast]
  );

  const clearTable = useCallback(() => {
    setCurrentTableState(null);
    localStorage.removeItem(STORAGE_TABLE_KEY);
    showToast({
      type: 'info',
      title: 'Table Cleared',
      message: 'Dining table context has been reset.',
    });
  }, [showToast]);

  return (
    <OrderModeContext.Provider
      value={{
        mode,
        setMode,
        currentTable,
        setTable,
        clearTable,
        availableTables,
        isLoadingTables,
        takeawayNotice: EXACT_TAKEAWAY_NOTICE,
      }}
    >
      {children}
    </OrderModeContext.Provider>
  );
};

export const useOrderMode = (): OrderModeContextType => {
  const context = useContext(OrderModeContext);
  if (!context) {
    throw new Error('useOrderMode must be used within an OrderModeProvider');
  }
  return context;
};
