-- ============================================================================
-- HANGOUT Modern Cafe Platform
-- Migration: 20250104000000_demo_readiness_fix.sql
-- Purpose: Final Demo Readiness & Remote Supabase Fix
-- 1. Adds rejection_reason to public.orders
-- 2. Grants SELECT on public.customers to anon (unblocks RLS subquery evaluation)
-- 3. Updates search_path = public, extensions, pg_temp on critical RPCs
-- 4. Seeds core catalog (cafe_settings, cafe_tables, menu_categories, menu_items, variants, addons)
-- ============================================================================

BEGIN;

-- 1. Ensure required schema columns exist on public.orders and public.order_items
DO $$
BEGIN
    -- orders: rejection_reason
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN rejection_reason TEXT;
    END IF;

    -- orders: pickup_slot_snapshot
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pickup_slot_snapshot'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN pickup_slot_snapshot TEXT;
    END IF;

    -- orders: backfill pickup_slot_snapshot from pickup_time_slot for existing records
    UPDATE public.orders
    SET pickup_slot_snapshot = pickup_time_slot
    WHERE pickup_slot_snapshot IS NULL AND pickup_time_slot IS NOT NULL;

    -- order_items: is_veg
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'is_veg'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN is_veg BOOLEAN DEFAULT false;
    END IF;

    -- order_items: variant_snapshot
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'variant_snapshot'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN variant_snapshot JSONB;
    END IF;

    -- order_items: addon_names_snapshot
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'addon_names_snapshot'
    ) THEN
        ALTER TABLE public.order_items ADD COLUMN addon_names_snapshot TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- 2. Preserve strict customer privacy & RLS
-- Direct table access to customers is strictly restricted to authenticated staff and profile owners.
-- Anonymous users access orders exclusively via SECURITY DEFINER RPCs (place_order, get_order_by_access_token).
REVOKE ALL ON public.customers FROM anon;

-- 3. Update get_order_by_access_token RPC with search_path including extensions
-- Cleanly drop obsolete overloads (UUID, TEXT) to prevent PGRST202 ambiguous resolution
DROP FUNCTION IF EXISTS public.get_order_by_access_token(UUID, TEXT);
DROP FUNCTION IF EXISTS public.get_order_by_access_token(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.get_order_by_access_token(
    p_order_id TEXT,
    p_access_token TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_token_hash TEXT;
    v_result JSONB;
BEGIN
    IF p_access_token IS NULL OR TRIM(p_access_token) = '' THEN
        RAISE EXCEPTION 'Access token is required';
    END IF;

    v_token_hash := encode(sha256(p_access_token::bytea), 'hex');

    SELECT jsonb_build_object(
        'order', jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            'order_type', o.order_type,
            'table_id', o.table_id,
            'table_number_snapshot', o.table_number_snapshot,
            'pickup_time_slot', o.pickup_time_slot,
            'pickup_slot_snapshot', COALESCE(o.pickup_slot_snapshot, o.pickup_time_slot),
            'pickup_notes', o.pickup_notes,
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
            'rejection_reason', o.rejection_reason,
            'cancellation_reason', o.cancellation_reason,
            'special_instructions', o.special_instructions,
            'created_at', o.created_at,
            'updated_at', o.updated_at
        ),
        'items', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', oi.id,
                'menu_item_id', oi.menu_item_id,
                'item_name_snapshot', oi.item_name_snapshot,
                'is_veg', oi.is_veg,
                'unit_price', oi.unit_price,
                'quantity', oi.quantity,
                'variant_id', oi.variant_id,
                'variant_name_snapshot', oi.variant_name_snapshot,
                'selected_addons', oi.selected_addons,
                'addon_names_snapshot', oi.addon_names_snapshot,
                'addons_total', oi.addons_total,
                'item_subtotal', oi.item_subtotal,
                'special_instructions', oi.special_instructions
            ))
            FROM public.order_items oi
            WHERE oi.order_id = o.id
        ), '[]'::jsonb)
    ) INTO v_result
    FROM public.orders o
    WHERE (
        (o.id::text = p_order_id OR o.order_number = p_order_id)
        AND (
            o.guest_access_token_hash = v_token_hash
            OR public.is_staff()
        )
    );

    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Order not found or invalid access token';
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.get_order_by_access_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_access_token(TEXT, TEXT) TO anon, authenticated;

-- 4. Update confirm_demo_payment RPC with search_path including extensions
-- Cleanly drop obsolete overloads to prevent PGRST202 ambiguous resolution
DROP FUNCTION IF EXISTS public.confirm_demo_payment(UUID, TEXT);
DROP FUNCTION IF EXISTS public.confirm_demo_payment(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.confirm_demo_payment(UUID, TEXT, TEXT, NUMERIC);

CREATE OR REPLACE FUNCTION public.confirm_demo_payment(
    p_order_id UUID,
    p_payment_method TEXT,
    p_guest_access_token TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_payment_id UUID := gen_random_uuid();
    v_txn_id UUID := gen_random_uuid();
    v_txn_ref TEXT;
    v_is_authorized BOOLEAN := FALSE;
    v_existing_payment public.payments%ROWTYPE;
    v_db_payment_method TEXT;
BEGIN
    IF p_payment_method NOT IN ('UPI_DEMO', 'CARD_DEMO', 'CASH_COUNTER', 'UPI', 'CARD', 'CASH') THEN
        RAISE EXCEPTION 'Invalid payment method: %. Only supported simulated demo payment methods are allowed.', p_payment_method;
    END IF;

    -- Normalize demo payment method to match check constraints
    v_db_payment_method := CASE
        WHEN p_payment_method = 'UPI' THEN 'UPI_DEMO'
        WHEN p_payment_method = 'CARD' THEN 'CARD_DEMO'
        WHEN p_payment_method = 'CASH_COUNTER' THEN 'CASH'
        ELSE p_payment_method
    END;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    IF public.is_staff() THEN
        v_is_authorized := TRUE;
    ELSIF p_guest_access_token IS NOT NULL AND TRIM(p_guest_access_token) <> '' THEN
        IF v_order.guest_access_token_hash = encode(sha256(p_guest_access_token::bytea), 'hex') THEN
            v_is_authorized := TRUE;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized payment confirmation attempt: Invalid credentials';
    END IF;

    IF v_order.payment_status = 'PAID' THEN
        RAISE EXCEPTION 'Order % has already been paid and settled', v_order.order_number;
    END IF;

    IF v_order.order_status IN ('CANCELLED', 'REJECTED') THEN
        RAISE EXCEPTION 'Cannot process payment for % order %', v_order.order_status, v_order.order_number;
    END IF;

    SELECT * INTO v_existing_payment FROM public.payments WHERE order_id = p_order_id AND payment_status = 'PAID' LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Completed payment record already exists for order %', v_order.order_number;
    END IF;

    IF p_amount IS NOT NULL AND ABS(p_amount - v_order.total_amount) > 0.01 THEN
        RAISE EXCEPTION 'Payment amount mismatch: received %, expected %', p_amount, v_order.total_amount;
    END IF;

    v_txn_ref := 'DEMO_TXN_' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '_' || LPAD(FLOOR(random() * 10000)::text, 4, '0');

    INSERT INTO public.payments (
        id,
        order_id,
        amount,
        payment_method,
        payment_status,
        transaction_reference,
        gateway_response,
        paid_at,
        created_at,
        updated_at
    ) VALUES (
        v_payment_id,
        p_order_id,
        v_order.total_amount,
        v_db_payment_method,
        'PAID',
        v_txn_ref,
        jsonb_build_object(
            'simulation', true,
            'mode', 'DEMO_SANDBOX',
            'method', v_db_payment_method,
            'settled_at', NOW()
        ),
        NOW(),
        NOW(),
        NOW()
    );

    INSERT INTO public.payment_transactions (
        id,
        payment_id,
        gateway,
        transaction_ref,
        amount,
        status,
        raw_payload,
        created_at
    ) VALUES (
        v_txn_id,
        v_payment_id,
        'SIMULATED_DEMO',
        v_txn_ref,
        v_order.total_amount,
        'SUCCESS',
        jsonb_build_object(
            'gateway', 'SIMULATED_DEMO',
            'verified', true,
            'timestamp', NOW(),
            'notes', 'Simulated demo payment completed successfully'
        ),
        NOW()
    );

    UPDATE public.orders
    SET payment_status = 'PAID',
        payment_method = v_db_payment_method,
        order_status = CASE WHEN order_status = 'PENDING' THEN 'ACCEPTED' ELSE order_status END,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Update customer total_spent if linked
    IF v_order.customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET total_spent = total_spent + v_order.total_amount,
            updated_at = NOW()
        WHERE id = v_order.customer_id;
    END IF;

    INSERT INTO public.order_status_history (
        order_id,
        from_status,
        to_status,
        changed_by,
        notes
    ) VALUES (
        p_order_id,
        v_order.order_status,
        CASE WHEN v_order.order_status = 'PENDING' THEN 'ACCEPTED' ELSE v_order.order_status END,
        CASE WHEN public.is_staff() THEN 'STAFF' ELSE 'CUSTOMER' END,
        'Payment settled via ' || v_db_payment_method || ' (Ref: ' || v_txn_ref || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order.order_number,
        'payment_status', 'PAID',
        'order_status', CASE WHEN v_order.order_status = 'PENDING' THEN 'ACCEPTED' ELSE v_order.order_status END,
        'transaction_reference', v_txn_ref,
        'amount', v_order.total_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.confirm_demo_payment(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_demo_payment(UUID, TEXT, TEXT, NUMERIC) TO anon, authenticated;

-- 5. Update place_order RPC with search_path including extensions & robust input parsing
DROP FUNCTION IF EXISTS public.place_order(JSONB, JSONB);

CREATE OR REPLACE FUNCTION public.place_order(
    order_payload JSONB,
    items_payload JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID := gen_random_uuid();
    v_order_number TEXT;
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_order_type TEXT;
    v_table_id UUID := NULL;
    v_table_number TEXT := NULL;
    v_pickup_slot TEXT := NULL;
    v_pickup_notes TEXT := NULL;
    v_cust_name TEXT;
    v_cust_mobile TEXT;
    v_cust_email TEXT;
    v_customer_id UUID := NULL;
    v_existing_cust public.customers%ROWTYPE;
    v_payment_method TEXT;
    v_special_notes TEXT;

    v_tax_cfg public.tax_configurations%ROWTYPE;
    v_tax_rate NUMERIC(5,2) := 0.00;
    v_order_subtotal NUMERIC(10,2) := 0.00;
    v_discount_amount NUMERIC(10,2) := 0.00;
    v_discount_code TEXT := NULL;
    v_discount_record public.discounts%ROWTYPE;
    v_taxable_amount NUMERIC(10,2) := 0.00;
    v_tax_amount NUMERIC(10,2) := 0.00;
    v_cgst NUMERIC(10,2) := 0.00;
    v_sgst NUMERIC(10,2) := 0.00;
    v_total_amount NUMERIC(10,2) := 0.00;

    v_item_elem JSONB;
    v_menu_item_id UUID;
    v_item public.menu_items%ROWTYPE;
    v_qty INT;
    v_variant_id UUID := NULL;
    v_variant public.menu_item_variants%ROWTYPE;
    v_variant_name TEXT := NULL;
    v_variant_delta NUMERIC(10,2) := 0.00;
    v_variant_json JSONB := NULL;
    v_item_unit_price NUMERIC(10,2);
    v_item_subtotal NUMERIC(10,2);
    v_item_notes TEXT;
    v_selected_addons JSONB;
    v_addon_elem JSONB;
    v_addon_id UUID;
    v_addon public.menu_item_addons%ROWTYPE;
    v_item_addons_total NUMERIC(10,2) := 0.00;
    v_validated_addons JSONB := '[]'::jsonb;
    v_addon_names TEXT[] := '{}';
    v_addon_ids_seen UUID[] := '{}';
    v_items_count INT := 0;

    v_cafe_cfg public.cafe_settings%ROWTYPE;
    v_table public.cafe_tables%ROWTYPE;
BEGIN
    -- 1. Validate Order Type
    v_order_type := UPPER(TRIM(COALESCE(order_payload->>'order_type', '')));
    IF v_order_type IN ('DINE_IN', 'DINEIN', 'DINE-IN') THEN
        v_order_type := 'DINING';
    END IF;
    IF v_order_type NOT IN ('DINING', 'TAKEAWAY') THEN
        RAISE EXCEPTION 'Invalid order type: "%". Allowed types are DINING or TAKEAWAY', v_order_type;
    END IF;

    -- 2. Fetch Cafe Settings & Validate Active Fulfillment
    SELECT * INTO v_cafe_cfg FROM public.cafe_settings ORDER BY created_at DESC LIMIT 1;

    -- 3. Fulfillment-specific validation
    IF v_order_type = 'DINING' THEN
        IF FOUND AND v_cafe_cfg.dining_enabled = FALSE THEN
            RAISE EXCEPTION 'Dine-in ordering is currently disabled';
        END IF;

        IF order_payload->>'table_id' IS NULL AND order_payload->>'table_number_snapshot' IS NULL THEN
            RAISE EXCEPTION 'Dine-in orders require a table selection';
        END IF;

        IF order_payload->>'table_id' IS NOT NULL AND TRIM(order_payload->>'table_id') <> '' THEN
            BEGIN
                v_table_id := (order_payload->>'table_id')::UUID;
                SELECT * INTO v_table FROM public.cafe_tables WHERE id = v_table_id;
            EXCEPTION WHEN invalid_text_representation THEN
                SELECT * INTO v_table FROM public.cafe_tables WHERE table_number = order_payload->>'table_number_snapshot' LIMIT 1;
                IF FOUND THEN v_table_id := v_table.id; END IF;
            END;
        ELSE
            SELECT * INTO v_table FROM public.cafe_tables WHERE table_number = order_payload->>'table_number_snapshot' LIMIT 1;
            IF FOUND THEN v_table_id := v_table.id; END IF;
        END IF;

        IF v_table.id IS NOT NULL THEN
            v_table_id := v_table.id;
            v_table_number := v_table.table_number;
        ELSE
            v_table_number := COALESCE(order_payload->>'table_number_snapshot', 'T-01');
        END IF;

    ELSIF v_order_type = 'TAKEAWAY' THEN
        IF FOUND AND v_cafe_cfg.takeaway_enabled = FALSE THEN
            RAISE EXCEPTION 'Takeaway ordering is currently disabled';
        END IF;

        v_pickup_slot := NULLIF(TRIM(COALESCE(order_payload->>'pickup_time_slot', order_payload->>'pickup_slot_snapshot', '')), '');
        IF v_pickup_slot IS NULL THEN
            v_pickup_slot := 'ASAP Pickup';
        END IF;
        v_pickup_notes := NULLIF(TRIM(COALESCE(order_payload->>'pickup_notes', '')), '');
    END IF;

    -- 4. Customer Contact Details Snapshot
    v_cust_name := TRIM(COALESCE(order_payload->>'customer_name_snapshot', order_payload->>'customer_name', ''));
    IF LENGTH(v_cust_name) < 2 OR LENGTH(v_cust_name) > 100 THEN
        RAISE EXCEPTION 'Customer full name must be between 2 and 100 characters';
    END IF;

    v_cust_mobile := regexp_replace(COALESCE(order_payload->>'customer_mobile_snapshot', order_payload->>'customer_mobile', ''), '\D', '', 'g');
    IF LENGTH(v_cust_mobile) = 12 AND v_cust_mobile LIKE '91%' THEN
        v_cust_mobile := SUBSTRING(v_cust_mobile FROM 3);
    END IF;
    IF LENGTH(v_cust_mobile) <> 10 THEN
        RAISE EXCEPTION 'Customer mobile number must be a valid 10-digit phone number (received: %)', v_cust_mobile;
    END IF;

    v_cust_email := NULLIF(TRIM(COALESCE(order_payload->>'customer_email_snapshot', order_payload->>'customer_email', '')), '');
    IF v_cust_email IS NOT NULL AND NOT (v_cust_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') THEN
        RAISE EXCEPTION 'Invalid customer email address format: %', v_cust_email;
    END IF;

    -- 5. Customer Association / Deduplication (Atomic & Secure inside SECURITY DEFINER)
    SELECT * INTO v_existing_cust
    FROM public.customers
    WHERE mobile_number = v_cust_mobile
    ORDER BY created_at ASC
    LIMIT 1;

    IF FOUND THEN
        IF v_existing_cust.auth_user_id IS NOT NULL THEN
            -- Customer is a registered auth user.
            -- An anonymous guest must NOT be able to attach an order to an existing registered customer's profile
            -- merely by submitting that customer's phone number!
            IF auth.uid() IS NOT NULL AND auth.uid() = v_existing_cust.auth_user_id THEN
                -- Authenticated caller matches account owner: attach to registered profile
                v_customer_id := v_existing_cust.id;
                UPDATE public.customers
                SET total_orders = total_orders + 1,
                    last_visit_at = NOW(),
                    updated_at = NOW()
                WHERE id = v_customer_id;
            ELSE
                -- Anonymous or mismatched caller: DO NOT attach this order to the registered customer's profile
                -- Leave v_customer_id as NULL so the order remains an unlinked guest order.
                v_customer_id := NULL;
            END IF;
        ELSE
            -- Customer is an unauthenticated guest record (auth_user_id IS NULL)
            v_customer_id := v_existing_cust.id;
            UPDATE public.customers
            SET full_name = CASE
                    WHEN full_name IS NOT NULL AND full_name NOT IN ('Guest Customer', 'Walk-in Guest') AND TRIM(full_name) <> '' THEN full_name
                    ELSE COALESCE(NULLIF(v_cust_name, ''), full_name)
                END,
                email = CASE
                    WHEN email IS NOT NULL AND TRIM(email) <> '' THEN email
                    ELSE COALESCE(v_cust_email, email)
                END,
                total_orders = total_orders + 1,
                last_visit_at = NOW(),
                updated_at = NOW()
            WHERE id = v_customer_id;
        END IF;
    ELSE
        -- No existing customer with this mobile number: create new guest record
        v_customer_id := gen_random_uuid();
        INSERT INTO public.customers (
            id,
            full_name,
            mobile_number,
            email,
            total_orders,
            total_spent,
            last_visit_at,
            created_at,
            updated_at
        ) VALUES (
            v_customer_id,
            v_cust_name,
            v_cust_mobile,
            v_cust_email,
            1,
            0.00,
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    -- 6. Payment Method & Special Notes
    v_payment_method := UPPER(TRIM(COALESCE(order_payload->>'payment_method', 'UPI_DEMO')));
    v_special_notes := NULLIF(TRIM(COALESCE(order_payload->>'special_instructions', order_payload->>'notes', '')), '');

    -- 7. Generate Cryptographically Secure 256-bit Guest Access Token & Hash (Extension-independent)
    v_raw_token := encode(sha256((gen_random_uuid()::text || clock_timestamp()::text || random()::text)::bytea), 'hex');
    v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');
    v_order_number := public.generate_order_number();

    -- 8. Validate Items Payload Existence
    IF items_payload IS NULL OR jsonb_array_length(items_payload) = 0 THEN
        RAISE EXCEPTION 'Cannot place an empty order. At least one order item is required.';
    END IF;

    -- 9. Fetch Tax Configuration for Snapshot
    SELECT * INTO v_tax_cfg FROM public.tax_configurations ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_tax_cfg.is_gst_enabled = TRUE THEN
        v_tax_rate := v_tax_cfg.default_tax_rate;
    ELSE
        v_tax_rate := 0.00;
    END IF;

    -- 10. Insert Parent Order Record
    INSERT INTO public.orders (
        id,
        order_number,
        guest_access_token_hash,
        customer_id,
        customer_name_snapshot,
        customer_mobile_snapshot,
        customer_email_snapshot,
        order_type,
        table_id,
        table_number_snapshot,
        pickup_time_slot,
        pickup_slot_snapshot,
        pickup_notes,
        subtotal,
        discount_amount,
        tax_amount,
        total_amount,
        payment_method,
        payment_status,
        order_status,
        special_instructions
    ) VALUES (
        v_order_id,
        v_order_number,
        v_token_hash,
        v_customer_id,
        v_cust_name,
        v_cust_mobile,
        v_cust_email,
        v_order_type,
        v_table_id,
        v_table_number,
        v_pickup_slot,
        v_pickup_slot,
        v_pickup_notes,
        0.00,
        0.00,
        0.00,
        0.00,
        v_payment_method,
        'UNPAID',
        'PENDING',
        v_special_notes
    );

    -- 10. Process Each Order Item Authoritatively
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(items_payload)
    LOOP
        v_items_count := v_items_count + 1;

        IF v_item_elem->>'menu_item_id' IS NULL THEN
            RAISE EXCEPTION 'Item #% is missing menu_item_id', v_items_count;
        END IF;

        BEGIN
            v_menu_item_id := (v_item_elem->>'menu_item_id')::UUID;
            SELECT * INTO v_item FROM public.menu_items WHERE id = v_menu_item_id;
        EXCEPTION WHEN invalid_text_representation THEN
            SELECT * INTO v_item FROM public.menu_items WHERE slug = v_item_elem->>'slug' OR name = v_item_elem->>'item_name' LIMIT 1;
            IF FOUND THEN v_menu_item_id := v_item.id; END IF;
        END;

        IF NOT FOUND OR v_item.id IS NULL THEN
            RAISE EXCEPTION 'Menu item with ID % does not exist', v_item_elem->>'menu_item_id';
        END IF;

        IF v_item.is_available = FALSE THEN
            RAISE EXCEPTION 'Menu item "%" is currently unavailable', v_item.name;
        END IF;

        v_qty := COALESCE((v_item_elem->>'quantity')::INT, 0);
        IF v_qty <= 0 OR v_qty > 100 THEN
            RAISE EXCEPTION 'Quantity for "%" must be between 1 and 100 (received: %)', v_item.name, v_qty;
        END IF;

        v_item_unit_price := v_item.base_price;
        v_variant_id := NULL;
        v_variant_name := NULL;
        v_variant_delta := 0.00;
        v_variant_json := NULL;

        IF v_item_elem->>'variant_id' IS NOT NULL AND TRIM(v_item_elem->>'variant_id') <> '' THEN
            BEGIN
                v_variant_id := (v_item_elem->>'variant_id')::UUID;
                SELECT * INTO v_variant FROM public.menu_item_variants WHERE id = v_variant_id AND menu_item_id = v_menu_item_id;
            EXCEPTION WHEN invalid_text_representation THEN
                SELECT * INTO v_variant FROM public.menu_item_variants WHERE menu_item_id = v_menu_item_id AND name = v_item_elem->>'variant_name' LIMIT 1;
                IF FOUND THEN v_variant_id := v_variant.id; END IF;
            END;

            IF v_variant.id IS NOT NULL THEN
                v_variant_name := v_variant.name;
                v_variant_delta := v_variant.price_delta;
                v_variant_json := jsonb_build_object('id', v_variant.id, 'name', v_variant.name, 'price_delta', v_variant.price_delta);
                v_item_unit_price := v_item_unit_price + v_variant_delta;
            END IF;
        END IF;

        v_item_addons_total := 0.00;
        v_validated_addons := '[]'::jsonb;
        v_addon_names := '{}';
        v_addon_ids_seen := '{}';
        v_selected_addons := COALESCE(v_item_elem->'selected_addons', v_item_elem->'addons_snapshot', '[]'::jsonb);

        IF jsonb_typeof(v_selected_addons) = 'array' AND jsonb_array_length(v_selected_addons) > 0 THEN
            FOR v_addon_elem IN SELECT * FROM jsonb_array_elements(v_selected_addons)
            LOOP
                v_addon_id := NULL;
                IF jsonb_typeof(v_addon_elem) = 'string' THEN
                    BEGIN
                        v_addon_id := (v_addon_elem #>> '{}')::UUID;
                        SELECT * INTO v_addon FROM public.menu_item_addons WHERE id = v_addon_id AND (menu_item_id = v_menu_item_id OR category_id = v_item.category_id);
                    EXCEPTION WHEN invalid_text_representation THEN
                        SELECT * INTO v_addon FROM public.menu_item_addons WHERE (menu_item_id = v_menu_item_id OR category_id = v_item.category_id) AND name = (v_addon_elem #>> '{}') LIMIT 1;
                        IF FOUND THEN v_addon_id := v_addon.id; END IF;
                    END;
                ELSIF jsonb_typeof(v_addon_elem) = 'object' THEN
                    BEGIN
                        v_addon_id := COALESCE(v_addon_elem->>'id', v_addon_elem->>'addon_id')::UUID;
                        SELECT * INTO v_addon FROM public.menu_item_addons WHERE id = v_addon_id AND (menu_item_id = v_menu_item_id OR category_id = v_item.category_id);
                    EXCEPTION WHEN invalid_text_representation THEN
                        SELECT * INTO v_addon FROM public.menu_item_addons WHERE (menu_item_id = v_menu_item_id OR category_id = v_item.category_id) AND name = v_addon_elem->>'name' LIMIT 1;
                        IF FOUND THEN v_addon_id := v_addon.id; END IF;
                    END;
                END IF;

                IF v_addon.id IS NOT NULL THEN
                    IF v_addon.id = ANY(v_addon_ids_seen) THEN
                        RAISE EXCEPTION 'Duplicate add-on selection prohibited for item "%"', v_item.name;
                    END IF;

                    IF v_addon.is_available = FALSE THEN
                        RAISE EXCEPTION 'Add-on "%" is currently marked as unavailable', v_addon.name;
                    END IF;

                    v_item_addons_total := v_item_addons_total + v_addon.price;
                    v_addon_ids_seen := array_append(v_addon_ids_seen, v_addon.id);
                    v_addon_names := array_append(v_addon_names, v_addon.name);
                    v_validated_addons := v_validated_addons || jsonb_build_object(
                        'id', v_addon.id,
                        'name', v_addon.name,
                        'price', v_addon.price,
                        'is_veg', v_addon.is_veg
                    );
                END IF;
            END LOOP;
        END IF;

        v_item_subtotal := (v_item_unit_price * v_qty) + v_item_addons_total;
        v_order_subtotal := v_order_subtotal + v_item_subtotal;
        v_item_notes := NULLIF(TRIM(COALESCE(v_item_elem->>'special_instructions', '')), '');

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name_snapshot,
            is_veg,
            unit_price,
            quantity,
            variant_id,
            variant_name_snapshot,
            variant_snapshot,
            selected_addons,
            addon_names_snapshot,
            addons_total,
            item_subtotal,
            tax_rate_snapshot,
            special_instructions
        ) VALUES (
            v_order_id,
            v_menu_item_id,
            v_item.name,
            v_item.is_veg,
            v_item_unit_price,
            v_qty,
            v_variant_id,
            v_variant_name,
            v_variant_json,
            v_validated_addons,
            v_addon_names,
            v_item_addons_total,
            v_item_subtotal,
            v_tax_rate,
            v_item_notes
        );
    END LOOP;

    -- 11. Authoritative Discount Calculation
    v_discount_code := NULLIF(UPPER(TRIM(COALESCE(order_payload->>'discount_code', ''))), '');
    IF v_discount_code IS NOT NULL THEN
        SELECT * INTO v_discount_record
        FROM public.discounts
        WHERE code = v_discount_code
          AND is_active = TRUE
          AND (valid_from IS NULL OR valid_from <= NOW())
          AND (valid_until IS NULL OR valid_until >= NOW());

        IF FOUND THEN
            IF v_order_subtotal >= v_discount_record.min_order_amount THEN
                IF v_discount_record.discount_type = 'PERCENTAGE' THEN
                    v_discount_amount := ROUND((v_order_subtotal * (v_discount_record.discount_value / 100.0))::numeric, 2);
                    IF v_discount_record.max_discount_amount IS NOT NULL THEN
                        v_discount_amount := LEAST(v_discount_amount, v_discount_record.max_discount_amount);
                    END IF;
                ELSIF v_discount_record.discount_type = 'FLAT' THEN
                    v_discount_amount := LEAST(v_discount_record.discount_value, v_order_subtotal);
                END IF;
            ELSE
                v_discount_code := NULL;
                v_discount_amount := 0.00;
            END IF;
        ELSE
            v_discount_code := NULL;
            v_discount_amount := 0.00;
        END IF;
    END IF;

    -- 12. Authoritative Tax & Total Calculation
    v_taxable_amount := GREATEST(v_order_subtotal - v_discount_amount, 0.00);
    IF v_tax_rate > 0.00 THEN
        v_tax_amount := ROUND((v_taxable_amount * (v_tax_rate / 100.0))::numeric, 2);
        v_cgst := ROUND((v_tax_amount / 2.0)::numeric, 2);
        v_sgst := v_tax_amount - v_cgst;
    ELSE
        v_tax_amount := 0.00;
        v_cgst := 0.00;
        v_sgst := 0.00;
    END IF;

    v_total_amount := ROUND((v_taxable_amount + v_tax_amount)::numeric, 2);

    -- 13. Update Final Authoritative Amounts on Order
    UPDATE public.orders
    SET subtotal = v_order_subtotal,
        discount_amount = v_discount_amount,
        discount_code = v_discount_code,
        tax_amount = v_tax_amount,
        tax_breakdown = jsonb_build_object(
            'is_gst_enabled', (v_tax_rate > 0),
            'tax_rate', v_tax_rate,
            'cgst', v_cgst,
            'sgst', v_sgst,
            'cgst_rate', ROUND((v_tax_rate / 2.0)::numeric, 2),
            'sgst_rate', ROUND((v_tax_rate / 2.0)::numeric, 2),
            'total_tax', v_tax_amount
        ),
        total_amount = v_total_amount,
        updated_at = NOW()
    WHERE id = v_order_id;

    -- 14. Record Initial Status History
    INSERT INTO public.order_status_history (
        order_id,
        from_status,
        to_status,
        changed_by,
        notes
    ) VALUES (
        v_order_id,
        NULL,
        'PENDING',
        'CUSTOMER',
        'Guest order placed via secure RPC'
    );

    -- 15. Return Output
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'customer_id', v_customer_id,
        'guest_access_token', v_raw_token,
        'pickup_slot_snapshot', v_pickup_slot,
        'pickup_time_slot', v_pickup_slot,
        'subtotal', v_order_subtotal,
        'discount_amount', v_discount_amount,
        'tax_amount', v_tax_amount,
        'total_amount', v_total_amount,
        'payment_status', 'UNPAID',
        'order_status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO anon, authenticated;

-- ============================================================================
-- 6. CORE CATALOG SEED DATA FOR DEMO OPERATION
-- ============================================================================

-- 6.1 Cafe Settings
INSERT INTO public.cafe_settings (
    id,
    cafe_name,
    tagline,
    phone,
    email,
    address,
    opening_hours,
    dining_enabled,
    takeaway_enabled,
    gst_enabled,
    gst_percentage,
    gst_number,
    currency_symbol,
    currency_code,
    takeaway_notice
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'HANGOUT',
    'Authentic Flame-Roasted Shawarma, Flaky Murtabak & Crispy Starters',
    NULL,
    NULL,
    NULL,
    NULL,
    TRUE,
    TRUE,
    TRUE,
    5.00,
    NULL,
    '₹',
    'INR',
    'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.'
) ON CONFLICT (id) DO UPDATE SET
    cafe_name = EXCLUDED.cafe_name,
    tagline = EXCLUDED.tagline,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    opening_hours = EXCLUDED.opening_hours,
    dining_enabled = EXCLUDED.dining_enabled,
    takeaway_enabled = EXCLUDED.takeaway_enabled,
    gst_enabled = EXCLUDED.gst_enabled,
    gst_percentage = EXCLUDED.gst_percentage,
    gst_number = EXCLUDED.gst_number,
    currency_symbol = EXCLUDED.currency_symbol,
    currency_code = EXCLUDED.currency_code,
    takeaway_notice = EXCLUDED.takeaway_notice,
    updated_at = NOW();

-- 6.2 Cafe Tables (8 Tables with Deterministic UUIDs)
INSERT INTO public.cafe_tables (id, table_number, qr_code_identifier, seating_capacity, section, status, is_active) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'T-01', 'hangout-qr-table-t01', 2, 'Window Seating', 'available', true),
    ('b0000000-0000-0000-0000-000000000002', 'T-02', 'hangout-qr-table-t02', 4, 'Main Dining Hall', 'available', true),
    ('b0000000-0000-0000-0000-000000000003', 'T-03', 'hangout-qr-table-t03', 4, 'Main Dining Hall', 'available', true),
    ('b0000000-0000-0000-0000-000000000004', 'T-04', 'hangout-qr-table-t04', 6, 'Open Terrace', 'available', true),
    ('b0000000-0000-0000-0000-000000000005', 'T-05', 'hangout-qr-table-t05', 2, 'Open Terrace', 'available', true),
    ('b0000000-0000-0000-0000-000000000006', 'T-06', 'hangout-qr-table-t06', 4, 'Family Booths', 'available', true),
    ('b0000000-0000-0000-0000-000000000007', 'T-07', 'hangout-qr-table-t07', 8, 'Family Booths', 'available', true),
    ('b0000000-0000-0000-0000-000000000008', 'T-08', 'hangout-qr-table-t08', 2, 'Rotisserie Counter', 'available', true)
ON CONFLICT (table_number) DO NOTHING;

-- 6.3 Menu Categories (4 Signature Shawarma Categories)
INSERT INTO public.menu_categories (id, name, slug, description, display_order, icon_name, image_url, is_active) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Shawarma - With Salad', 'shawarma-with-salad', 'Rotisserie flame-roasted chicken rolled with crisp lettuce, pickles, fries & garlic toum', 1, 'Utensils', '/images/food/cat-shawarma-with-salad.jpg', true),
    ('c0000000-0000-0000-0000-000000000002', 'Shawarma - No Salad (All Meat)', 'shawarma-no-salad-all-meat', '100% pure vertical rotisserie chicken carvings with garlic toum, no salad fillers', 2, 'Flame', '/images/food/cat-shawarma-no-salad.jpg', true),
    ('c0000000-0000-0000-0000-000000000003', 'Chicken Murtabak', 'chicken-murtabak', 'Crispy folded pan-fried dough parcels stuffed with spiced minced chicken and fluffy eggs', 3, 'Sparkles', '/images/food/cat-murtabak.jpg', true),
    ('c0000000-0000-0000-0000-000000000004', 'Chicken Starters', 'chicken-starters', 'Crunchy peri-peri strips, flame-grilled skewers, and golden crispy chicken bites', 4, 'Flame', '/images/food/cat-starters.jpg', true)
ON CONFLICT (slug) DO NOTHING;

-- 6.4 Signature Menu Items (13 Authentic Shawarma, Murtabak & Starter Items)
INSERT INTO public.menu_items (id, category_id, name, slug, description, base_price, image_url, is_veg, is_available, is_featured, is_today_special, preparation_time_mins, calories, display_order, station_code) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Classic Chicken Shawarma (With Salad)', 'classic-chicken-shawarma-with-salad', 'Tender rotisserie chicken shavings wrapped with crisp lettuce, pickled cucumbers, French fries, and our signature garlic toum.', 160.00, '/images/food/item-01-classic-shawarma-salad.jpg', false, true, true, false, 8, 420, 1, 'SHAWARMA'),
    ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'Grilled Chicken Shawarma (With Salad)', 'grilled-chicken-shawarma-with-salad', 'Char-grill finished chicken shavings with fresh shredded cabbage slaw, pickled turnips, and creamy tahini garlic sauce in toasted bread.', 180.00, '/images/food/item-02-grilled-shawarma-salad.jpg', false, true, true, false, 10, 460, 2, 'SHAWARMA'),
    ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'Cheese Chicken Shawarma (With Salad)', 'cheese-chicken-shawarma-with-salad', 'Rotisserie spiced chicken loaded with molten mozzarella, crisp shredded salad, and garlic toum wrapped in warm toasted bread.', 200.00, '/images/food/item-03-cheese-shawarma-salad.jpg', false, true, false, true, 10, 520, 3, 'SHAWARMA'),
    ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000002', 'Classic Chicken Shawarma (No Salad / All-Meat)', 'classic-chicken-shawarma-no-salad-all-meat', '100% pure flame-roasted chicken breast & thigh shavings, authentic garlic toum, and pickled gherkins with zero cabbage or salad filler.', 190.00, '/images/food/item-04-classic-shawarma-no-salad.jpg', false, true, true, false, 8, 550, 1, 'SHAWARMA'),
    ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'Grilled Chicken Shawarma (No Salad / All-Meat)', 'grilled-chicken-shawarma-no-salad-all-meat', 'Pure char-grilled chicken slices drenched in hot garlic glaze and smoky spices, rolled tightly with no vegetables or fillers.', 210.00, '/images/food/item-05-grilled-shawarma-no-salad.jpg', false, true, true, false, 10, 580, 2, 'SHAWARMA'),
    ('d0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000002', 'Cheese Blast Chicken Shawarma (No Salad / All-Meat)', 'cheese-blast-chicken-shawarma-no-salad-all-meat', 'Heaps of succulent roasted chicken folded with molten cheddar, mozzarella stretch, and double garlic cream. Pure meat and molten cheese indulgence.', 230.00, '/images/food/item-06-cheese-blast-no-salad.jpg', false, true, false, true, 10, 640, 3, 'SHAWARMA'),
    ('d0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000003', 'Classic Chicken Murtabak', 'classic-chicken-murtabak', 'Pan-fried folded crispy dough envelope stuffed with seasoned minced chicken, beaten eggs, scallions, and Arabian spices, served with curry dip.', 220.00, '/images/food/item-07-classic-murtabak.jpg', false, true, true, false, 12, 510, 1, 'GRILL'),
    ('d0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000003', 'Cheese Chicken Murtabak', 'cheese-chicken-murtabak', 'Crispy griddled Murtabak parcel bursting with spiced minced chicken, fluffy egg layer, melted mozzarella, and green chillies.', 260.00, '/images/food/item-08-cheese-murtabak.jpg', false, true, false, true, 14, 610, 2, 'GRILL'),
    ('d0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000003', 'Spicy Peri-Peri Chicken Murtabak', 'spicy-peri-peri-chicken-murtabak', 'Flaky golden dough square loaded with peri-peri seasoned minced chicken, crushed pepper, eggs, and coriander, served crisp off the griddle.', 250.00, '/images/food/item-09-peri-peri-murtabak.jpg', false, true, false, false, 12, 540, 3, 'GRILL'),
    ('d0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000004', 'Crispy Peri-Peri Chicken Strips', 'crispy-peri-peri-chicken-strips', 'Boneless chicken tenderloins double-dusted in seasoned flour, fried to a golden crunch, and tossed in spicy peri-peri rub with garlic mayo.', 220.00, '/images/food/item-10-crispy-strips.jpg', false, true, true, false, 10, 440, 1, 'FRY_SNACKS'),
    ('d0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000004', 'Char-Grilled Chicken Tikka Skewers', 'char-grilled-chicken-tikka-skewers', 'Succulent chicken chunks marinated in hung curd, Kashmiri chilli and crushed coriander seeds, char-grilled over glowing embers.', 240.00, '/images/food/item-11-tikka-skewers.jpg', false, true, true, false, 12, 380, 2, 'GRILL'),
    ('d0000000-0000-0000-0000-000000000012', 'c0000000-0000-0000-0000-000000000004', 'Crispy Chicken Popcorn Bites', 'crispy-chicken-popcorn-bites', 'Bite-sized tender chicken morsels crumb-fried until shatteringly crisp, served with sweet chilli toum dip.', 180.00, '/images/food/item-12-popcorn-bites.jpg', false, true, false, true, 8, 360, 3, 'FRY_SNACKS'),
    ('d0000000-0000-0000-0000-000000000013', 'c0000000-0000-0000-0000-000000000004', 'Flame-Grilled BBQ Chicken Wings', 'flame-grilled-bbq-chicken-wings', 'Juicy jumbo wings basted in smoky barbecue glaze and finished over the grill for caramelized crispy skin.', 230.00, '/images/food/item-13-bbq-wings.jpg', false, true, false, false, 12, 480, 4, 'GRILL')
ON CONFLICT (slug) DO NOTHING;

-- 6.5 Menu Item Variants
INSERT INTO public.menu_item_variants (id, menu_item_id, variant_group, name, price_delta, is_default, is_available, display_order) VALUES
    ('e0000000-0000-0000-0000-000000000101', 'd0000000-0000-0000-0000-000000000001', 'Wrap Size & Bread', 'Regular - Rumali Roti', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000102', 'd0000000-0000-0000-0000-000000000001', 'Wrap Size & Bread', 'Jumbo - Rumali Roti', 50.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000103', 'd0000000-0000-0000-0000-000000000001', 'Wrap Size & Bread', 'Regular - Kubbos Pocket', 10.00, false, true, 3),
    ('e0000000-0000-0000-0000-000000000201', 'd0000000-0000-0000-0000-000000000002', 'Wrap Size & Bread', 'Regular - Rumali Roti', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000202', 'd0000000-0000-0000-0000-000000000002', 'Wrap Size & Bread', 'Jumbo - Rumali Roti', 50.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000301', 'd0000000-0000-0000-0000-000000000003', 'Wrap Size & Bread', 'Regular - Rumali Roti', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000302', 'd0000000-0000-0000-0000-000000000003', 'Wrap Size & Bread', 'Jumbo - Rumali Roti', 60.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000401', 'd0000000-0000-0000-0000-000000000004', 'Wrap Size & Bread', 'Regular - Rumali Roti', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000402', 'd0000000-0000-0000-0000-000000000004', 'Wrap Size & Bread', 'Jumbo (Double Meat) - Rumali', 70.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000403', 'd0000000-0000-0000-0000-000000000004', 'Wrap Size & Bread', 'Regular - Kubbos Pocket', 10.00, false, true, 3),
    ('e0000000-0000-0000-0000-000000000501', 'd0000000-0000-0000-0000-000000000005', 'Wrap Size & Bread', 'Regular - Rumali Roti', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000502', 'd0000000-0000-0000-0000-000000000005', 'Wrap Size & Bread', 'Jumbo (Double Meat) - Rumali', 70.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000601', 'd0000000-0000-0000-0000-000000000006', 'Wrap Size & Bread', 'Regular - Rumali Roti', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000602', 'd0000000-0000-0000-0000-000000000006', 'Wrap Size & Bread', 'Jumbo - Rumali Roti', 70.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000701', 'd0000000-0000-0000-0000-000000000007', 'Portion Size', 'Standard (4 Cuts)', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000702', 'd0000000-0000-0000-0000-000000000007', 'Portion Size', 'Family Size (8 Cuts)', 120.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000801', 'd0000000-0000-0000-0000-000000000008', 'Portion Size', 'Standard (4 Cuts)', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000802', 'd0000000-0000-0000-0000-000000000008', 'Portion Size', 'Family Size (8 Cuts)', 140.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000000901', 'd0000000-0000-0000-0000-000000000009', 'Portion Size', 'Standard (4 Cuts)', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000000902', 'd0000000-0000-0000-0000-000000000009', 'Portion Size', 'Family Size (8 Cuts)', 130.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000001001', 'd0000000-0000-0000-0000-000000000010', 'Serving Size', '4 Crispy Strips', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000001002', 'd0000000-0000-0000-0000-000000000010', 'Serving Size', '8 Crispy Strips', 160.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000001101', 'd0000000-0000-0000-0000-000000000011', 'Skewer Count', '4 Char-Grilled Skewers', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000001102', 'd0000000-0000-0000-0000-000000000011', 'Skewer Count', '8 Char-Grilled Skewers', 180.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000001201', 'd0000000-0000-0000-0000-000000000012', 'Box Size', 'Regular Box (150g)', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000001202', 'd0000000-0000-0000-0000-000000000012', 'Box Size', 'Jumbo Bucket (300g)', 140.00, false, true, 2),
    ('e0000000-0000-0000-0000-000000001301', 'd0000000-0000-0000-0000-000000000013', 'Wing Count', '6 BBQ Wings', 0.00, true, true, 1),
    ('e0000000-0000-0000-0000-000000001302', 'd0000000-0000-0000-0000-000000000013', 'Wing Count', '12 BBQ Wings', 190.00, false, true, 2)
ON CONFLICT (id) DO NOTHING;

-- 6.6 Menu Item Add-ons
INSERT INTO public.menu_item_addons (id, menu_item_id, category_id, name, price, is_veg, is_available, display_order) VALUES
    ('a0000000-0000-0000-0000-000000000101', 'd0000000-0000-0000-0000-000000000001', NULL, 'Extra Garlic Toum', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000102', 'd0000000-0000-0000-0000-000000000001', NULL, 'Spicy Jalapeños', 20.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000103', 'd0000000-0000-0000-0000-000000000001', NULL, 'Melted Mozzarella Cheese', 40.00, true, true, 3),
    ('a0000000-0000-0000-0000-000000000201', 'd0000000-0000-0000-0000-000000000002', NULL, 'Extra Garlic Toum', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000202', 'd0000000-0000-0000-0000-000000000002', NULL, 'Extra Pickled Turnips', 20.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000301', 'd0000000-0000-0000-0000-000000000003', NULL, 'Extra Melted Cheese', 40.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000302', 'd0000000-0000-0000-0000-000000000003', NULL, 'Extra Garlic Toum', 30.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000401', 'd0000000-0000-0000-0000-000000000004', NULL, 'Extra Garlic Toum', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000402', 'd0000000-0000-0000-0000-000000000004', NULL, 'French Fries Inside', 30.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000403', 'd0000000-0000-0000-0000-000000000004', NULL, 'Spicy Jalapeños', 20.00, true, true, 3),
    ('a0000000-0000-0000-0000-000000000501', 'd0000000-0000-0000-0000-000000000005', NULL, 'Extra Garlic Toum', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000502', 'd0000000-0000-0000-0000-000000000005', NULL, 'Melted Mozzarella Cheese', 40.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000601', 'd0000000-0000-0000-0000-000000000006', NULL, 'Double Cheese Infusion', 50.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000602', 'd0000000-0000-0000-0000-000000000006', NULL, 'Extra Garlic Toum', 30.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000701', 'd0000000-0000-0000-0000-000000000007', NULL, 'Extra Arabian Curry Dip', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000702', 'd0000000-0000-0000-0000-000000000007', NULL, 'Garlic Toum Dip', 30.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000801', 'd0000000-0000-0000-0000-000000000008', NULL, 'Extra Melted Cheese Layer', 40.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000802', 'd0000000-0000-0000-0000-000000000008', NULL, 'Extra Arabian Curry Dip', 30.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000000901', 'd0000000-0000-0000-0000-000000000009', NULL, 'Extra Curry Dip', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000000902', 'd0000000-0000-0000-0000-000000000009', NULL, 'Garlic Toum Dip', 30.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000001001', 'd0000000-0000-0000-0000-000000000010', NULL, 'Extra Garlic Toum', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000001002', 'd0000000-0000-0000-0000-000000000010', NULL, 'Peri-Peri Mayo Dip', 25.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000001101', 'd0000000-0000-0000-0000-000000000011', NULL, 'Mint Chutney Dip', 20.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000001102', 'd0000000-0000-0000-0000-000000000011', NULL, 'Extra Garlic Toum', 30.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000001201', 'd0000000-0000-0000-0000-000000000012', NULL, 'Extra Garlic Toum', 30.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000001202', 'd0000000-0000-0000-0000-000000000012', NULL, 'Spicy Peri-Peri Sprinkles', 20.00, true, true, 2),
    ('a0000000-0000-0000-0000-000000001301', 'd0000000-0000-0000-0000-000000000013', NULL, 'Extra Smoky BBQ Sauce', 25.00, true, true, 1),
    ('a0000000-0000-0000-0000-000000001302', 'd0000000-0000-0000-0000-000000000013', NULL, 'Extra Garlic Toum', 30.00, true, true, 2)
ON CONFLICT (id) DO NOTHING;

COMMIT;
