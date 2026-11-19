-- HANGOUT Modern Cafe Digital Platform
-- Batch 03: Staff/Waiter Operations, Table Management, Kitchen Display System (KDS), and Bill Splitting
-- Compatible with PostgreSQL 15+ / Supabase

-- ============================================================================
-- 1. KITCHEN STATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.kitchen_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL, -- e.g. 'MAIN_KITCHEN', 'BEVERAGE', 'BAKERY', 'DESSERT'
    description TEXT,
    display_order INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial Kitchen Stations
INSERT INTO public.kitchen_stations (id, name, code, description, display_order)
VALUES
    ('s0000000-0000-0000-0000-000000000001', 'Main Kitchen (Hot & Grills)', 'MAIN_KITCHEN', 'Hot kitchen station for gourmet burgers, artisan pastas, and warm savories', 1),
    ('s0000000-0000-0000-0000-000000000002', 'Beverage Bar & Espresso Counter', 'BEVERAGE', 'Specialty espresso brews, cold coffees, matcha, and signature chillers', 2),
    ('s0000000-0000-0000-0000-000000000003', 'Artisan Bakery & Toast Station', 'BAKERY', 'Sourdough toasts, brioche sandwiches, croissants, and breakfast bakes', 3),
    ('s0000000-0000-0000-0000-000000000004', 'Dessert & Pastry Counter', 'DESSERT', 'Artisanal cheesecakes, tiramisu, cookies, and sweet delicacies', 4)
ON CONFLICT (code) DO NOTHING;

-- Add station routing to menu_items
ALTER TABLE public.menu_items
    ADD COLUMN IF NOT EXISTS kitchen_station_id UUID REFERENCES public.kitchen_stations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS station_code TEXT DEFAULT 'MAIN_KITCHEN';

CREATE INDEX IF NOT EXISTS idx_menu_items_station ON public.menu_items (station_code);

-- ============================================================================
-- 2. CAFE TABLES EXTENSIONS FOR FLOOR & WAITER OPERATIONS
-- ============================================================================
-- Drop existing status check to allow 'cleaning'
ALTER TABLE public.cafe_tables DROP CONSTRAINT IF EXISTS cafe_tables_status_check;
ALTER TABLE public.cafe_tables
    ADD CONSTRAINT cafe_tables_status_check CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning'));

ALTER TABLE public.cafe_tables
    ADD COLUMN IF NOT EXISTS guest_count INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS assigned_waiter_id UUID,
    ADD COLUMN IF NOT EXISTS assigned_waiter_name TEXT,
    ADD COLUMN IF NOT EXISTS active_order_id UUID,
    ADD COLUMN IF NOT EXISTS current_bill_amount NUMERIC(10,2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON public.cafe_tables (status);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_waiter ON public.cafe_tables (assigned_waiter_id);

-- ============================================================================
-- 3. EXTEND ORDERS TABLE FOR DINING WORKFLOWS & BILL SPLITS
-- ============================================================================
-- Update order_status constraint to support dining service lifecycle
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE public.orders
    ADD CONSTRAINT orders_order_status_check CHECK (order_status IN (
        'PENDING',
        'ACCEPTED',
        'REJECTED',
        'PREPARING',
        'PREPARATION_COMPLETED',
        'READY_FOR_PICKUP',
        'READY_FOR_SERVICE',
        'SERVED',
        'COMPLETED',
        'CANCELLED'
    ));

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS waiter_id UUID,
    ADD COLUMN IF NOT EXISTS waiter_name TEXT,
    ADD COLUMN IF NOT EXISTS guest_count INT,
    ADD COLUMN IF NOT EXISTS approved_by_waiter_id UUID,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preparation_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS is_split_bill BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS split_count INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(10,2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_orders_waiter ON public.orders (waiter_id);

-- ============================================================================
-- 4. ORDER ITEMS: ITEM-LEVEL PREPARATION & TIMESTAMPS
-- ============================================================================
ALTER TABLE public.order_items
    ADD COLUMN IF NOT EXISTS item_status TEXT DEFAULT 'QUEUED'
        CHECK (item_status IN ('QUEUED', 'PREPARING', 'PREPARATION_COMPLETED', 'READY', 'SERVED', 'CANCELLED')),
    ADD COLUMN IF NOT EXISTS kitchen_station_id UUID REFERENCES public.kitchen_stations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS station_code TEXT DEFAULT 'MAIN_KITCHEN',
    ADD COLUMN IF NOT EXISTS preparation_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS preparation_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS served_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS estimated_prep_mins INT DEFAULT 15;

CREATE INDEX IF NOT EXISTS idx_order_items_status ON public.order_items (item_status);
CREATE INDEX IF NOT EXISTS idx_order_items_station_code ON public.order_items (station_code);

-- ============================================================================
-- 5. BILL SPLITS & PARTIAL SETTLEMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bill_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    split_index INT NOT NULL,
    label TEXT NOT NULL,
    split_type TEXT NOT NULL CHECK (split_type IN ('EQUAL', 'ITEMS', 'CUSTOM')),
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    item_ids JSONB DEFAULT '[]'::jsonb,
    payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PAID')),
    payment_method TEXT,
    transaction_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_splits_order ON public.bill_splits (order_id);
CREATE INDEX IF NOT EXISTS idx_bill_splits_status ON public.bill_splits (payment_status);

-- ============================================================================
-- 6. STAFF & OPERATIONAL AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.staff_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id TEXT,
    staff_name TEXT NOT NULL,
    role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('TABLE', 'ORDER', 'ORDER_ITEM', 'BILL', 'STATION')),
    entity_id TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_entity ON public.staff_audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_staff ON public.staff_audit_logs (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_created ON public.staff_audit_logs (created_at DESC);

-- ============================================================================
-- 7. RLS POLICIES FOR BATCH 03
-- ============================================================================
ALTER TABLE public.kitchen_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read for kitchen stations"
    ON public.kitchen_stations FOR SELECT USING (true);

CREATE POLICY "Allow authenticated staff to manage kitchen stations"
    ON public.kitchen_stations FOR ALL
    USING (auth.jwt() ->> 'role' IN ('admin', 'service_role'))
    WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'service_role'));

CREATE POLICY "Allow authenticated staff to view and manage bill splits"
    ON public.bill_splits FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow staff to insert audit records"
    ON public.staff_audit_logs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow staff to view audit records"
    ON public.staff_audit_logs FOR SELECT
    USING (true);
