-- HANGOUT Modern Cafe Digital Platform
-- Migration 01-B: Security Correction, Policy Purge & RBAC Helper Layer for Batch 01
-- Compatible with PostgreSQL 15+ / Supabase
-- Hardened for Customer Session Security, Registration Control, and Explicit Policy Cleanup

-- ============================================================================
-- 1. SECURITY DEFINER ROLE-CHECK HELPERS
-- ============================================================================
-- These functions look up the authenticated user's active role directly in
-- public.user_profiles without trusting forged JWT attributes or client claims.

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT up.role_id INTO v_role
    FROM public.user_profiles up
    WHERE up.auth_user_id = auth.uid()
      AND up.is_active = TRUE
    LIMIT 1;

    RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.auth_user_id = auth.uid()
          AND up.is_active = TRUE
          AND up.role_id = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.auth_user_id = auth.uid()
          AND up.is_active = TRUE
          AND (up.role_id = ANY(required_roles) OR up.role_id = 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_any_role(ARRAY['admin', 'manager', 'waiter', 'kitchen', 'cashier']);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.get_auth_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_any_role(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(TEXT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;

-- ============================================================================
-- 2. CUSTOMER IDENTITY HARDENING & SECURE SESSION LAYER
-- ============================================================================
-- Adds auth_user_id to customers to reserve account-level profiles strictly
-- for genuine Supabase Auth users.
ALTER TABLE public.customers
    ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers (auth_user_id);

-- Adds token_hash column for secure hash storage if not present
ALTER TABLE public.customer_sessions
    ADD COLUMN IF NOT EXISTS token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_customer_sessions_token_hash ON public.customer_sessions (token_hash);

-- BLOCKER 1 REMEDIATION:
-- Explicitly DROP and ELIMINATE phone-number-based customer registration / session issuance.
-- Phone numbers are contact snapshots on orders, NOT authentication credentials.
-- Anonymous users place guest orders without creating or accessing persistent customer accounts.
-- Account-level history is reserved exclusively for authenticated Supabase Auth users.
DROP FUNCTION IF EXISTS public.register_or_identify_customer(TEXT, TEXT, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.register_or_identify_customer(TEXT, TEXT, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.register_or_identify_customer(TEXT, TEXT, TEXT);

-- Customer Session Revocation RPC (Staff / Auth User revocation)
CREATE OR REPLACE FUNCTION public.revoke_customer_session(p_session_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.customer_sessions
    SET expires_at = NOW()
    WHERE session_token = p_session_token
       OR token_hash = encode(sha256(p_session_token::bytea), 'hex');
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.revoke_customer_session(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_customer_session(TEXT) TO authenticated;

-- ============================================================================
-- 3. NARROW PRIVILEGE GRANTS FOR BATCH 01 TABLES
-- ============================================================================
REVOKE ALL ON public.roles FROM anon, authenticated;
REVOKE ALL ON public.user_profiles FROM anon, authenticated;
REVOKE ALL ON public.cafe_settings FROM anon, authenticated;
REVOKE ALL ON public.cafe_tables FROM anon, authenticated;
REVOKE ALL ON public.customers FROM anon, authenticated;
REVOKE ALL ON public.customer_sessions FROM anon, authenticated;
REVOKE ALL ON public.menu_categories FROM anon, authenticated;
REVOKE ALL ON public.menu_items FROM anon, authenticated;
REVOKE ALL ON public.menu_item_variants FROM anon, authenticated;
REVOKE ALL ON public.menu_item_addons FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Public Catalog & Settings (Read-Only)
GRANT SELECT ON public.roles TO anon, authenticated;
GRANT SELECT ON public.cafe_settings TO anon, authenticated;
GRANT SELECT ON public.cafe_tables TO anon, authenticated;
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT SELECT ON public.menu_item_variants TO anon, authenticated;
GRANT SELECT ON public.menu_item_addons TO anon, authenticated;

-- Authenticated Staff Management of Catalog & Tables
GRANT ALL ON public.cafe_settings TO authenticated;
GRANT UPDATE ON public.cafe_tables TO authenticated;
GRANT ALL ON public.menu_categories TO authenticated;
GRANT ALL ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_item_variants TO authenticated;
GRANT ALL ON public.menu_item_addons TO authenticated;

-- User Profiles (Anonymous gets ZERO access; authenticated staff get SELECT)
GRANT SELECT ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO authenticated;

-- Customer Profile & Session Access
-- Anonymous users have ZERO access to customers and customer_sessions tables.
-- Customer account data is reserved exclusively for authenticated Supabase Auth users.
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.customer_sessions FROM anon;
-- Grant narrow SELECT to anon on customers so RLS subqueries on orders evaluate cleanly (RLS restricts anon to 0 rows)
GRANT SELECT ON public.customers TO anon;

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customer_sessions TO authenticated;

-- ============================================================================
-- 4. EXPLICIT PURGE OF ALL EXISTING PERMISSIVE POLICIES FROM BATCH 01
-- ============================================================================
-- PostgreSQL combines permissive RLS policies using OR logic.
-- Every prior policy on customers, sessions, and tables MUST be dropped explicitly.

DROP POLICY IF EXISTS "Customers can create their own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can read their own profile via session" ON public.customers;
DROP POLICY IF EXISTS "Customers create profile" ON public.customers;
DROP POLICY IF EXISTS "Customers read own profile via session or staff" ON public.customers;
DROP POLICY IF EXISTS "Customers read own profile via auth or staff" ON public.customers;

DROP POLICY IF EXISTS "Anyone can insert a session with valid customer" ON public.customer_sessions;
DROP POLICY IF EXISTS "Session bearer can read own active session" ON public.customer_sessions;
DROP POLICY IF EXISTS "Session bearer can update own active session" ON public.customer_sessions;
DROP POLICY IF EXISTS "Insert session with valid customer" ON public.customer_sessions;
DROP POLICY IF EXISTS "Read session with matching token or staff" ON public.customer_sessions;
DROP POLICY IF EXISTS "Update session with matching token or staff" ON public.customer_sessions;
DROP POLICY IF EXISTS "Staff view sessions" ON public.customer_sessions;
DROP POLICY IF EXISTS "Staff manage sessions" ON public.customer_sessions;

DROP POLICY IF EXISTS "Staff can view active user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Staff view active profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Admin manage user profiles" ON public.user_profiles;

DROP POLICY IF EXISTS "Staff update tables" ON public.cafe_tables;
DROP POLICY IF EXISTS "Anyone can view active cafe tables" ON public.cafe_tables;

-- ============================================================================
-- 5. REVISED SECURE RLS POLICIES FOR BATCH 01
-- ============================================================================
-- 5.1 Customers Table Policies
-- SELECT: Accessible only to authenticated owner (matching auth_user_id = auth.uid()) OR staff.
-- Anonymous users cannot retrieve ANY customer records or historical customer profiles.
CREATE POLICY "Customers read own profile via auth or staff"
    ON public.customers FOR SELECT
    USING (
        public.is_staff()
        OR
        (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
    );

-- INSERT / UPDATE: Direct client insert blocked; staff only.
CREATE POLICY "Staff insert customers"
    ON public.customers FOR INSERT
    WITH CHECK (public.is_staff());

CREATE POLICY "Staff update customers"
    ON public.customers FOR UPDATE
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- 5.2 Customer Sessions Policies (Staff-only access)
CREATE POLICY "Staff view sessions"
    ON public.customer_sessions FOR SELECT
    USING (public.is_staff());

CREATE POLICY "Staff manage sessions"
    ON public.customer_sessions FOR ALL
    USING (public.is_staff())
    WITH CHECK (public.is_staff());

-- 5.3 User Profiles Policies
CREATE POLICY "Staff view active profiles"
    ON public.user_profiles FOR SELECT
    USING (public.is_staff() AND is_active = true);

CREATE POLICY "Admin manage user profiles"
    ON public.user_profiles FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- 5.4 Cafe Tables Policies
CREATE POLICY "Anyone view active cafe tables"
    ON public.cafe_tables FOR SELECT
    USING (is_active = true);

CREATE POLICY "Staff update tables"
    ON public.cafe_tables FOR UPDATE
    USING (public.has_any_role(ARRAY['admin', 'manager', 'waiter', 'cashier']))
    WITH CHECK (public.has_any_role(ARRAY['admin', 'manager', 'waiter', 'cashier']));

-- ============================================================================
-- 6. STORAGE OBJECT ACCESS POLICIES (menu-assets)
-- ============================================================================
DROP POLICY IF EXISTS "Public Read Access for Menu Assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload menu assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin update menu assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete menu assets" ON storage.objects;

CREATE POLICY "Public Read Access for Menu Assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'menu-assets');

CREATE POLICY "Admin upload menu assets"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'menu-assets'
    AND public.is_admin()
    AND (LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'avif'))
    AND (metadata IS NULL OR (metadata->>'size') IS NULL OR (metadata->>'size')::bigint <= 5242880)
);

CREATE POLICY "Admin update menu assets"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'menu-assets'
    AND public.is_admin()
)
WITH CHECK (
    bucket_id = 'menu-assets'
    AND public.is_admin()
    AND (LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp', 'avif'))
    AND (metadata IS NULL OR (metadata->>'size') IS NULL OR (metadata->>'size')::bigint <= 5242880)
);

CREATE POLICY "Admin delete menu assets"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'menu-assets'
    AND public.is_admin()
);
