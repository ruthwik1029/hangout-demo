import { describe, it, expect, beforeEach } from 'vitest';
import {
  fetchCafeTables,
  openTable,
  markTableCleaning,
  markTableAvailable,
  assignWaiterToTable,
  approveDiningOrder,
  rejectDiningOrder,
  createWaiterOrder,
  addItemsToExistingOrder,
  fetchKitchenStations,
  updateOrderItemStatus,
  markOrderServed,
  createBillSplits,
  settleBillSplit,
  closeCompletedOrder,
  assertStaffPermission,
  roundMoney,
} from '../lib/supabase';
import { publishRealtimeEvent, subscribeToRealtimeEvents, RealtimeOpsEvent } from '../lib/realtime';

describe('Staff & Waiter Operations, KDS & Bill Splitting (Batch 03)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ==========================================================================
  // 1. STAFF ROLES & PERMISSIONS
  // ==========================================================================
  describe('Staff Roles & Permissions', () => {
    it('enforces role-based permissions according to operational security matrix', () => {
      // 1. Admin has access to all actions
      expect(() => assertStaffPermission('admin', 'MANAGE_TABLES')).not.toThrow();
      expect(() => assertStaffPermission('admin', 'APPROVE_ORDERS')).not.toThrow();
      expect(() => assertStaffPermission('admin', 'PREPARE_FOOD')).not.toThrow();
      expect(() => assertStaffPermission('admin', 'MANAGE_SETTINGS')).not.toThrow();

      // 2. Waiter has floor permissions, but cannot edit settings or prepare food
      expect(() => assertStaffPermission('waiter', 'MANAGE_TABLES')).not.toThrow();
      expect(() => assertStaffPermission('waiter', 'APPROVE_ORDERS')).not.toThrow();
      expect(() => assertStaffPermission('waiter', 'CREATE_ORDERS')).not.toThrow();
      expect(() => assertStaffPermission('waiter', 'PREPARE_FOOD')).toThrow(/Unauthorized/);
      expect(() => assertStaffPermission('waiter', 'MANAGE_SETTINGS')).toThrow(/Unauthorized/);

      // 3. Kitchen staff can only prepare food
      expect(() => assertStaffPermission('kitchen', 'PREPARE_FOOD')).not.toThrow();
      expect(() => assertStaffPermission('kitchen', 'APPROVE_ORDERS')).toThrow(/Unauthorized/);
      expect(() => assertStaffPermission('kitchen', 'MANAGE_TABLES')).toThrow(/Unauthorized/);
      expect(() => assertStaffPermission('kitchen', 'MANAGE_SETTINGS')).toThrow(/Unauthorized/);

      // 4. Cashier can settle bills and view tables, but cannot cook or change settings
      expect(() => assertStaffPermission('cashier', 'SETTLE_BILLS')).not.toThrow();
      expect(() => assertStaffPermission('cashier', 'MANAGE_TABLES')).not.toThrow();
      expect(() => assertStaffPermission('cashier', 'PREPARE_FOOD')).toThrow(/Unauthorized/);
      expect(() => assertStaffPermission('cashier', 'MANAGE_SETTINGS')).toThrow(/Unauthorized/);
    });
  });

  // ==========================================================================
  // 2. TABLE MANAGEMENT & SAFEGUARDS
  // ==========================================================================
  describe('Table Management & Floor Lifecycle', () => {
    it('supports opening tables, assigning waiters, and cleaning transitions', async () => {
      const tables = await fetchCafeTables();
      const table1 = tables.find((t) => t.table_number === 'T-01')!;

      // 1. Open table for 3 guests with waiter assignment
      const opened = await openTable(table1.id, 3, 'u-waiter-01', 'Rahul Verma', 'Rahul Verma');
      expect(opened.status).toBe('occupied');
      expect(opened.guest_count).toBe(3);
      expect(opened.assigned_waiter_name).toBe('Rahul Verma');

      // 2. Reassign waiter to Vikram
      const reassigned = await assignWaiterToTable(table1.id, 'u-mgr-01', 'Vikram Sethi', 'Vikram Sethi');
      expect(reassigned.assigned_waiter_name).toBe('Vikram Sethi');

      // 3. Mark table as cleaning
      const cleaning = await markTableCleaning(table1.id, 'Rahul Verma');
      expect(cleaning.status).toBe('cleaning');

      // 4. Mark cleaned table available
      const available = await markTableAvailable(table1.id, 'Rahul Verma');
      expect(available.status).toBe('available');
      expect(available.guest_count).toBe(0);
      expect(available.current_bill_amount).toBe(0);
    });

    it('safeguards against marking a table available while an active unpaid order remains', async () => {
      const tables = await fetchCafeTables();
      const table2 = tables.find((t) => t.table_number === 'T-02')!;

      // Table T-02 has active unpaid order ord-0003 in INITIAL_ORDERS
      await expect(markTableAvailable(table2.id, 'Staff')).rejects.toThrow(
        /Cannot mark table available while an active unpaid order/
      );
    });
  });

  // ==========================================================================
  // 3. DINING ORDER APPROVAL & REJECTION
  // ==========================================================================
  describe('Customer Dining Order Approval Flow', () => {
    it('allows a waiter to approve a pending customer dining order and dispatch to kitchen', async () => {
      // ord-0003 is PENDING dining order on T-02
      const approved = await approveDiningOrder('ord-0003', 'u-waiter-01', 'Rahul Verma');

      expect(approved.order_status).toBe('ACCEPTED');
      expect(approved.approved_by_waiter_id).toBe('u-waiter-01');
      expect(approved.approved_at).toBeDefined();

      // Items are queued for the kitchen
      expect(approved.items?.[0].item_status).toBe('QUEUED');

      // Table is bound with active order
      const tables = await fetchCafeTables();
      const table = tables.find((t) => t.table_number === 'T-02')!;
      expect(table.active_order_id).toBe('ord-0003');
      expect(table.current_bill_amount).toBe(approved.total_amount);
    });

    it('requires a mandatory reason when rejecting a customer dining order', async () => {
      // 1. Rejection without reason fails
      await expect(
        rejectDiningOrder('ord-0003', '   ', 'u-waiter-01', 'Rahul Verma')
      ).rejects.toThrow(/Rejection reason is required/);

      // 2. Rejection with reason marks order REJECTED and cancels items
      const rejected = await rejectDiningOrder(
        'ord-0003',
        'Kitchen station at peak capacity',
        'u-waiter-01',
        'Rahul Verma'
      );

      expect(rejected.order_status).toBe('REJECTED');
      expect(rejected.rejection_reason).toBe('Kitchen station at peak capacity');
      expect(rejected.items?.[0].item_status).toBe('CANCELLED');
    });
  });

  // ==========================================================================
  // 4. WAITER ORDER CREATION & ADDING ITEMS
  // ==========================================================================
  describe('Waiter Order Creation & Tab Modification', () => {
    it('creates a waiter order with server-recalculated prices, taxes, and station routing', async () => {
      const tables = await fetchCafeTables();
      const table3 = tables.find((t) => t.table_number === 'T-03')!;

      const order = await createWaiterOrder({
        tableId: table3.id,
        guestCount: 2,
        waiterId: 'u-waiter-01',
        waiterName: 'Rahul Verma',
        customerName: 'Ananya Walkin',
        items: [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000001', // Iced Spanish Latte (240 base)
            variantName: 'Large (400ml)', // +50
            quantity: 2,
          },
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000010', // Smash Burger (420)
            quantity: 1,
            specialInstructions: 'Well done',
          },
        ],
      });

      expect(order.order_status).toBe('ACCEPTED');
      expect(order.order_type).toBe('DINING');
      expect(order.table_number_snapshot).toBe('T-03');
      expect(order.payment_status).toBe('UNPAID');

      // Subtotal: (240 + 50)*2 + 420 = 580 + 420 = 1000
      expect(order.subtotal).toBe(1000);
      // 5% GST = 50 (CGST 25, SGST 25)
      expect(order.tax_amount).toBe(50);
      expect(order.total_amount).toBe(1050);

      // Station routing verification
      const latteItem = order.items?.find((i) => i.item_name_snapshot === 'Iced Spanish Latte');
      expect(latteItem?.station_code).toBe('BEVERAGE');

      const burgerItem = order.items?.find((i) => i.item_name_snapshot.includes('Smash Burger'));
      expect(burgerItem?.station_code).toBe('MAIN_KITCHEN');
    });

    it('allows a waiter to add additional items to an active running dining tab', async () => {
      // Create order first
      const tables = await fetchCafeTables();
      const table7 = tables.find((t) => t.table_number === 'T-07')!;

      const initialOrder = await createWaiterOrder({
        tableId: table7.id,
        guestCount: 2,
        waiterId: 'u-waiter-01',
        waiterName: 'Rahul Verma',
        items: [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000001',
            quantity: 1,
          },
        ],
      });

      const initialSubtotal = initialOrder.subtotal;

      // Add cheesecake (280)
      const updatedOrder = await addItemsToExistingOrder(
        initialOrder.id,
        [
          {
            menuItemId: 'd0000000-0000-0000-0000-000000000015', // Basque Burnt Cheesecake
            quantity: 1,
          },
        ],
        'Rahul Verma'
      );

      expect(updatedOrder.items?.length).toBe(2);
      expect(updatedOrder.subtotal).toBe(initialSubtotal + 280);
      expect(updatedOrder.total_amount).toBeGreaterThan(initialOrder.total_amount);
    });
  });

  // ==========================================================================
  // 5. KITCHEN STATIONS & MULTI-STATION ROUTING
  // ==========================================================================
  describe('Kitchen Stations & Multi-Station Routing', () => {
    it('provides configurable kitchen stations with default fallback routing', async () => {
      const stations = await fetchKitchenStations();
      expect(stations.length).toBeGreaterThanOrEqual(4);

      const codes = stations.map((s) => s.code);
      expect(codes).toContain('MAIN_KITCHEN');
      expect(codes).toContain('BEVERAGE');
      expect(codes).toContain('BAKERY');
      expect(codes).toContain('DESSERT');
    });

    it('correctly tracks item-level preparation states and aggregates parent order status', async () => {
      // ord-0004 has 3 items in PREPARING on T-04:
      // oi-0006 (Latte: READY)
      // oi-0007 (Toast: PREPARATION_COMPLETED)
      // oi-0008 (Cheesecake: PREPARING)

      // Step 1: Advance cheesecake to PREPARATION_COMPLETED
      const step1 = await updateOrderItemStatus('ord-0004', 'oi-0008', 'PREPARATION_COMPLETED', 'Chef Maria');
      expect(step1.order_status).toBe('PREPARATION_COMPLETED');

      // Step 2: Individual item reaching READY does NOT mark entire order ready
      const step2 = await updateOrderItemStatus('ord-0004', 'oi-0007', 'READY', 'Chef Maria');
      // oi-0008 is still only PREPARATION_COMPLETED, so order is NOT ready for service yet!
      expect(step2.order_status).toBe('PREPARATION_COMPLETED');

      // Step 3: Advance final item (oi-0008) to READY -> parent order automatically becomes READY_FOR_SERVICE
      const step3 = await updateOrderItemStatus('ord-0004', 'oi-0008', 'READY', 'Chef Maria');
      expect(step3.order_status).toBe('READY_FOR_SERVICE');
      expect(step3.ready_at).toBeDefined();

      // Step 4: Waiter serves all items -> parent order becomes SERVED
      const servedOrder = await markOrderServed('ord-0004', 'Rahul Verma');
      expect(servedOrder.order_status).toBe('SERVED');
      expect(servedOrder.served_at).toBeDefined();
    });

    it('rejects invalid item status transitions', async () => {
      // CANCELLED items cannot transition to READY
      await expect(
        updateOrderItemStatus('ord-0004', 'oi-0006', 'QUEUED', 'Chef')
      ).rejects.toThrow(/Cannot transition item status/);
    });
  });

  // ==========================================================================
  // 6. BILL SPLITTING & SETTLEMENT
  // ==========================================================================
  describe('Dining Bill Splitting & Partial Settlements', () => {
    it('handles equal bill splitting across N guests with exact paise rounding', async () => {
      // Order with total ₹882.00 split 3 ways: 882 / 3 = 294.00 each
      const splits = await createBillSplits('ord-0004', 'EQUAL', { splitCount: 3 });
      expect(splits.length).toBe(3);

      const splitSum = roundMoney(splits.reduce((acc, s) => acc + s.amount, 0));
      expect(splitSum).toBe(882.0);

      // Settle Guest 1 via UPI
      const res1 = await settleBillSplit(splits[0].id, 'UPI', 'Rahul Verma');
      expect(res1.split.payment_status).toBe('PAID');
      expect(res1.split.transaction_reference).toMatch(/^TXN-DEMO-/);
      expect(res1.order.outstanding_balance).toBe(882.0 - 294.0); // 588.0
      expect(res1.order.payment_status).toBe('UNPAID'); // Still partially unpaid

      // Duplicate payment attempt on already settled split is blocked
      await expect(
        settleBillSplit(splits[0].id, 'CARD', 'Rahul Verma')
      ).rejects.toThrow(/already been settled/);

      // Settle Guest 2 (CARD) & Guest 3 (CASH)
      await settleBillSplit(splits[1].id, 'CARD', 'Rahul Verma');
      const res3 = await settleBillSplit(splits[2].id, 'CASH', 'Rahul Verma');

      // All splits settled -> order is now PAID!
      expect(res3.order.outstanding_balance).toBe(0);
      expect(res3.order.payment_status).toBe('PAID');

      // Close completed order resets table to cleaning
      const completed = await closeCompletedOrder('ord-0004', 'Rahul Verma');
      expect(completed.order_status).toBe('COMPLETED');

      const tables = await fetchCafeTables();
      const table = tables.find((t) => t.table_number === 'T-04')!;
      expect(table.status).toBe('cleaning');
      expect(table.active_order_id).toBeNull();
    });

    it('supports custom amount bill splitting and validates exact total match', async () => {
      // Order total is 882.00
      // 1. Mismatched custom split fails validation
      await expect(
        createBillSplits('ord-0004', 'CUSTOM', { customAmounts: [400, 400] }) // 800 != 882
      ).rejects.toThrow(/does not match total payable bill/);

      // 2. Matching custom split succeeds
      const customSplits = await createBillSplits('ord-0004', 'CUSTOM', {
        customAmounts: [500, 382],
      });
      expect(customSplits.length).toBe(2);
      expect(customSplits[0].amount + customSplits[1].amount).toBe(882);
    });

    it('supports item-based bill splitting between dining guests', async () => {
      // Order items: oi-0006 (Latte: 240), oi-0007 (Toast: 340), oi-0008 (Cheesecake: 260)
      const itemSplits = await createBillSplits('ord-0004', 'ITEMS', {
        itemAssignments: {
          1: ['oi-0006'], // Latte + tax
          2: ['oi-0007', 'oi-0008'], // Toast + Cheesecake + tax
        },
      });

      expect(itemSplits.length).toBe(2);
      const sum = roundMoney(itemSplits[0].amount + itemSplits[1].amount);
      expect(sum).toBe(882.0);
    });
  });

  // ==========================================================================
  // 7. REALTIME OPERATIONAL SYNCHRONIZATION
  // ==========================================================================
  describe('Realtime Operational Synchronization', () => {
    it('dispatches realtime events to active listeners and unsubscribes cleanly', () => {
      const receivedEvents: RealtimeOpsEvent[] = [];

      const unsubscribe = subscribeToRealtimeEvents((event) => {
        receivedEvents.push(event);
      });

      // Publish test operational event
      publishRealtimeEvent({
        type: 'ORDER_APPROVED',
        orderId: 'test-realtime-01',
        tableNumber: 'T-02',
        status: 'ACCEPTED',
        actorRole: 'WAITER',
        actorName: 'Rahul Verma',
      });

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe('ORDER_APPROVED');
      expect(receivedEvents[0].tableNumber).toBe('T-02');

      // Unsubscribe
      unsubscribe();

      // Subsequent event should not be received
      publishRealtimeEvent({
        type: 'ITEM_STATUS_CHANGED',
        orderId: 'test-realtime-01',
        status: 'READY',
      });

      expect(receivedEvents.length).toBe(1);
    });
  });
});
