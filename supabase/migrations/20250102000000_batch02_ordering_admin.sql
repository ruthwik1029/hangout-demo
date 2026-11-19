-- HANGOUT Modern Cafe Digital Platform
-- Batch 02: Ordering Engine, Order Management, Payments, GST & Tax Architecture, and Admin Controls
-- Compatible with PostgreSQL 15+ / Supabase
-- Hardened for Server-Authoritative Totals, Concurrency Row-Locks, and Token Isolation

-- ============================================================================
-- 1. ORDER SEQUENCE & NUMBER GENERATION
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.hangout_order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
    year_str TEXT;
BEGIN
    seq_val := nextval('public.hangout_order_number_seq');
    year_str := to_char(CURRENT_DATE, 'YYYY');
    RETURN 'HG-' || year_str || '-' || LPAD(seq_val::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS public.hangout_txn_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_demo_transaction_ref()
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
    random_hex TEXT;
BEGIN
    seq_val := nextval('public.hangout_txn_seq');
    random_hex := encode(gen_random_bytes(4), 'hex');
    RETURN 'TXN-DEMO-' || to_char(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(seq_val::TEXT, 6, '0') || '-' || random_hex;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TAX CONFIGURATIONS & TAX CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_gst_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    igst_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    gst_number TEXT,
    legal_business_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tax_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    rate NUMERIC(5,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. DISCOUNTS & PROMOTIONAL CODES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FLAT')),
    discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10,2) DEFAULT 0.00,
    max_discount_amount NUMERIC(10,2),
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. ORDERS TABLE WITH SECURE GUEST ACCESS TOKEN HASH
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL DEFAULT public.generate_order_number(),
    guest_access_token_hash TEXT UNIQUE NOT NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name_snapshot TEXT NOT NULL,
    customer_mobile_snapshot TEXT NOT NULL,
    customer_email_snapshot TEXT,
    order_type TEXT NOT NULL CHECK (order_type IN ('DINING', 'TAKEAWAY')),
    table_id UUID REFERENCES public.cafe_tables(id) ON DELETE SET NULL,
    table_number_snapshot TEXT,
    pickup_time_slot TEXT,
    pickup_notes TEXT,
    subtotal NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    discount_code TEXT,
    tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    tax_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED')),
    payment_method TEXT,
    order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (order_status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'PREPARING', 'READY_FOR_PICKUP', 'SERVED', 'COMPLETED', 'CANCELLED')),
    rejection_reason TEXT,
    cancellation_reason TEXT,
    estimated_prep_time_mins INT DEFAULT 15,
    special_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'guest_access_token_hash'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN guest_access_token_hash TEXT UNIQUE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'rejection_reason'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN rejection_reason TEXT;
    END IF;
    -- Drop obsolete plaintext token column if it was ever present
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'guest_access_token'
    ) THEN
        ALTER TABLE public.orders DROP COLUMN guest_access_token;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_token_hash ON public.orders (guest_access_token_hash);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_table ON public.orders (table_id);
CREATE INDEX IF NOT EXISTS idx_orders_type ON public.orders (order_type);

-- ============================================================================
-- 5. ORDER ITEMS WITH TAX SNAPSHOT
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name_snapshot TEXT NOT NULL,
    variant_id UUID REFERENCES public.menu_item_variants(id) ON DELETE SET NULL,
    variant_name_snapshot TEXT,
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    selected_addons JSONB DEFAULT '[]'::jsonb,
    addons_total NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (addons_total >= 0),
    item_subtotal NUMERIC(10,2) NOT NULL CHECK (item_subtotal >= 0),
    tax_rate_snapshot NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    special_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item ON public.order_items (menu_item_id);

-- ============================================================================
-- 6. PAYMENTS & TRANSACTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'UPI_DEMO', 'CARD_DEMO', 'RAZORPAY_DEMO', 'STRIPE_DEMO', 'SPLIT')),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED')),
    transaction_reference TEXT UNIQUE,
    gateway_response JSONB DEFAULT '{}'::jsonb,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (payment_status);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL,
    transaction_ref TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL,
    raw_payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pay_txn_payment ON public.payment_transactions (payment_id);

-- ============================================================================
-- 7. ORDER STATUS HISTORY AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_hist_order ON public.order_status_history (order_id);
CREATE INDEX IF NOT EXISTS idx_status_hist_created ON public.order_status_history (created_at DESC);

-- ============================================================================
-- 8. ADMIN AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_entity ON public.admin_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs (created_at DESC);

-- ============================================================================
-- 9. PICKUP SETTINGS & ONLINE ORDERING CONTROLS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pickup_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_online_ordering_paused BOOLEAN NOT NULL DEFAULT FALSE,
    pause_reason TEXT,
    is_asap_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    asap_estimated_minutes INT NOT NULL DEFAULT 15,
    slot_interval_minutes INT NOT NULL DEFAULT 15,
    advance_order_hours_limit INT NOT NULL DEFAULT 12,
    minimum_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    pickup_policy_notice TEXT NOT NULL DEFAULT 'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 10. SERVER-AUTHORITATIVE PRICE, ITEM & TOTAL VALIDATION TRIGGERS
-- ============================================================================
-- 10.1 Order Item Validation: Validates item existence, availability, and authoritative pricing (BLOCKER 3)
CREATE OR REPLACE FUNCTION public.validate_order_item_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
    v_variant RECORD;
    v_expected_unit_price NUMERIC(10,2);
    v_expected_addons_total NUMERIC(10,2) := 0.00;
    v_expected_tax_rate NUMERIC(5,2);
    v_tax_cfg RECORD;
    v_selected_addons JSONB;
    v_addon_elem JSONB;
    v_addon_id UUID;
    v_addon RECORD;
    v_addon_ids_seen UUID[] := '{}';
BEGIN
    -- 1. Validate menu item exists and is active/available
    SELECT * INTO v_item FROM public.menu_items WHERE id = NEW.menu_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Menu item with ID % does not exist', NEW.menu_item_id;
    END IF;

    IF v_item.is_available = FALSE THEN
        RAISE EXCEPTION 'Menu item "%" is currently marked as unavailable', v_item.name;
    END IF;

    IF NEW.item_name_snapshot IS NULL OR NEW.item_name_snapshot = '' THEN
        NEW.item_name_snapshot := v_item.name;
    END IF;

    -- 2. Quantity Limit Enforcement (1 to 100)
    IF NEW.quantity <= 0 OR NEW.quantity > 100 THEN
        RAISE EXCEPTION 'Order item quantity must be between 1 and 100';
    END IF;

    -- 3. Calculate expected price from base price + variant delta
    v_expected_unit_price := v_item.base_price;
    IF NEW.variant_id IS NOT NULL THEN
        SELECT * INTO v_variant FROM public.menu_item_variants WHERE id = NEW.variant_id AND menu_item_id = NEW.menu_item_id;
        IF FOUND THEN
            v_expected_unit_price := v_expected_unit_price + v_variant.price_delta;
            IF NEW.variant_name_snapshot IS NULL THEN
                NEW.variant_name_snapshot := v_variant.name;
            END IF;
        ELSE
            RAISE EXCEPTION 'Variant ID % does not belong to menu item %', NEW.variant_id, NEW.menu_item_id;
        END IF;
    END IF;

    -- 4. Server-Authoritative Add-on Verification (BLOCKER 3)
    -- Never trust client-submitted addons_total. Re-query menu_item_addons,
    -- verify ownership, check availability, prevent duplicates, and sum server-side.
    v_selected_addons := COALESCE(NEW.selected_addons, '[]'::jsonb);
    IF jsonb_typeof(v_selected_addons) = 'array' AND jsonb_array_length(v_selected_addons) > 0 THEN
        FOR v_addon_elem IN SELECT * FROM jsonb_array_elements(v_selected_addons)
        LOOP
            IF jsonb_typeof(v_addon_elem) = 'string' THEN
                v_addon_id := (v_addon_elem #>> '{}')::UUID;
            ELSIF jsonb_typeof(v_addon_elem) = 'object' AND v_addon_elem ? 'id' THEN
                v_addon_id := (v_addon_elem->>'id')::UUID;
            ELSIF jsonb_typeof(v_addon_elem) = 'object' AND v_addon_elem ? 'addon_id' THEN
                v_addon_id := (v_addon_elem->>'addon_id')::UUID;
            ELSE
                SELECT id INTO v_addon_id
                FROM public.menu_item_addons
                WHERE (menu_item_id = NEW.menu_item_id OR category_id = v_item.category_id)
                  AND name = v_addon_elem->>'name'
                LIMIT 1;
            END IF;

            IF v_addon_id IS NULL THEN
                RAISE EXCEPTION 'Invalid add-on specification for item %', v_item.name;
            END IF;

            IF v_addon_id = ANY(v_addon_ids_seen) THEN
                RAISE EXCEPTION 'Duplicate add-on selection prohibited: %', v_addon_id;
            END IF;

            SELECT * INTO v_addon
            FROM public.menu_item_addons
            WHERE id = v_addon_id
              AND (menu_item_id = NEW.menu_item_id OR category_id = v_item.category_id);

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Add-on % does not belong to menu item % or its category', v_addon_id, NEW.menu_item_id;
            END IF;

            IF v_addon.is_available = FALSE THEN
                RAISE EXCEPTION 'Add-on "%" is currently marked as unavailable', v_addon.name;
            END IF;

            v_expected_addons_total := v_expected_addons_total + v_addon.price;
            v_addon_ids_seen := array_append(v_addon_ids_seen, v_addon_id);
        END LOOP;
    END IF;

    -- Enforce authoritative database prices over client-submitted values
    NEW.unit_price := v_expected_unit_price;
    NEW.addons_total := v_expected_addons_total;
    NEW.item_subtotal := (NEW.unit_price * NEW.quantity) + NEW.addons_total;

    -- Snapshot tax rate from active tax configuration
    SELECT * INTO v_tax_cfg FROM public.tax_configurations ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_tax_cfg.is_gst_enabled = TRUE THEN
        v_expected_tax_rate := v_tax_cfg.default_tax_rate;
    ELSE
        v_expected_tax_rate := 0.00;
    END IF;

    NEW.tax_rate_snapshot := v_expected_tax_rate;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_order_item ON public.order_items;
CREATE TRIGGER trg_validate_order_item
    BEFORE INSERT OR UPDATE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_before_insert();

-- 10.2 Order Totals Validation: Validates arithmetic integrity and non-negativity
CREATE OR REPLACE FUNCTION public.validate_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.guest_access_token_hash IS NULL OR NEW.guest_access_token_hash = '' THEN
        NEW.guest_access_token_hash := encode(sha256(encode(gen_random_bytes(32), 'hex')::bytea), 'hex');
    END IF;

    IF NEW.subtotal < 0 THEN
        RAISE EXCEPTION 'Order subtotal cannot be negative';
    END IF;
    IF NEW.discount_amount < 0 THEN
        RAISE EXCEPTION 'Order discount cannot be negative';
    END IF;
    IF NEW.tax_amount < 0 THEN
        RAISE EXCEPTION 'Order tax cannot be negative';
    END IF;
    IF NEW.total_amount < 0 THEN
        RAISE EXCEPTION 'Order total cannot be negative';
    END IF;

    IF ABS(NEW.total_amount - (NEW.subtotal - NEW.discount_amount + NEW.tax_amount)) > 0.05 THEN
        RAISE EXCEPTION 'Order total amount mismatch: expected subtotal (%) - discount (%) + tax (%) = % but got %',
            NEW.subtotal, NEW.discount_amount, NEW.tax_amount,
            (NEW.subtotal - NEW.discount_amount + NEW.tax_amount), NEW.total_amount;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

DROP TRIGGER IF EXISTS trg_validate_order_totals ON public.orders;
CREATE TRIGGER trg_validate_order_totals
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.validate_order_totals();

-- ============================================================================
-- 11. HARDENED PAYMENT, TRACKING & ORDER CREATION RPCS
-- ============================================================================

-- 11.1 Hardened Demo Payment Confirmation RPC (Concurrency-Locked & Hash-Authorized)
CREATE OR REPLACE FUNCTION public.confirm_demo_payment(
    p_order_id UUID,
    p_payment_method TEXT,
    p_guest_access_token TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_payment RECORD;
    v_txn_ref TEXT;
    v_settle_amount NUMERIC(10,2);
    v_token_hash TEXT;
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    -- 1. Whitelist supported simulated demo payment methods
    IF p_payment_method NOT IN ('UPI_DEMO', 'CARD_DEMO', 'CASH', 'RAZORPAY_DEMO', 'STRIPE_DEMO') THEN
        RAISE EXCEPTION 'Invalid payment method: %. Only supported simulated demo payment methods are allowed.', p_payment_method;
    END IF;

    -- 2. Concurrency Lock: Lock order row exclusively FOR UPDATE to prevent race conditions
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order with ID % not found', p_order_id;
    END IF;

    -- 3. Security check: Caller must be staff OR provide matching guest_access_token
    IF public.is_staff() THEN
        v_is_authorized := TRUE;
    ELSIF p_guest_access_token IS NOT NULL AND TRIM(p_guest_access_token) <> '' THEN
        v_token_hash := encode(sha256(p_guest_access_token::bytea), 'hex');
        IF v_order.guest_access_token_hash = v_token_hash THEN
            v_is_authorized := TRUE;
        END IF;
    END IF;

    IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Unauthorized payment confirmation attempt: Invalid credentials';
    END IF;

    -- 4. State validation: Reject already paid, cancelled, or rejected orders
    IF v_order.payment_status = 'PAID' THEN
        RAISE EXCEPTION 'Order % is already settled and marked as PAID', v_order.order_number;
    END IF;

    IF v_order.order_status IN ('CANCELLED', 'REJECTED') THEN
        RAISE EXCEPTION 'Cannot settle payment for order in % status', v_order.order_status;
    END IF;

    -- 5. Prevent duplicate transactions / concurrent duplicate settlement
    IF EXISTS (
        SELECT 1 FROM public.payments
        WHERE order_id = p_order_id AND payment_status = 'PAID'
    ) THEN
        RAISE EXCEPTION 'A completed payment already exists for order %', v_order.order_number;
    END IF;

    -- 6. Validate settlement amount against order total (Strict ₹0.01 tolerance, authoritative total)
    v_settle_amount := v_order.total_amount;
    IF p_amount IS NOT NULL AND (p_amount <= 0 OR ABS(p_amount - v_order.total_amount) > 0.01) THEN
        RAISE EXCEPTION 'Payment amount mismatch: expected % but received %', v_order.total_amount, p_amount;
    END IF;

    -- 7. Generate unique simulated transaction reference
    v_txn_ref := public.generate_demo_transaction_ref();

    -- 8. Create or update payment record
    SELECT * INTO v_payment
    FROM public.payments
    WHERE order_id = p_order_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND THEN
        UPDATE public.payments
        SET payment_status = 'PAID',
            payment_method = p_payment_method,
            amount = v_settle_amount,
            transaction_reference = v_txn_ref,
            gateway_response = jsonb_build_object(
                'simulation', true,
                'mode', 'DEMO_SANDBOX',
                'method', p_payment_method,
                'settled_at', NOW()
            ),
            paid_at = NOW(),
            updated_at = NOW()
        WHERE id = v_payment.id;
    ELSE
        INSERT INTO public.payments (
            order_id,
            amount,
            payment_method,
            payment_status,
            transaction_reference,
            gateway_response,
            paid_at
        ) VALUES (
            p_order_id,
            v_settle_amount,
            p_payment_method,
            'PAID',
            v_txn_ref,
            jsonb_build_object(
                'simulation', true,
                'mode', 'DEMO_SANDBOX',
                'method', p_payment_method,
                'settled_at', NOW()
            ),
            NOW()
        );
    END IF;

    -- 9. Update order payment status (Separate from order operational status)
    UPDATE public.orders
    SET payment_status = 'PAID',
        payment_method = p_payment_method,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 10. Immutable status history log
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by, notes)
    VALUES (
        p_order_id,
        v_order.order_status,
        v_order.order_status,
        CASE WHEN public.is_staff() THEN 'STAFF' ELSE 'CUSTOMER' END,
        'Demo payment confirmed via ' || p_payment_method || ' (' || v_txn_ref || ')'
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'order_number', v_order.order_number,
        'payment_status', 'PAID',
        'payment_method', p_payment_method,
        'amount', v_settle_amount,
        'transaction_reference', v_txn_ref,
        'is_demo', true,
        'settled_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.confirm_demo_payment(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_demo_payment(UUID, TEXT, TEXT, NUMERIC) TO anon, authenticated;

-- 11.2 Hardened Order Lookup Helper RPC (Hash-Authorized, No Token Leakage)
CREATE OR REPLACE FUNCTION public.get_order_by_access_token(
    p_order_id UUID,
    p_access_token TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_token_hash TEXT;
    v_order RECORD;
    v_items JSONB;
BEGIN
    IF p_order_id IS NULL OR p_access_token IS NULL OR TRIM(p_access_token) = '' THEN
        RETURN NULL;
    END IF;

    v_token_hash := encode(sha256(p_access_token::bytea), 'hex');

    -- Select sanitized order columns (excluding secret hash and internal fields)
    SELECT
        id,
        order_number,
        order_type,
        table_id,
        table_number_snapshot,
        pickup_time_slot,
        pickup_notes,
        customer_name_snapshot,
        customer_mobile_snapshot,
        subtotal,
        discount_amount,
        discount_code,
        tax_amount,
        tax_breakdown,
        total_amount,
        payment_method,
        payment_status,
        order_status,
        rejection_reason,
        cancellation_reason,
        special_instructions,
        estimated_prep_time_mins,
        created_at,
        updated_at
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
      AND guest_access_token_hash = v_token_hash;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Fetch order items
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'menu_item_id', oi.menu_item_id,
            'item_name_snapshot', oi.item_name_snapshot,
            'is_veg', oi.is_veg,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'variant_name_snapshot', oi.variant_name_snapshot,
            'variant_snapshot', oi.variant_snapshot,
            'selected_addons', oi.selected_addons,
            'addon_names_snapshot', oi.addon_names_snapshot,
            'addons_total', oi.addons_total,
            'item_subtotal', oi.item_subtotal,
            'special_instructions', oi.special_instructions,
            'created_at', oi.created_at
        )
    ) INTO v_items
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id;

    RETURN jsonb_build_object(
        'order', to_jsonb(v_order),
        'items', COALESCE(v_items, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.get_order_by_access_token(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_access_token(UUID, TEXT) TO anon, authenticated;

-- 11.3 Atomic Guest Order Creation RPC (BLOCKER 2 REMEDIATION)
-- Authoritatively validates order type, table context, contact snapshot, menu items,
-- availability, variants, add-on pricing, discounts, and taxes. Atomically inserts
-- order + items + initial status history and returns raw guest token once.
CREATE OR REPLACE FUNCTION public.place_order(
    order_payload JSONB,
    items_payload JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_order_id UUID := gen_random_uuid();
    v_order_number TEXT := public.generate_order_number();
    v_raw_token TEXT;
    v_token_hash TEXT;
    v_order_type TEXT;
    v_table_id UUID := NULL;
    v_table RECORD;
    v_table_number TEXT := NULL;
    v_pickup_slot TEXT := NULL;
    v_pickup_notes TEXT := NULL;
    v_cust_name TEXT;
    v_cust_mobile TEXT;
    v_cust_email TEXT := NULL;
    v_payment_method TEXT;
    v_special_notes TEXT := NULL;
    v_cafe_settings RECORD;
    v_tax_cfg RECORD;
    v_tax_rate NUMERIC(5,2) := 0.00;
    v_order_subtotal NUMERIC(10,2) := 0.00;
    v_discount_code TEXT := NULL;
    v_discount_record RECORD;
    v_discount_amount NUMERIC(10,2) := 0.00;
    v_taxable_amount NUMERIC(10,2) := 0.00;
    v_tax_amount NUMERIC(10,2) := 0.00;
    v_cgst NUMERIC(10,2) := 0.00;
    v_sgst NUMERIC(10,2) := 0.00;
    v_total_amount NUMERIC(10,2) := 0.00;

    -- Item iteration variables
    v_item_elem JSONB;
    v_menu_item_id UUID;
    v_item RECORD;
    v_qty INT;
    v_variant_id UUID := NULL;
    v_variant RECORD;
    v_variant_name TEXT := NULL;
    v_variant_delta NUMERIC(10,2) := 0.00;
    v_variant_json JSONB := NULL;
    v_selected_addons JSONB := '[]'::jsonb;
    v_validated_addons JSONB := '[]'::jsonb;
    v_addon_names TEXT[] := '{}';
    v_addon_ids_seen UUID[] := '{}';
    v_addon_elem JSONB;
    v_addon_id UUID;
    v_addon RECORD;
    v_item_addons_total NUMERIC(10,2) := 0.00;
    v_item_unit_price NUMERIC(10,2) := 0.00;
    v_item_subtotal NUMERIC(10,2) := 0.00;
    v_item_notes TEXT := NULL;
    v_items_count INT := 0;
BEGIN
    -- 1. Validate Order Type
    v_order_type := UPPER(TRIM(COALESCE(order_payload->>'order_type', '')));
    IF v_order_type NOT IN ('DINING', 'TAKEAWAY') THEN
        RAISE EXCEPTION 'Invalid order type: "%". Allowed types are DINING or TAKEAWAY', v_order_type;
    END IF;

    -- 2. Validate Cafe Operational Status for Selected Mode
    SELECT * INTO v_cafe_settings FROM public.cafe_settings ORDER BY created_at DESC LIMIT 1;
    IF FOUND THEN
        IF v_order_type = 'DINING' AND v_cafe_settings.is_dining_enabled = FALSE THEN
            RAISE EXCEPTION 'Dining orders are currently disabled by cafe management';
        END IF;
        IF v_order_type = 'TAKEAWAY' AND v_cafe_settings.is_takeaway_enabled = FALSE THEN
            RAISE EXCEPTION 'Takeaway orders are currently disabled by cafe management';
        END IF;
    END IF;

    -- 3. Table / Pickup Validation
    IF v_order_type = 'DINING' THEN
        IF order_payload->>'table_id' IS NULL OR TRIM(order_payload->>'table_id') = '' THEN
            RAISE EXCEPTION 'Table identification is required for dining orders';
        END IF;
        v_table_id := (order_payload->>'table_id')::UUID;
        SELECT * INTO v_table FROM public.cafe_tables WHERE id = v_table_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Table with ID % does not exist', v_table_id;
        END IF;
        IF v_table.is_active = FALSE THEN
            RAISE EXCEPTION 'Table % is currently inactive or out of service', v_table.table_number;
        END IF;
        v_table_number := v_table.table_number;
    ELSE
        -- TAKEAWAY: Pickup-only rules (strictly NO delivery, table must be NULL)
        IF order_payload->>'table_id' IS NOT NULL AND TRIM(order_payload->>'table_id') <> '' THEN
            RAISE EXCEPTION 'Table identification is not permitted for takeaway orders';
        END IF;
        v_pickup_slot := NULLIF(TRIM(COALESCE(order_payload->>'pickup_time_slot', order_payload->>'pickup_slot_snapshot', '')), '');
        IF v_pickup_slot IS NULL THEN
            RAISE EXCEPTION 'Pickup time slot is required for takeaway orders';
        END IF;
        v_pickup_notes := NULLIF(TRIM(COALESCE(order_payload->>'pickup_notes', '')), '');
    END IF;

    -- 4. Customer Contact Snapshot Validation
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

    -- 5. Payment Method & Special Notes
    v_payment_method := UPPER(TRIM(COALESCE(order_payload->>'payment_method', 'UPI_DEMO')));
    v_special_notes := NULLIF(TRIM(COALESCE(order_payload->>'special_instructions', order_payload->>'notes', '')), '');

    -- 6. Generate Cryptographically Secure 256-bit Guest Access Token & Hash
    v_raw_token := encode(gen_random_bytes(32), 'hex');
    v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');

    -- 7. Validate Items Payload Existence
    IF items_payload IS NULL OR jsonb_array_length(items_payload) = 0 THEN
        RAISE EXCEPTION 'Cannot place an empty order. At least one order item is required.';
    END IF;

    -- 8. Fetch Tax Configuration for Snapshot
    SELECT * INTO v_tax_cfg FROM public.tax_configurations ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_tax_cfg.is_gst_enabled = TRUE THEN
        v_tax_rate := v_tax_cfg.default_tax_rate;
    ELSE
        v_tax_rate := 0.00;
    END IF;

    -- 9. Insert Parent Order Record (Authoritative amounts updated after processing all items)
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
        NULL, -- Anonymous checkout does not link persistent customer profile
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
        v_menu_item_id := (v_item_elem->>'menu_item_id')::UUID;

        SELECT * INTO v_item FROM public.menu_items WHERE id = v_menu_item_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Menu item with ID % does not exist', v_menu_item_id;
        END IF;

        IF v_item.is_available = FALSE THEN
            RAISE EXCEPTION 'Menu item "%" is currently unavailable', v_item.name;
        END IF;

        -- Validate Quantity (1 to 100)
        v_qty := COALESCE((v_item_elem->>'quantity')::INT, 0);
        IF v_qty <= 0 OR v_qty > 100 THEN
            RAISE EXCEPTION 'Quantity for "%" must be between 1 and 100 (received: %)', v_item.name, v_qty;
        END IF;

        -- Authoritative Base Price
        v_item_unit_price := v_item.base_price;
        v_variant_id := NULL;
        v_variant_name := NULL;
        v_variant_delta := 0.00;
        v_variant_json := NULL;

        -- Validate Variant if specified
        IF v_item_elem->>'variant_id' IS NOT NULL AND TRIM(v_item_elem->>'variant_id') <> '' THEN
            v_variant_id := (v_item_elem->>'variant_id')::UUID;
            SELECT * INTO v_variant FROM public.menu_item_variants WHERE id = v_variant_id AND menu_item_id = v_menu_item_id;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Variant ID % does not belong to menu item "%"', v_variant_id, v_item.name;
            END IF;
            v_variant_name := v_variant.name;
            v_variant_delta := v_variant.price_delta;
            v_variant_json := jsonb_build_object('id', v_variant.id, 'name', v_variant.name, 'price_delta', v_variant.price_delta);
            v_item_unit_price := v_item_unit_price + v_variant_delta;
        END IF;

        -- Server-Authoritative Add-on Verification (BLOCKER 3)
        v_item_addons_total := 0.00;
        v_validated_addons := '[]'::jsonb;
        v_addon_names := '{}';
        v_addon_ids_seen := '{}';
        v_selected_addons := COALESCE(v_item_elem->'selected_addons', v_item_elem->'addons_snapshot', '[]'::jsonb);

        IF jsonb_typeof(v_selected_addons) = 'array' AND jsonb_array_length(v_selected_addons) > 0 THEN
            FOR v_addon_elem IN SELECT * FROM jsonb_array_elements(v_selected_addons)
            LOOP
                IF jsonb_typeof(v_addon_elem) = 'string' THEN
                    v_addon_id := (v_addon_elem #>> '{}')::UUID;
                ELSIF jsonb_typeof(v_addon_elem) = 'object' AND v_addon_elem ? 'id' THEN
                    v_addon_id := (v_addon_elem->>'id')::UUID;
                ELSIF jsonb_typeof(v_addon_elem) = 'object' AND v_addon_elem ? 'addon_id' THEN
                    v_addon_id := (v_addon_elem->>'addon_id')::UUID;
                ELSE
                    SELECT id INTO v_addon_id
                    FROM public.menu_item_addons
                    WHERE (menu_item_id = v_menu_item_id OR category_id = v_item.category_id)
                      AND name = v_addon_elem->>'name'
                    LIMIT 1;
                END IF;

                IF v_addon_id IS NULL THEN
                    RAISE EXCEPTION 'Invalid add-on specification for item "%"', v_item.name;
                END IF;

                IF v_addon_id = ANY(v_addon_ids_seen) THEN
                    RAISE EXCEPTION 'Duplicate add-on selection prohibited for item "%"', v_item.name;
                END IF;

                SELECT * INTO v_addon
                FROM public.menu_item_addons
                WHERE id = v_addon_id
                  AND (menu_item_id = v_menu_item_id OR category_id = v_item.category_id);

                IF NOT FOUND THEN
                    RAISE EXCEPTION 'Add-on % does not belong to menu item "%"', v_addon_id, v_item.name;
                END IF;

                IF v_addon.is_available = FALSE THEN
                    RAISE EXCEPTION 'Add-on "%" is currently marked as unavailable', v_addon.name;
                END IF;

                v_item_addons_total := v_item_addons_total + v_addon.price;
                v_addon_ids_seen := array_append(v_addon_ids_seen, v_addon_id);
                v_addon_names := array_append(v_addon_names, v_addon.name);
                v_validated_addons := v_validated_addons || jsonb_build_object(
                    'id', v_addon.id,
                    'name', v_addon.name,
                    'price', v_addon.price,
                    'is_veg', v_addon.is_veg
                );
            END LOOP;
        END IF;

        -- Authoritative Item Subtotal
        v_item_subtotal := (v_item_unit_price * v_qty) + v_item_addons_total;
        v_order_subtotal := v_order_subtotal + v_item_subtotal;
        v_item_notes := NULLIF(TRIM(COALESCE(v_item_elem->>'special_instructions', '')), '');

        -- Insert Order Item
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

    -- 15. Return Identifier, Order Number, and Raw Token EXACTLY ONCE
    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'guest_access_token', v_raw_token,
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
-- 12. EXPLICIT POLICY PURGE & LEAST-PRIVILEGE GRANTS FOR BATCH 02
-- ============================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_settings ENABLE ROW LEVEL SECURITY;

-- 12.1 Explicitly Drop All Potential Old / Conflicting Policies
DROP POLICY IF EXISTS "Public create orders" ON public.orders;
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
DROP POLICY IF EXISTS "Operational update orders" ON public.orders;
DROP POLICY IF EXISTS "Orders select restricted" ON public.orders;
DROP POLICY IF EXISTS "Orders insert self or staff" ON public.orders;
DROP POLICY IF EXISTS "Orders staff update only" ON public.orders;

DROP POLICY IF EXISTS "Public create order items" ON public.order_items;
DROP POLICY IF EXISTS "Public read order items" ON public.order_items;
DROP POLICY IF EXISTS "Operational update order items" ON public.order_items;
DROP POLICY IF EXISTS "Order items select restricted" ON public.order_items;
DROP POLICY IF EXISTS "Order items insert self or staff" ON public.order_items;
DROP POLICY IF EXISTS "Order items staff update only" ON public.order_items;

DROP POLICY IF EXISTS "Public create payments" ON public.payments;
DROP POLICY IF EXISTS "Public read payments" ON public.payments;
DROP POLICY IF EXISTS "Operational update payments" ON public.payments;
DROP POLICY IF EXISTS "Payments select restricted" ON public.payments;
DROP POLICY IF EXISTS "Payments staff insert" ON public.payments;
DROP POLICY IF EXISTS "Payments staff update" ON public.payments;

DROP POLICY IF EXISTS "Public create payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Public read payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Payment transactions select restricted" ON public.payment_transactions;
DROP POLICY IF EXISTS "Payment transactions staff insert" ON public.payment_transactions;

DROP POLICY IF EXISTS "Status history public insert" ON public.order_status_history;
DROP POLICY IF EXISTS "Status history public select" ON public.order_status_history;
DROP POLICY IF EXISTS "Status history select restricted" ON public.order_status_history;
DROP POLICY IF EXISTS "Status history staff or system insert" ON public.order_status_history;

DROP POLICY IF EXISTS "Admin audit logs insert" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admin audit logs select" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admin audit logs view" ON public.admin_audit_logs;

DROP POLICY IF EXISTS "Anyone view tax configuration" ON public.tax_configurations;
DROP POLICY IF EXISTS "Admin manage tax configuration" ON public.tax_configurations;
DROP POLICY IF EXISTS "Tax config public select" ON public.tax_configurations;
DROP POLICY IF EXISTS "Tax config admin manage" ON public.tax_configurations;

DROP POLICY IF EXISTS "Anyone view tax categories" ON public.tax_categories;
DROP POLICY IF EXISTS "Admin manage tax categories" ON public.tax_categories;
DROP POLICY IF EXISTS "Tax categories public select" ON public.tax_categories;
DROP POLICY IF EXISTS "Tax categories admin manage" ON public.tax_categories;

DROP POLICY IF EXISTS "Anyone view active discounts" ON public.discounts;
DROP POLICY IF EXISTS "Admin manage discounts" ON public.discounts;
DROP POLICY IF EXISTS "Discounts public view active" ON public.discounts;
DROP POLICY IF EXISTS "Discounts admin manage" ON public.discounts;

DROP POLICY IF EXISTS "Anyone view pickup settings" ON public.pickup_settings;
DROP POLICY IF EXISTS "Admin manage pickup settings" ON public.pickup_settings;
DROP POLICY IF EXISTS "Pickup settings public select" ON public.pickup_settings;
DROP POLICY IF EXISTS "Pickup settings admin manage" ON public.pickup_settings;

-- 12.2 Revoke broad table privileges
REVOKE ALL ON public.orders FROM anon, authenticated;
REVOKE ALL ON public.order_items FROM anon, authenticated;
REVOKE ALL ON public.payments FROM anon, authenticated;
REVOKE ALL ON public.payment_transactions FROM anon, authenticated;
REVOKE ALL ON public.order_status_history FROM anon, authenticated;
REVOKE ALL ON public.tax_configurations FROM anon, authenticated;
REVOKE ALL ON public.tax_categories FROM anon, authenticated;
REVOKE ALL ON public.discounts FROM anon, authenticated;
REVOKE ALL ON public.pickup_settings FROM anon, authenticated;
REVOKE ALL ON public.admin_audit_logs FROM anon, authenticated;

-- 12.3 Explicit narrow table grants (Least-Privilege)
-- Anonymous users CANNOT directly insert into orders or order_items.
-- Orders MUST be created atomically via public.place_order RPC.
GRANT SELECT ON public.orders TO anon, authenticated;
GRANT ALL ON public.orders TO authenticated;

GRANT SELECT ON public.order_items TO anon, authenticated;
GRANT ALL ON public.order_items TO authenticated;

GRANT SELECT ON public.payments TO anon, authenticated;
GRANT ALL ON public.payments TO authenticated;

GRANT SELECT ON public.payment_transactions TO anon, authenticated;
GRANT ALL ON public.payment_transactions TO authenticated;

GRANT SELECT ON public.order_status_history TO anon, authenticated;
GRANT ALL ON public.order_status_history TO authenticated;

GRANT SELECT ON public.tax_configurations TO anon, authenticated;
GRANT ALL ON public.tax_configurations TO authenticated;

GRANT SELECT ON public.tax_categories TO anon, authenticated;
GRANT ALL ON public.tax_categories TO authenticated;

GRANT SELECT ON public.discounts TO anon, authenticated;
GRANT ALL ON public.discounts TO authenticated;

GRANT SELECT ON public.pickup_settings TO anon, authenticated;
GRANT ALL ON public.pickup_settings TO authenticated;

GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 12.4 Secure RLS Policies: Orders
CREATE POLICY "Orders select restricted"
ON public.orders FOR SELECT
USING (
    public.is_staff()
    OR
    (
        guest_access_token_hash IS NOT NULL
        AND NULLIF(current_setting('request.headers', true)::json->>'x-order-token', '') IS NOT NULL
        AND guest_access_token_hash = encode(sha256((current_setting('request.headers', true)::json->>'x-order-token')::bytea), 'hex')
    )
    OR
    (customer_id IS NOT NULL AND customer_id IN (
        SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
    ))
);

CREATE POLICY "Orders staff insert only"
ON public.orders FOR INSERT
WITH CHECK (public.is_staff());

CREATE POLICY "Orders staff update only"
ON public.orders FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- 12.5 Secure RLS Policies: Order Items (NO PENDING SHORTCUT)
CREATE POLICY "Order items select restricted"
ON public.order_items FOR SELECT
USING (
    public.is_staff()
    OR
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id
          AND (
              (
                  o.guest_access_token_hash IS NOT NULL
                  AND NULLIF(current_setting('request.headers', true)::json->>'x-order-token', '') IS NOT NULL
                  AND o.guest_access_token_hash = encode(sha256((current_setting('request.headers', true)::json->>'x-order-token')::bytea), 'hex')
              )
              OR (
                  o.customer_id IS NOT NULL AND o.customer_id IN (
                      SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                  )
              )
          )
    )
);

CREATE POLICY "Order items staff insert only"
ON public.order_items FOR INSERT
WITH CHECK (public.is_staff());

CREATE POLICY "Order items staff update only"
ON public.order_items FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- 12.6 Secure RLS Policies: Payments & Transactions
CREATE POLICY "Payments select restricted"
ON public.payments FOR SELECT
USING (
    public.is_staff()
    OR
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = payments.order_id
          AND (
              (
                  o.guest_access_token_hash IS NOT NULL
                  AND NULLIF(current_setting('request.headers', true)::json->>'x-order-token', '') IS NOT NULL
                  AND o.guest_access_token_hash = encode(sha256((current_setting('request.headers', true)::json->>'x-order-token')::bytea), 'hex')
              )
              OR (
                  o.customer_id IS NOT NULL AND o.customer_id IN (
                      SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                  )
              )
          )
    )
);

CREATE POLICY "Payments staff insert"
ON public.payments FOR INSERT
WITH CHECK (public.is_staff());

CREATE POLICY "Payments staff update"
ON public.payments FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

CREATE POLICY "Payment transactions select restricted"
ON public.payment_transactions FOR SELECT
USING (
    public.is_staff()
    OR
    EXISTS (
        SELECT 1 FROM public.payments p
        JOIN public.orders o ON o.id = p.order_id
        WHERE p.id = payment_transactions.payment_id
          AND (
              (
                  o.guest_access_token_hash IS NOT NULL
                  AND NULLIF(current_setting('request.headers', true)::json->>'x-order-token', '') IS NOT NULL
                  AND o.guest_access_token_hash = encode(sha256((current_setting('request.headers', true)::json->>'x-order-token')::bytea), 'hex')
              )
              OR (
                  o.customer_id IS NOT NULL AND o.customer_id IN (
                      SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                  )
              )
          )
    )
);

CREATE POLICY "Payment transactions staff insert"
ON public.payment_transactions FOR INSERT
WITH CHECK (public.is_staff());

-- 12.7 Secure RLS Policies: Order Status History
CREATE POLICY "Status history select restricted"
ON public.order_status_history FOR SELECT
USING (
    public.is_staff()
    OR
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_status_history.order_id
          AND (
              (
                  o.guest_access_token_hash IS NOT NULL
                  AND NULLIF(current_setting('request.headers', true)::json->>'x-order-token', '') IS NOT NULL
                  AND o.guest_access_token_hash = encode(sha256((current_setting('request.headers', true)::json->>'x-order-token')::bytea), 'hex')
              )
              OR (
                  o.customer_id IS NOT NULL AND o.customer_id IN (
                      SELECT c.id FROM public.customers c WHERE c.auth_user_id = auth.uid()
                  )
              )
          )
    )
);

CREATE POLICY "Status history staff or system insert"
ON public.order_status_history FOR INSERT
WITH CHECK (public.is_staff());

-- 12.8 Secure RLS Policies: Admin Audit Logs
CREATE POLICY "Admin audit logs view"
ON public.admin_audit_logs FOR SELECT
USING (public.is_admin());

CREATE POLICY "Admin audit logs insert"
ON public.admin_audit_logs FOR INSERT
WITH CHECK (public.is_staff());

-- 12.9 Secure RLS Policies: Tax Configurations & Categories
CREATE POLICY "Tax config public select"
ON public.tax_configurations FOR SELECT
USING (true);

CREATE POLICY "Tax config admin manage"
ON public.tax_configurations FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Tax categories public select"
ON public.tax_categories FOR SELECT
USING (true);

CREATE POLICY "Tax categories admin manage"
ON public.tax_categories FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 12.10 Secure RLS Policies: Discounts & Pickup Settings
CREATE POLICY "Discounts public view active"
ON public.discounts FOR SELECT
USING (is_active = true OR public.is_staff());

CREATE POLICY "Discounts admin manage"
ON public.discounts FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Pickup settings public select"
ON public.pickup_settings FOR SELECT
USING (true);

CREATE POLICY "Pickup settings admin manage"
ON public.pickup_settings FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- ============================================================================
-- 13. TRIGGERS
-- ============================================================================
CREATE OR REPLACE TRIGGER trg_orders_updated
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_payments_updated
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_tax_configurations_updated
    BEFORE UPDATE ON public.tax_configurations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_pickup_settings_updated
    BEFORE UPDATE ON public.pickup_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- 14. INITIAL SEED FOR BATCH 02 CONFIGURATIONS (SAFE UNCONFIGURED DEFAULTS)
-- ============================================================================
INSERT INTO public.tax_configurations (
    id,
    is_gst_enabled,
    default_tax_rate,
    cgst_rate,
    sgst_rate,
    igst_rate,
    is_tax_inclusive,
    gst_number,
    legal_business_name
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    false,
    0.00,
    0.00,
    0.00,
    0.00,
    false,
    NULL,
    NULL
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tax_categories (id, name, rate, description, is_active) VALUES
    ('11000000-0000-0000-0000-000000000001', 'Standard Rate (Unconfigured)', 0.00, 'Default tax category — configure applicable rate and rules via Admin Portal', false),
    ('11000000-0000-0000-0000-000000000002', 'Exempt / Zero Rated', 0.00, 'Goods or services exempted from tax', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.discounts (id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, is_active) VALUES
    ('d0000000-0000-0000-0000-000000000001', 'HANGOUT10', '10% off on all orders above ₹300', 'PERCENTAGE', 10.00, 300.00, 150.00, true),
    ('d0000000-0000-0000-0000-000000000002', 'FIRSTBITE', 'Flat ₹50 off on first visit above ₹250', 'FLAT', 50.00, 250.00, 50.00, true),
    ('d0000000-0000-0000-0000-000000000003', 'COFFEELOVER', '15% off specialty artisanal brews', 'PERCENTAGE', 15.00, 200.00, 100.00, true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.pickup_settings (
    id,
    is_online_ordering_paused,
    is_asap_enabled,
    asap_estimated_minutes,
    slot_interval_minutes,
    advance_order_hours_limit,
    minimum_order_amount,
    pickup_policy_notice
) VALUES (
    '20000000-0000-0000-0000-000000000001',
    false,
    true,
    15,
    15,
    12,
    0.00,
    'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.'
) ON CONFLICT (id) DO NOTHING;
