import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTableByIdentifier } from '../lib/supabase';
import { useOrderMode } from '../context/OrderModeContext';
import { useToast } from '../context/ToastContext';
import { CafeTable } from '../types';
import { Button } from '../components/common/Button';
import { UtensilsCrossed, ArrowRight, CheckCircle2, AlertCircle, Users, MapPin } from 'lucide-react';

export const TableEntryPage: React.FC = () => {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const { setTable, setMode } = useOrderMode();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [matchedTable, setMatchedTable] = useState<CafeTable | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(tableNumber));
  const [isError, setIsError] = useState(!tableNumber);

  useEffect(() => {
    if (!tableNumber) return;

    fetchTableByIdentifier(tableNumber)
      .then((table) => {
        if (table) {
          setMatchedTable(table);
          setTable(table);
          setMode('dining');
          showToast({
            type: 'success',
            title: `Table ${table.table_number} Verified`,
            message: `Welcome! Dine-in activated for ${table.section}.`,
          });
        } else {
          setIsError(true);
        }
      })
      .catch(() => setIsError(true))
      .finally(() => setIsLoading(false));
  }, [tableNumber, setTable, setMode, showToast]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-brand-yellow flex items-center justify-center animate-bounce mb-4 text-brand-black">
          <UtensilsCrossed className="w-8 h-8" />
        </div>
        <h2 className="font-heading font-bold text-xl text-brand-black">
          Identifying Table QR Code...
        </h2>
        <p className="text-xs text-brand-muted mt-1">Connecting to HANGOUT table management.</p>
      </div>
    );
  }

  if (isError || !matchedTable) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-brand-border shadow-card-subtle text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="font-heading font-bold text-xl text-brand-black">
          Invalid Table Code: {tableNumber}
        </h2>
        <p className="text-xs text-brand-muted mt-2 mb-6">
          We could not locate this table in our restaurant registry. Please ask a staff member or choose a table manually.
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="md" onClick={() => navigate('/menu')}>
            Continue to Menu
          </Button>
          <Button variant="ghost" size="md" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto my-12 p-6 sm:p-10 bg-white rounded-3xl border border-brand-border shadow-premium text-center">
      <div className="w-16 h-16 rounded-3xl bg-brand-yellow text-brand-black flex items-center justify-center mx-auto mb-5 shadow-sm">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft-yellow text-brand-black text-xs font-heading font-black uppercase tracking-wider mb-2">
        <UtensilsCrossed className="w-3.5 h-3.5" />
        <span>Dine-In Session Active</span>
      </div>

      <h1 className="font-heading font-extrabold text-3xl sm:text-4xl text-brand-black">
        Table {matchedTable.table_number}
      </h1>

      <div className="my-6 p-4 rounded-2xl bg-brand-warm-white border border-brand-border text-left space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-brand-black">
          <span className="flex items-center gap-1.5 text-brand-muted">
            <MapPin className="w-3.5 h-3.5" /> Dining Section
          </span>
          <span>{matchedTable.section}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-brand-black">
          <span className="flex items-center gap-1.5 text-brand-muted">
            <Users className="w-3.5 h-3.5" /> Capacity
          </span>
          <span>{matchedTable.seating_capacity} Guests</span>
        </div>
        <div className="flex items-center justify-between text-xs font-semibold text-brand-black">
          <span className="text-brand-muted">QR Verification</span>
          <span className="font-mono text-emerald-600">Verified Match</span>
        </div>
      </div>

      <p className="text-xs text-brand-muted mb-6 leading-relaxed font-sans">
        Your orders will be prepared in our kitchen and served directly to Table{' '}
        {matchedTable.table_number}. Your table context will be maintained throughout your visit.
      </p>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        onClick={() => navigate('/menu')}
        rightIcon={<ArrowRight className="w-4 h-4" />}
      >
        Start Table Ordering
      </Button>
    </div>
  );
};
