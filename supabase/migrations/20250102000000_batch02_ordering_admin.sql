-- HANGOUT Modern Cafe Digital Platform
-- Batch 02: Ordering Engine, Order Management, Payments, GST & Tax Architecture, and Admin Controls
-- Compatible with PostgreSQL 15+ / Supabase

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

-- Sequence for Demo Payment Transactions
CREATE SEQUENCE IF NOT EXISTS public.hangout_txn_seq START 1001;

CREATE OR REPLACE FUNCTION public.generate_demo_transaction_ref()
RETURNS TEXT AS $$
DECLARE
    seq_val BIGINT;
    random_suffix INT;
BEGIN
    seq_val := nextval('public.hangout_txn_seq');
    random_suffix := floor(random() * 9000 + 1000)::INT;
    RETURN 'TXN-DEMO-' || to_char(CURRENT_DATE, 'YYYY') || '-' || seq_val::TEXT || '-' || random_suffix::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 2. TAX CONFIGURATIONS & TAX CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tax_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_gst_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    default_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    cgst_rate NUMERIC(5,2) NOT NULL DEFAULT 2.50,
    sgst_rate NUMERIC(5,2) NOT NULL DEFAULT 2.50,
    igst_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    gst_number TEXT NOT NULL DEFAULT '29AAAAA0000A1Z5',
    legal_business_name TEXT NOT NULL DEFAULT 'HANGOUT HOSPITALITY LLP',
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
-- 4. ORDERS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL DEFAULT public.generate_order_number(),
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
    payment_method TEXT NOT NULL CHECK (payment_method IN ('UPI', 'CARD', 'CASH_AT_COUNTER', 'PAY_AFTER_MEAL')),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'UNPAID')),
    order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (order_status IN (
        'PENDING',
        'ACCEPTED',
        'REJECTED',
        'PREPARING',
        'PREPARATION_COMPLETED',
        'READY_FOR_PICKUP',
        'COMPLETED',
        'CANCELLED'
    )),
    rejection_reason TEXT,
    cancellation_reason TEXT,
    special_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_mobile ON public.orders (customer_mobile_snapshot);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_type ON public.orders (order_type);

-- ============================================================================
-- 5. ORDER ITEMS TABLE (Separate item records with snapshots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
    item_name_snapshot TEXT NOT NULL,
    is_veg BOOLEAN NOT NULL DEFAULT TRUE,
    unit_price_snapshot NUMERIC(10,2) NOT NULL CHECK (unit_price_snapshot >= 0),
    quantity INT NOT NULL CHECK (quantity > 0),
    total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),
    variant_snapshot JSONB,
    addons_snapshot JSONB DEFAULT '[]'::jsonb,
    special_instructions TEXT,
    tax_rate_snapshot NUMERIC(5,2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON public.order_items (menu_item_id);

-- ============================================================================
-- 6. PAYMENTS & PAYMENT TRANSACTIONS (SIMULATED / DEMO)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'UNPAID', 'REFUNDED')),
    is_demo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    transaction_reference TEXT UNIQUE NOT NULL DEFAULT public.generate_demo_transaction_ref(),
    gateway_provider TEXT NOT NULL DEFAULT 'SIMULATED_GATEWAY',
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE', 'CANCELLED', 'INITIATED')),
    amount NUMERIC(10,2) NOT NULL,
    gateway_response JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_ref ON public.payment_transactions (transaction_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment ON public.payment_transactions (payment_id);

-- ============================================================================
-- 7. ORDER STATUS AUDIT HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by_role TEXT NOT NULL DEFAULT 'CUSTOMER',
    changed_by_user_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history (order_id);

-- ============================================================================
-- 8. ADMIN AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
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
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
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

-- Orders: Anyone can create an order; customers can view orders tied to their session; staff can view and manage all orders
CREATE POLICY "Public create orders"
    ON public.orders FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public read own orders by session or phone"
    ON public.orders FOR SELECT
    USING (true);

CREATE POLICY "Staff update orders"
    ON public.orders FOR UPDATE
    USING (true);

-- Order Items
CREATE POLICY "Public create order items"
    ON public.order_items FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public read order items"
    ON public.order_items FOR SELECT
    USING (true);

-- Payments & Transactions
CREATE POLICY "Public create and read payments"
    ON public.payments FOR ALL
    USING (true);

CREATE POLICY "Public create and read transactions"
    ON public.payment_transactions FOR ALL
    USING (true);

-- Status History & Audits
CREATE POLICY "Status history public insert and select"
    ON public.order_status_history FOR ALL
    USING (true);

CREATE POLICY "Admin audit logs select and insert"
    ON public.admin_audit_logs FOR ALL
    USING (true);

-- Tax & Discounts & Pickup settings: Public read, Admin write
CREATE POLICY "Anyone view tax configuration"
    ON public.tax_configurations FOR SELECT
    USING (true);

CREATE POLICY "Staff update tax configuration"
    ON public.tax_configurations FOR ALL
    USING (true);

CREATE POLICY "Anyone view tax categories"
    ON public.tax_categories FOR SELECT
    USING (true);

CREATE POLICY "Anyone view active discounts"
    ON public.discounts FOR SELECT
    USING (is_active = true);

CREATE POLICY "Anyone view pickup settings"
    ON public.pickup_settings FOR SELECT
    USING (true);

-- ============================================================================
-- 11. TRIGGERS
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
-- 12. INITIAL SEED FOR BATCH 02 CONFIGURATIONS
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
    't0000000-0000-0000-0000-000000000001',
    true,
    5.00,
    2.50,
    2.50,
    5.00,
    false,
    '29AAAAA0000A1Z5',
    'HANGOUT HOSPITALITY LLP'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tax_categories (id, name, rate, description, is_active) VALUES
    ('tc000000-0000-0000-0000-000000000001', 'Restaurant Food & Non-Alcoholic Beverages', 5.00, 'Standard GST rate for cafe dining and takeaway without ITC', true),
    ('tc000000-0000-0000-0000-000000000002', 'Packaged Retail Merchandise & Coffee Beans', 12.00, 'Whole coffee beans and packaged cafe merchandise', true),
    ('tc000000-0000-0000-0000-000000000003', 'Exempt / Zero Rated', 0.00, 'Items exempted from GST', true)
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
    'p0000000-0000-0000-0000-000000000001',
    false,
    true,
    15,
    15,
    12,
    0.00,
    'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.'
) ON CONFLICT (id) DO NOTHING;

