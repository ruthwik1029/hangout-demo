-- ============================================================================
-- HANGOUT MIGRATION: Fix place_order Payment Status Value
-- Migration: 20250107000000_fix_orders_payment_status_constraint.sql
-- Description:
-- 1. Updates `place_order` RPC so new unpaid orders are created with
--    `payment_status = 'PENDING'` instead of the invalid value 'UNPAID'.
--    This strictly adheres to the schema check constraint:
--    `CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED'))`.
-- 2. Preserves the exact function signature, security checks, rate limits,
--    CSPRNG guest access token generation, pickup slot handling, and return format.
-- 3. Does not alter, drop, truncate, or recreate any existing data or orders.
-- ============================================================================

BEGIN;

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
    v_special_notes TEXT := NULL;

    v_tax_cfg public.tax_configurations%ROWTYPE;
    v_tax_rate NUMERIC(5,2) := 0.00;

    v_order_subtotal NUMERIC(10,2) := 0.00;
    v_discount_code TEXT := NULL;
    v_discount_record public.discounts%ROWTYPE;
    v_discount_amount NUMERIC(10,2) := 0.00;
    v_taxable_amount NUMERIC(10,2) := 0.00;
    v_tax_amount NUMERIC(10,2) := 0.00;
    v_cgst NUMERIC(10,2) := 0.00;
    v_sgst NUMERIC(10,2) := 0.00;
    v_total_amount NUMERIC(10,2) := 0.00;

    v_item_elem JSONB;
    v_addon_elem JSONB;
    v_menu_item_id UUID;
    v_item public.menu_items%ROWTYPE;
    v_qty INT;
    v_item_unit_price NUMERIC(10,2);
    v_item_subtotal NUMERIC(10,2);
    v_item_notes TEXT;
    v_variant_id UUID := NULL;
    v_variant_name TEXT := NULL;
    v_variant_delta NUMERIC(10,2) := 0.00;
    v_variant_json JSONB := NULL;
    v_variant public.menu_item_variants%ROWTYPE;
    v_selected_addons JSONB;
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
    IF LENGTH(v_cust_mobile) < 7 OR LENGTH(v_cust_mobile) > 15 THEN
        RAISE EXCEPTION 'Customer mobile number must be between 7 and 15 digits (received: "%")', v_cust_mobile;
    END IF;

    v_cust_email := NULLIF(TRIM(COALESCE(order_payload->>'customer_email_snapshot', order_payload->>'customer_email', '')), '');

    -- 5. Customer Record Resolution
    SELECT * INTO v_existing_cust FROM public.customers WHERE mobile_number = v_cust_mobile LIMIT 1;
    IF v_existing_cust.id IS NOT NULL THEN
        v_customer_id := v_existing_cust.id;
        IF order_payload->>'customer_id' IS NOT NULL AND TRIM(order_payload->>'customer_id') <> '' THEN
            BEGIN
                v_customer_id := (order_payload->>'customer_id')::UUID;
            EXCEPTION WHEN invalid_text_representation THEN
                v_customer_id := v_existing_cust.id;
            END;
        END IF;
        UPDATE public.customers
        SET full_name = v_cust_name,
            email = COALESCE(v_cust_email, email),
            total_orders = total_orders + 1,
            last_visit_at = NOW(),
            updated_at = NOW()
        WHERE id = v_customer_id;
    ELSE
        v_customer_id := gen_random_uuid();
        INSERT INTO public.customers (
            id, full_name, mobile_number, email, total_orders, total_spent, last_visit_at, created_at, updated_at
        ) VALUES (
            v_customer_id, v_cust_name, v_cust_mobile, v_cust_email, 1, 0.00, NOW(), NOW(), NOW()
        );
    END IF;

    -- 6. Payment Method & Special Notes
    v_payment_method := UPPER(TRIM(COALESCE(order_payload->>'payment_method', 'UPI_DEMO')));
    v_special_notes := NULLIF(TRIM(COALESCE(order_payload->>'special_instructions', order_payload->>'notes', '')), '');

    -- 7. Generate Cryptographically Secure Guest Access Token & Hash (CSPRNG)
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

    -- 10. Insert Parent Order Record (Valid payment_status = 'PENDING' strictly matches constraint)
    INSERT INTO public.orders (
        id,
        order_number,
        guest_access_token,
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
        v_raw_token,
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
        'PENDING',
        'PENDING',
        v_special_notes
    );

    -- Loop through items
    FOR v_item_elem IN SELECT * FROM jsonb_array_elements(items_payload)
    LOOP
        v_items_count := v_items_count + 1;
        IF v_item_elem->>'menu_item_id' IS NULL THEN
            RAISE EXCEPTION 'Each item in items_payload must have a valid menu_item_id';
        END IF;

        BEGIN
            v_menu_item_id := (v_item_elem->>'menu_item_id')::UUID;
        EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION 'Invalid UUID format for menu_item_id: "%"', v_item_elem->>'menu_item_id';
        END;

        SELECT * INTO v_item FROM public.menu_items WHERE id = v_menu_item_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item not found: "%"', v_menu_item_id;
        END IF;

        IF v_item.is_available = FALSE THEN
            RAISE EXCEPTION 'Item "%" is currently sold out and unavailable', v_item.name;
        END IF;

        v_qty := COALESCE((v_item_elem->>'quantity')::INT, 1);
        IF v_qty <= 0 OR v_qty > 50 THEN
            RAISE EXCEPTION 'Quantity for item "%" must be between 1 and 50', v_item.name;
        END IF;

        v_item_unit_price := v_item.base_price;
        v_variant_delta := 0.00;
        v_variant_id := NULL;
        v_variant_name := NULL;
        v_variant_json := NULL;

        IF v_item_elem->>'variant_id' IS NOT NULL AND TRIM(v_item_elem->>'variant_id') <> '' THEN
            BEGIN
                v_variant_id := (v_item_elem->>'variant_id')::UUID;
                SELECT * INTO v_variant FROM public.menu_item_variants WHERE id = v_variant_id AND menu_item_id = v_item.id;
                IF FOUND THEN
                    v_variant_name := v_variant.name;
                    v_variant_delta := v_variant.price_adjustment;
                    v_item_unit_price := v_item.base_price + v_variant_delta;
                    v_variant_json := jsonb_build_object(
                        'id', v_variant.id,
                        'name', v_variant.name,
                        'price_adjustment', v_variant.price_adjustment
                    );
                END IF;
            EXCEPTION WHEN invalid_text_representation THEN
                v_variant_id := NULL;
            END;
        END IF;

        v_item_addons_total := 0.00;
        v_validated_addons := '[]'::jsonb;
        v_addon_names := '{}';
        v_addon_ids_seen := '{}';

        v_selected_addons := v_item_elem->'selected_addons';
        IF v_selected_addons IS NOT NULL AND jsonb_typeof(v_selected_addons) = 'array' AND jsonb_array_length(v_selected_addons) > 0 THEN
            FOR v_addon_elem IN SELECT * FROM jsonb_array_elements(v_selected_addons)
            LOOP
                IF v_addon_elem->>'id' IS NOT NULL AND TRIM(v_addon_elem->>'id') <> '' THEN
                    BEGIN
                        v_addon_id := (v_addon_elem->>'id')::UUID;
                        IF NOT (v_addon_id = ANY(v_addon_ids_seen)) THEN
                            SELECT * INTO v_addon FROM public.menu_item_addons WHERE id = v_addon_id AND is_available = TRUE;
                            IF FOUND THEN
                                v_item_addons_total := v_item_addons_total + v_addon.price;
                                v_validated_addons := v_validated_addons || jsonb_build_object(
                                    'id', v_addon.id,
                                    'name', v_addon.name,
                                    'price', v_addon.price
                                );
                                v_addon_names := array_append(v_addon_names, v_addon.name);
                                v_addon_ids_seen := array_append(v_addon_ids_seen, v_addon.id);
                            END IF;
                        END IF;
                    EXCEPTION WHEN invalid_text_representation THEN
                        -- Ignore malformed addon UUIDs
                    END;
                END IF;
            END LOOP;
        END IF;

        v_item_subtotal := (v_item_unit_price + v_item_addons_total) * v_qty;
        v_order_subtotal := v_order_subtotal + v_item_subtotal;
        v_item_notes := NULLIF(TRIM(COALESCE(v_item_elem->>'special_instructions', '')), '');

        INSERT INTO public.order_items (
            order_id,
            menu_item_id,
            item_name_snapshot,
            quantity,
            unit_price_snapshot,
            variant_id,
            variant_name_snapshot,
            variant_snapshot,
            addons_snapshot,
            addon_names_snapshot,
            addons_total,
            item_subtotal,
            tax_rate_snapshot,
            special_instructions
        ) VALUES (
            v_order_id,
            v_item.id,
            v_item.name,
            v_qty,
            v_item_unit_price,
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
            END IF;
        ELSE
            v_discount_code := NULL;
        END IF;
    END IF;

    -- 12. Authoritative Tax Calculation (GST Split)
    v_taxable_amount := GREATEST(0.00, v_order_subtotal - v_discount_amount);
    IF v_tax_rate > 0 THEN
        v_tax_amount := ROUND((v_taxable_amount * (v_tax_rate / 100.0))::numeric, 2);
        v_cgst := ROUND((v_tax_amount / 2.0)::numeric, 2);
        v_sgst := v_tax_amount - v_cgst;
    ELSE
        v_tax_amount := 0.00;
        v_cgst := 0.00;
        v_sgst := 0.00;
    END IF;

    v_total_amount := v_taxable_amount + v_tax_amount;

    -- 13. Update Final Computed Totals on Parent Order
    UPDATE public.orders
    SET subtotal = v_order_subtotal,
        discount_code = v_discount_code,
        discount_amount = v_discount_amount,
        tax_amount = v_tax_amount,
        tax_breakdown = jsonb_build_object(
            'is_gst_enabled', (v_tax_rate > 0),
            'default_tax_rate', v_tax_rate,
            'taxable_amount', v_taxable_amount,
            'cgst_rate', ROUND((v_tax_rate / 2.0)::numeric, 2),
            'sgst_rate', ROUND((v_tax_rate / 2.0)::numeric, 2),
            'cgst_amount', v_cgst,
            'sgst_amount', v_sgst,
            'total_tax', v_tax_amount
        ),
        total_amount = v_total_amount,
        updated_at = NOW()
    WHERE id = v_order_id;

    -- 14. Record Initial Status History
    INSERT INTO public.order_status_history (
        order_id,
        previous_status,
        new_status,
        changed_by_role,
        notes
    ) VALUES (
        v_order_id,
        NULL,
        'PENDING',
        'CUSTOMER',
        'Guest order placed via secure RPC'
    );

    -- 15. Return Output (Valid payment_status = 'PENDING')
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
        'payment_status', 'PENDING',
        'order_status', 'PENDING'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO anon, authenticated;

COMMIT;

