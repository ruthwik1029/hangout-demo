import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import {
  Flame,
  Clock,
  CheckCircle2,
  ArrowLeft,
  Utensils,
  ShoppingBag,
} from 'lucide-react';

interface MockTicket {
  id: string;
  orderNumber: string;
  mode: 'dining' | 'takeaway';
  tableOrPickup: string;
  timeElapsed: string;
  items: { name: string; qty: number; notes?: string }[];
  status: 'cooking' | 'ready' | 'queued';
}

const MOCK_TICKETS: MockTicket[] = [
  {
    id: 't-101',
    orderNumber: '#HG-8041',
    mode: 'dining',
    tableOrPickup: 'Table T-02 (Main Indoor)',
    timeElapsed: '6m ago',
    status: 'cooking',
    items: [
      { name: 'The Hangout Signature Smash Burger', qty: 2, notes: 'Extra crispy edge' },
      { name: 'Iced Spanish Latte', qty: 1, notes: 'Large (400ml)' },
    ],
  },
  {
    id: 't-102',
    orderNumber: '#HG-8042',
    mode: 'takeaway',
    tableOrPickup: 'Counter Self-Pickup',
    timeElapsed: '3m ago',
    status: 'cooking',
    items: [
      { name: 'Ceremonial Uji Iced Matcha Latte', qty: 1, notes: 'Organic Oat Milk' },
      { name: 'Truffle Mushroom & Whipped Ricotta Toast', qty: 1 },
    ],
  },
  {
    id: 't-103',
    orderNumber: '#HG-8040',
    mode: 'dining',
    tableOrPickup: 'Table T-04 (Sunny Patio)',
    timeElapsed: '14m ago',
    status: 'ready',
    items: [
      { name: 'Wild Forest Truffle Tagliatelle', qty: 1, notes: 'Italian Burrata top' },
      { name: 'San Sebastian Basque Burnt Cheesecake', qty: 1 },
    ],
  },
];

export const KitchenPortal: React.FC = () => {
  const { currentUser } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-heading font-bold text-brand-muted uppercase tracking-wider mb-1">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Kitchen Display System (KDS) Foundation</span>
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-brand-black">
            Live Cooking Queue
          </h1>
          <p className="text-xs text-brand-muted mt-1">
            Head Chef Station • Logged in as <strong className="text-brand-black">{currentUser?.full_name}</strong> ({currentUser?.role_id})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Customer Site
            </Button>
          </Link>
          <Link to="/staff">
            <Button variant="secondary" size="sm">
              Floor / Staff Portal
            </Button>
          </Link>
        </div>
      </div>

      {/* Ticket Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_TICKETS.map((ticket) => (
          <div
            key={ticket.id}
            className={`p-6 rounded-3xl border bg-white shadow-card-subtle flex flex-col justify-between space-y-4 ${
              ticket.status === 'ready'
                ? 'border-emerald-300 ring-2 ring-emerald-400/20'
                : 'border-brand-border'
            }`}
          >
            <div className="space-y-3">
              {/* Top row */}
              <div className="flex items-center justify-between">
                <span className="font-heading font-black text-xl text-brand-black">
                  {ticket.orderNumber}
                </span>
                <span
                  className={`text-[10px] font-heading font-extrabold uppercase px-2.5 py-1 rounded-full ${
                    ticket.status === 'ready'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-900 animate-pulse'
                  }`}
                >
                  {ticket.status === 'ready' ? 'Ready to Serve' : 'In Preparation'}
                </span>
              </div>

              {/* Destination badge */}
              <div className="flex items-center justify-between text-xs bg-brand-warm-white p-2.5 rounded-xl border border-brand-border/60">
                <div className="flex items-center gap-1.5 font-bold text-brand-black">
                  {ticket.mode === 'dining' ? (
                    <Utensils className="w-3.5 h-3.5" />
                  ) : (
                    <ShoppingBag className="w-3.5 h-3.5 text-brand-yellow" />
                  )}
                  <span>{ticket.tableOrPickup}</span>
                </div>
                <span className="text-[11px] text-brand-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {ticket.timeElapsed}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2 pt-1">
                {ticket.items.map((item, i) => (
                  <div key={i} className="text-xs border-b border-brand-border/40 pb-2">
                    <div className="flex items-baseline justify-between font-heading font-bold text-brand-black">
                      <span>{item.name}</span>
                      <span className="w-6 text-right text-brand-muted">x{item.qty}</span>
                    </div>
                    {item.notes && (
                      <p className="text-[11px] text-amber-800 italic mt-0.5">
                        Instructions: {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* KDS Action Button */}
            <div className="pt-2">
              <Button
                variant={ticket.status === 'ready' ? 'secondary' : 'primary'}
                size="md"
                className="w-full"
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => alert(`Ticket ${ticket.orderNumber} status toggled in KDS demo`)}
              >
                {ticket.status === 'ready' ? 'Mark Completed' : 'Mark Ready to Dispatch'}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Realtime architecture note */}
      <div className="p-4 rounded-2xl bg-brand-charcoal text-white text-xs flex items-center gap-3">
        <Clock className="w-5 h-5 text-brand-yellow shrink-0" />
        <p className="text-[11px] text-gray-300 font-sans">
          This KDS board is designed for Supabase Realtime subscriptions. When customer orders are submitted from dining tables or self-pickup carts, live tickets immediately appear here with audio chime triggers and kitchen prep timers.
        </p>
      </div>
    </div>
  );
};
