// HANGOUT Digital Platform - Realtime Operational Synchronization
// Batch 03: Cross-portal synchronization between Customer, Staff/Waiter, and Kitchen (KDS)

import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { Order, OrderStatus, OrderItemStatus, CafeTable } from '../types';

export type RealtimeEventType =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'ORDER_APPROVED'
  | 'ORDER_REJECTED'
  | 'ORDER_ITEMS_ADDED'
  | 'ITEM_STATUS_CHANGED'
  | 'TABLE_UPDATED'
  | 'BILL_SPLIT_UPDATED'
  | 'BILL_SPLIT_PAID';

export interface RealtimeOpsEvent {
  id: string;
  type: RealtimeEventType;
  orderId?: string;
  tableId?: string;
  tableNumber?: string;
  itemId?: string;
  status?: OrderStatus | OrderItemStatus | string;
  splitId?: string;
  actorRole?: string;
  actorName?: string;
  payload?: Record<string, unknown>;
  timestamp: string;
}

type EventListener = (event: RealtimeOpsEvent) => void;
const listeners = new Set<EventListener>();

// BroadcastChannel for cross-tab realtime messaging in modern browsers
const CHANNEL_NAME = 'hangout_operations_sync';
let broadcastChannel: BroadcastChannel | null = null;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
    broadcastChannel.onmessage = (messageEvent) => {
      const event: RealtimeOpsEvent = messageEvent.data;
      if (event && event.type) {
        listeners.forEach((listener) => {
          try {
            listener(event);
          } catch (err) {
            console.error('Error in realtime broadcast listener:', err);
          }
        });
      }
    };
  } catch (err) {
    console.warn('BroadcastChannel unavailable, falling back to local events:', err);
  }
}

/**
 * Publish an operational realtime event across current tab and other tabs/windows.
 */
export function publishRealtimeEvent(event: Omit<RealtimeOpsEvent, 'id' | 'timestamp'>): void {
  const fullEvent: RealtimeOpsEvent = {
    ...event,
    id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
  };

  // 1. Notify listeners in current context
  listeners.forEach((listener) => {
    try {
      listener(fullEvent);
    } catch (err) {
      console.error('Realtime internal listener error:', err);
    }
  });

  // 2. Broadcast across tabs via BroadcastChannel
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage(fullEvent);
    } catch (err) {
      console.warn('Broadcast postMessage failed:', err);
    }
  }

  // 3. Fallback broadcast via localStorage event
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('hangout_realtime_ping', JSON.stringify({ ts: Date.now(), event: fullEvent }));
    } catch {
      // Ignore storage errors in test or restricted environments
    }
  }
}

/**
 * Subscribe to realtime operational events. Returns cleanup unsubscribe function.
 */
export function subscribeToRealtimeEvents(callback: EventListener): () => void {
  listeners.add(callback);

  // Setup Supabase Realtime subscription if credentials configured
  let supabaseChannel: ReturnType<typeof supabase.channel> | null = null;
  if (isSupabaseConfigured()) {
    try {
      supabaseChannel = supabase
        .channel('realtime_ops_channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'orders' },
          (payload) => {
            const order = payload.new as Order;
            if (order && order.id) {
              callback({
                id: 'sb_ord_' + Date.now().toString(36),
                type: 'ORDER_STATUS_CHANGED',
                orderId: order.id,
                status: order.order_status,
                timestamp: new Date().toISOString(),
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'cafe_tables' },
          (payload) => {
            const table = payload.new as CafeTable;
            if (table && table.id) {
              callback({
                id: 'sb_tbl_' + Date.now().toString(36),
                type: 'TABLE_UPDATED',
                tableId: table.id,
                tableNumber: table.table_number,
                status: table.status,
                timestamp: new Date().toISOString(),
              });
            }
          }
        )
        .subscribe();
    } catch (e) {
      console.warn('Supabase Realtime subscription init failed, using local broadcast:', e);
    }
  }

  return () => {
    listeners.delete(callback);
    if (supabaseChannel) {
      supabaseChannel.unsubscribe().catch(() => {});
    }
  };
}

/**
 * React hook: Listen to real-time events and trigger state reload.
 */
export function useRealtimeOperationalSync(onEvent?: EventListener): void {
  useEffect(() => {
    const handleEvent = (event: RealtimeOpsEvent) => {
      if (onEvent) {
        onEvent(event);
      }
    };

    const cleanup = subscribeToRealtimeEvents(handleEvent);
    return () => cleanup();
  }, [onEvent]);
}
