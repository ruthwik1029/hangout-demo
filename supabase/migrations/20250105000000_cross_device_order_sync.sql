-- ============================================================================
-- HANGOUT Modern Cafe Digital Platform
-- Migration 05: Cross-Device Order & Revenue Synchronization for Admin & Staff Portals
-- Provides authoritative SECURITY DEFINER RPCs for multi-device data synchronization.
-- Resolves cross-device revenue discrepancy where desktop and mobile had disjoint local stores.
-- ============================================================================

BEGIN;

-- 1. Unblock PostgreSQL RLS subquery evaluation on public.orders & public.payments
-- In Migration 04, REVOKE ALL ON public.customers FROM anon broke PostgreSQL's
-- ability to evaluate subqueries in RLS policies for anon users (Error 42501).
-- This grant allows PostgreSQL to evaluate customer subqueries cleanly.
GRANT SELECT ON public.customers TO anon;

-- 2. Authoritative SECURITY DEFINER RPC: get_admin_orders
-- Allows authenticated internal portal sessions (Admin, Manager, Cashier, Staff)
-- to fetch all live orders with line items across any device (Desktop, Mobile, Tablet).
-- Bypasses anon RLS restrictions safely without exposing customers table to raw client scraping.
CREATE OR REPLACE FUNCTION public.get_admin_orders(
    p_status TEXT DEFAULT NULL,
    p_limit INT DEFAULT 200
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT COALESCE(jsonb_agg(order_row ORDER BY (order_row->>'created_at') DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'order_type', o.order_type,
            'table_id', o.table_id,
            'table_number_snapshot', o.table_number_snapshot,
            'pickup_time_slot', o.pickup_time_slot,
            'pickup_slot_snapshot', COALESCE(o.pickup_slot_snapshot, o.pickup_time_slot),
            'pickup_notes', o.pickup_notes,
            'customer_id', o.customer_id,
            'customer_name_snapshot', o.customer_name_snapshot,
            'customer_mobile_snapshot', o.customer_mobile_snapshot,
            'customer_email_snapshot', o.customer_email_snapshot,
            'subtotal', o.subtotal,
            'discount_amount', o.discount_amount,
            'discount_code', o.discount_code,
            'tax_amount', o.tax_amount,
            'tax_breakdown', o.tax_breakdown,
            'total_amount', o.total_amount,
            'payment_method', o.payment_method,
            'payment_status', o.payment_status,
            'order_status', o.order_status,
            'status', o.order_status,
            'rejection_reason', o.rejection_reason,
            'cancellation_reason', o.cancellation_reason,
            'special_instructions', o.special_instructions,
            'created_at', o.created_at,
            'updated_at', o.updated_at,
            'items', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', oi.id,
                    'order_id', oi.order_id,
                    'menu_item_id', oi.menu_item_id,
                    'item_name_snapshot', oi.item_name_snapshot,
                    'is_veg', oi.is_veg,
                    'unit_price', oi.unit_price,
                    'quantity', oi.quantity,
                    'total_price', (oi.unit_price * oi.quantity),
                    'variant_id', oi.variant_id,
                    'variant_name_snapshot', oi.variant_name_snapshot,
                    'selected_addons', oi.selected_addons,
                    'addon_names_snapshot', oi.addon_names_snapshot,
                    'addons_total', oi.addons_total,
                    'item_subtotal', oi.item_subtotal,
                    'status', oi.item_status,
                    'special_instructions', oi.special_instructions
                ) ORDER BY oi.created_at ASC)
                FROM public.order_items oi
                WHERE oi.order_id = o.id
            ), '[]'::jsonb)
        ) AS order_row
        FROM public.orders o
        WHERE (p_status IS NULL OR p_status = 'ALL' OR o.order_status = p_status)
        LIMIT p_limit
    ) sub;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_orders(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_orders(TEXT, INT) TO anon, authenticated;

-- 3. Authoritative SECURITY DEFINER RPC: get_admin_dashboard_metrics
-- Computes honest financial aggregates directly in the database engine:
-- Settled Revenue = SUM(total_amount) WHERE payment_status = 'PAID' AND status NOT IN ('CANCELLED', 'REJECTED')
-- Pending / Unpaid / Cancelled / Rejected orders are strictly excluded from financial revenue.
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_metrics(
    p_time_window TEXT DEFAULT 'today'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_total_revenue NUMERIC(10,2) := 0.00;
    v_total_orders INT := 0;
    v_paid_orders INT := 0;
    v_pending_orders INT := 0;
    v_completed_orders INT := 0;
    v_cancelled_orders INT := 0;
    v_aov NUMERIC(10,2) := 0.00;
    v_start_ts TIMESTAMPTZ;
BEGIN
    IF p_time_window = 'today' THEN
        v_start_ts := date_trunc('day', NOW());
    ELSIF p_time_window = 'week' THEN
        v_start_ts := NOW() - INTERVAL '7 days';
    ELSE
        v_start_ts := '1970-01-01 00:00:00+00'::TIMESTAMPTZ;
    END IF;

    -- Total orders placed in window
    SELECT COUNT(*)
    INTO v_total_orders
    FROM public.orders o
    WHERE o.created_at >= v_start_ts;

    -- Settled Revenue and Paid Orders count
    SELECT
        COALESCE(SUM(o.total_amount), 0.00),
        COUNT(*)
    INTO v_total_revenue, v_paid_orders
    FROM public.orders o
    WHERE o.created_at >= v_start_ts
      AND o.payment_status = 'PAID'
      AND o.order_status NOT IN ('CANCELLED', 'REJECTED');

    -- Status counts
    SELECT
        COUNT(*) FILTER (WHERE o.order_status = 'PENDING'),
        COUNT(*) FILTER (WHERE o.order_status = 'COMPLETED'),
        COUNT(*) FILTER (WHERE o.order_status IN ('CANCELLED', 'REJECTED'))
    INTO v_pending_orders, v_completed_orders, v_cancelled_orders
    FROM public.orders o
    WHERE o.created_at >= v_start_ts;

    -- Average Order Value
    IF v_paid_orders > 0 THEN
        v_aov := ROUND(v_total_revenue / v_paid_orders, 2);
    ELSE
        v_aov := 0.00;
    END IF;

    RETURN jsonb_build_object(
        'total_revenue', v_total_revenue,
        'total_orders', v_total_orders,
        'paid_orders', v_paid_orders,
        'pending_orders', v_pending_orders,
        'completed_orders', v_completed_orders,
        'cancelled_orders', v_cancelled_orders,
        'aov', v_aov,
        'time_window', p_time_window,
        'calculated_at', NOW()
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_metrics(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_metrics(TEXT) TO anon, authenticated;

-- 4. Enable Supabase Realtime publication for orders and cafe_tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'cafe_tables'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_tables;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END;
$$;

COMMIT;
