import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { KDSNav } from '../../components/kitchen/KDSNav';
import { KDSTicketCard } from '../../components/kitchen/KDSTicketCard';
import {
  fetchOrders,
  fetchKitchenStations,
  updateOrderItemStatus,
  startTicketPreparation,
  markTicketAllReady,
  updateOrderStatus,
} from '../../lib/supabase';
import { useRealtimeOperationalSync } from '../../lib/realtime';
import { Order, KitchenStation, OrderItemStatus } from '../../types';
import { CheckCircle2 } from 'lucide-react';

export const KitchenPortal: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [stations, setStations] = useState<KitchenStation[]>([]);

  // Filters
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'preparing' | 'ready' | 'completed' | 'all'>('active');
  const [modeFilter, setModeFilter] = useState<'all' | 'dining' | 'takeaway'>('all');

  // Load KDS data
  const loadKDSData = useCallback(async () => {
    try {
      const [allOrders, allStations] = await Promise.all([
        fetchOrders(),
        fetchKitchenStations(),
      ]);
      setOrders(allOrders);
      setStations(allStations);
    } catch (err) {
      console.error('KDS data load failed:', err);
    }
  }, []);

  useEffect(() => {
    loadKDSData();
  }, [loadKDSData]);

  // Hook into Realtime operational synchronization
  useRealtimeOperationalSync(
    useCallback(() => {
      loadKDSData();
    }, [loadKDSData])
  );

  // Active tickets visible in kitchen:
  // Must NOT include PENDING (awaiting waiter approval for dining) or REJECTED or CANCELLED!
  const kitchenEligibleOrders = useMemo(() => {
    return orders.filter((o) => {
      // PENDING dining orders are waiting for waiter approval, do NOT reach kitchen yet!
      if (o.order_type === 'DINING' && o.order_status === 'PENDING') return false;
      if (o.order_status === 'REJECTED' || o.order_status === 'CANCELLED') return false;
      return true;
    });
  }, [orders]);

  // Filter by Station & Multi-station routing
  const stationFilteredOrders = useMemo(() => {
    if (selectedStation === 'all') return kitchenEligibleOrders;
    return kitchenEligibleOrders.filter((order) => {
      return (order.items || []).some(
        (it) => (it.station_code || 'MAIN_KITCHEN') === selectedStation
      );
    });
  }, [kitchenEligibleOrders, selectedStation]);

  // Filter by Status & Mode
  const displayedOrders = useMemo(() => {
    return stationFilteredOrders.filter((order) => {
      // Mode filter
      if (modeFilter === 'dining' && order.order_type !== 'DINING') return false;
      if (modeFilter === 'takeaway' && order.order_type !== 'TAKEAWAY') return false;

      // Status filter
      if (statusFilter === 'active') {
        return ['ACCEPTED', 'PREPARING', 'PREPARATION_COMPLETED', 'READY_FOR_PICKUP', 'READY_FOR_SERVICE'].includes(
          order.order_status
        );
      }
      if (statusFilter === 'preparing') {
        return order.order_status === 'PREPARING';
      }
      if (statusFilter === 'ready') {
        return order.order_status === 'READY_FOR_PICKUP' || order.order_status === 'READY_FOR_SERVICE';
      }
      if (statusFilter === 'completed') {
        return order.order_status === 'COMPLETED' || order.order_status === 'SERVED';
      }
      return true;
    });
  }, [stationFilteredOrders, statusFilter, modeFilter]);

  // Counts for tabs
  const activeCount = useMemo(() => {
    return stationFilteredOrders.filter((o) =>
      ['ACCEPTED', 'PREPARING', 'PREPARATION_COMPLETED', 'READY_FOR_PICKUP', 'READY_FOR_SERVICE'].includes(
        o.order_status
      )
    ).length;
  }, [stationFilteredOrders]);

  const readyCount = useMemo(() => {
    return stationFilteredOrders.filter(
      (o) => o.order_status === 'READY_FOR_PICKUP' || o.order_status === 'READY_FOR_SERVICE'
    ).length;
  }, [stationFilteredOrders]);

  // Action: Item-level status update
  const handleUpdateItemStatus = async (
    orderId: string,
    itemId: string,
    newStatus: OrderItemStatus
  ) => {
    try {
      await updateOrderItemStatus(
        orderId,
        itemId,
        newStatus,
        currentUser?.full_name || 'Chef'
      );
      loadKDSData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Item status update failed';
      showToast({ type: 'error', title: 'Update Error', message: msg });
    }
  };

  // Action: Start all items preparation
  const handleStartAllPrep = async (orderId: string) => {
    try {
      await startTicketPreparation(orderId, currentUser?.full_name || 'Chef');
      showToast({
        type: 'info',
        title: 'Cooking Commenced',
        message: 'All ticket items marked preparing. Preparation timer started.',
      });
      loadKDSData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast({ type: 'error', title: 'Action Failed', message: msg });
    }
  };

  // Action: Mark all ticket items ready
  const handleMarkAllReady = async (orderId: string) => {
    try {
      const updated = await markTicketAllReady(orderId, currentUser?.full_name || 'Chef');
      showToast({
        type: 'success',
        title: 'Ticket Marked Ready',
        message: `Order #${updated.order_number} is ready for ${
          updated.order_type === 'DINING' ? 'table service' : 'customer pickup'
        }.`,
      });
      loadKDSData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Action failed';
      showToast({ type: 'error', title: 'Action Failed', message: msg });
    }
  };

  // Action: Bump ticket out of active queue
  const handleBumpTicket = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'COMPLETED', 'Ticket bumped from KDS queue', undefined, currentUser?.full_name || 'Chef');
      showToast({
        type: 'info',
        title: 'Ticket Bumped',
        message: 'Order moved to completed history.',
      });
      loadKDSData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bump ticket failed';
      showToast({ type: 'error', title: 'Action Failed', message: msg });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 pb-28">
      {/* Top Navigation & Station Ribbon */}
      <KDSNav
        stations={stations}
        selectedStation={selectedStation}
        onSelectStation={setSelectedStation}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        modeFilter={modeFilter}
        onModeFilterChange={setModeFilter}
        activeTicketsCount={activeCount}
        readyTicketsCount={readyCount}
      />

      {/* Main KDS Grid Layout */}
      {displayedOrders.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-brand-border p-16 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft-yellow text-brand-black flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="font-heading font-black text-xl text-brand-black">
            Line Clear • All Orders Prepared
          </h2>
          <p className="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
            There are currently no tickets matching the selected station or status criteria. Incoming customer and waiter orders will pop up here in real time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedOrders.map((order) => (
            <KDSTicketCard
              key={order.id}
              order={order}
              stationFilter={selectedStation}
              onUpdateItemStatus={handleUpdateItemStatus}
              onStartAllPrep={handleStartAllPrep}
              onMarkAllReady={handleMarkAllReady}
              onBumpTicket={handleBumpTicket}
            />
          ))}
        </div>
      )}
    </div>
  );
};
