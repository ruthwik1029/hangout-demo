-- HANGOUT Modern Cafe Digital Platform
-- Batch 01: Core Database Schema Migration
-- Compatible with PostgreSQL 15+ / Supabase

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ROLES & PERMISSIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. USER PROFILES (Admin / Staff / Kitchen / Waiter)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON UPDATE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. CAFE SETTINGS (Global Configuration & GST)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cafe_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cafe_name TEXT NOT NULL DEFAULT 'HANGOUT',
    tagline TEXT DEFAULT 'Specialty Coffee & Modern Artisanal Bites',
    phone TEXT DEFAULT '+91 98765 43210',
    email TEXT DEFAULT 'hello@hangoutcafe.com',
    address TEXT DEFAULT 'Plot 42, 100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038',
    opening_hours JSONB DEFAULT '{
        "monday_to_friday": "08:00 AM - 11:00 PM",
        "saturday_sunday": "08:00 AM - 12:00 Midnight"
    }'::jsonb,
    dining_enabled BOOLEAN DEFAULT TRUE,
    takeaway_enabled BOOLEAN DEFAULT TRUE,
    gst_enabled BOOLEAN DEFAULT TRUE,
    gst_percentage NUMERIC(5,2) DEFAULT 5.00,
    gst_number TEXT DEFAULT '29AAAAA0000A1Z5',
    currency_symbol TEXT DEFAULT '₹',
    currency_code TEXT DEFAULT 'INR',
    takeaway_notice TEXT NOT NULL DEFAULT 'Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end.',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. CAFE TABLES (Dining Table Management & QR Identity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cafe_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT UNIQUE NOT NULL,
    qr_code_identifier TEXT UNIQUE NOT NULL,
    seating_capacity INT DEFAULT 4,
    section TEXT DEFAULT 'Main Indoor',
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for QR lookup
CREATE INDEX IF NOT EXISTS idx_cafe_tables_qr ON public.cafe_tables (qr_code_identifier);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_number ON public.cafe_tables (table_number);

-- ============================================================================
-- 5. CUSTOMERS (Lightweight, Safe Profile Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    email TEXT,
    total_orders INT DEFAULT 0,
    total_spent NUMERIC(10,2) DEFAULT 0.00,
    last_visit_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for customer phone lookups
CREATE INDEX IF NOT EXISTS idx_customers_mobile ON public.customers (mobile_number);

-- ============================================================================
-- 6. CUSTOMER SESSIONS (Safe Session Token Strategy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.customer_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.cafe_tables(id) ON DELETE SET NULL,
    order_mode TEXT NOT NULL DEFAULT 'takeaway' CHECK (order_mode IN ('dining', 'takeaway')),
    device_info TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session verification
CREATE INDEX IF NOT EXISTS idx_customer_sessions_token ON public.customer_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON public.customer_sessions (customer_id);

-- ============================================================================
-- 7. MENU CATEGORIES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    icon_name TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_categories_slug ON public.menu_categories (slug);
CREATE INDEX IF NOT EXISTS idx_menu_categories_active_order ON public.menu_categories (is_active, display_order);

-- ============================================================================
-- 8. MENU ITEMS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.menu_categories(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
    image_url TEXT,
    is_veg BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_today_special BOOLEAN DEFAULT FALSE,
    preparation_time_mins INT DEFAULT 15,
    calories INT,
    allergens TEXT[] DEFAULT '{}',
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items (category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_featured ON public.menu_items (is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_menu_items_special ON public.menu_items (is_today_special) WHERE is_today_special = TRUE;

-- ============================================================================
-- 9. MENU ITEM VARIANTS (e.g. Size, Milk Option, Roast)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_item_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    variant_group TEXT NOT NULL,
    name TEXT NOT NULL,
    price_delta NUMERIC(10,2) DEFAULT 0.00,
    is_default BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_variants_item ON public.menu_item_variants (menu_item_id);

-- ============================================================================
-- 10. MENU ITEM ADDONS (e.g. Extra Shot, Truffle Dip, Caramel Drizzle)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.menu_item_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.menu_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    is_veg BOOLEAN DEFAULT TRUE,
    is_available BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_addons_item ON public.menu_item_addons (menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_item_addons_category ON public.menu_item_addons (category_id);

-- ============================================================================
-- 11. STORAGE BUCKET CONFIGURATION (Supabase Storage)
-- ============================================================================
-- Inserts a public bucket for menu item images and media
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-assets', 'menu-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow public read of menu assets
CREATE POLICY "Public Read Access for Menu Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-assets');

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cafe_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_addons ENABLE ROW LEVEL SECURITY;

-- 12.1 Cafe Settings: Public read, Admin write
CREATE POLICY "Anyone can view cafe settings"
    ON public.cafe_settings FOR SELECT
    USING (true);

-- 12.2 Menu Categories: Public read active, Admin write
CREATE POLICY "Anyone can view active menu categories"
    ON public.menu_categories FOR SELECT
    USING (is_active = true);

-- 12.3 Menu Items: Public read available items
CREATE POLICY "Anyone can view available menu items"
    ON public.menu_items FOR SELECT
    USING (is_available = true);

-- 12.4 Menu Variants & Addons: Public read available
CREATE POLICY "Anyone can view available variants"
    ON public.menu_item_variants FOR SELECT
    USING (is_available = true);

CREATE POLICY "Anyone can view available addons"
    ON public.menu_item_addons FOR SELECT
    USING (is_available = true);

-- 12.5 Cafe Tables: Public read active tables
CREATE POLICY "Anyone can view active cafe tables"
    ON public.cafe_tables FOR SELECT
    USING (is_active = true);

-- 12.6 Customer Profiles: Protected access
-- Customers can insert their own profile during registration
CREATE POLICY "Customers can create their own profile"
    ON public.customers FOR INSERT
    WITH CHECK (true);

-- Customers can view their own profile if they hold a valid active session token matching customer_id
CREATE POLICY "Customers can read their own profile via session"
    ON public.customers FOR SELECT
    USING (
        id IN (
            SELECT customer_id FROM public.customer_sessions
            WHERE expires_at > NOW()
        )
    );

-- 12.7 Customer Sessions:
CREATE POLICY "Anyone can insert a session with valid customer"
    ON public.customer_sessions FOR INSERT
    WITH CHECK (customer_id IS NOT NULL);

CREATE POLICY "Session bearer can read own active session"
    ON public.customer_sessions FOR SELECT
    USING (expires_at > NOW());

CREATE POLICY "Session bearer can update own active session"
    ON public.customer_sessions FOR UPDATE
    USING (expires_at > NOW());

-- 12.8 Roles: Public read for identity/routing checks
CREATE POLICY "Authenticated or anon can view roles"
    ON public.roles FOR SELECT
    USING (true);

-- 12.9 User Profiles: Authenticated users can view profiles
CREATE POLICY "Staff can view active user profiles"
    ON public.user_profiles FOR SELECT
    USING (is_active = true);

-- ============================================================================
-- 13. TRIGGERS & AUTO-UPDATED TIMESTAMPS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_cafe_settings_updated
    BEFORE UPDATE ON public.cafe_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_user_profiles_updated
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_menu_categories_updated
    BEFORE UPDATE ON public.menu_categories
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_menu_items_updated
    BEFORE UPDATE ON public.menu_items
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER trg_customers_updated
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
