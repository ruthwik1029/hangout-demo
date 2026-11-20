-- ============================================================================
-- HANGOUT MIGRATION: QR Tracking, Guest Order Recovery, & Staff Role Access
-- Migration: 20250106000000_qr_tracking_and_takeaway_roles.sql
-- Description:
-- 1. Provisions core operational roles ('admin', 'manager', 'cashier', 'waiter', 'kitchen')
--    and pre-seeds staff profiles with explicit unlinked auth status (auth_user_id = NULL).
-- 2. Creates `staff_invitations` table to enforce administrator-controlled staff provisioning.
-- 3. Provides `bootstrap_first_admin` RPC for secure one-time initial setup using an external secret
--    configured outside Git (app.settings.admin_bootstrap_secret), permanently disabled once an admin exists.
-- 4. Provides `manual_provision_admin` procedure restricted exclusively to postgres/service_role.
-- 5. Hardens `admin_provision_staff` RPC:
--    - Restricted to active confirmed Administrators.
--    - When target auth_user_id is passed, strictly verifies auth.users existence, matching email,
--      confirmed email status, and prevents cross-profile reassignment.
-- 6. Hardens `bind_staff_auth_user` RPC:
--    - Requires genuine `auth.uid()`.
--    - Strictly verifies that `auth.users.email_confirmed_at IS NOT NULL`.
--    - Enforces account identity immutability: prevents role jumping if email is modified.
--    - Enforces atomic invitation claiming via `SELECT ... FOR UPDATE`, row-level locking,
--      unclaimed & unexpired validation, and conditional update with ROW_COUNT check.
--    - Blocks arbitrary self-registration from claiming pre-seeded profiles without an
--      authorized administrator invitation and matching provisioning code.
-- 5. Secures `get_admin_orders` RPC:
--    - Strictly requires authenticated Supabase Auth session with confirmed email.
--    - Enforces field-level least-privilege: raw `guest_access_token` and unmasked contact
--      info are restricted to billing roles ('admin', 'manager', 'cashier');
--      'kitchen' and 'waiter' receive NULL tokens and masked customer contact info.
--    - Completely revokes access from anon and PUBLIC.
-- 6. Adds `guest_access_token` column to `public.orders` and indexes it for scannable bill QR codes.
-- 7. Backfills existing orders with cryptographically secure CSPRNG tokens and matching hashes.
-- 8. Hardens `place_order` RPC with true CSPRNG token generation and dual token storage.
-- 9. Hardens `get_order_by_access_token` to verify token or hash match before returning order details.
-- 10. Creates `guest_lookup_attempts` table to enforce server-side rate limiting (5 attempts -> 15 min lock).
-- 11. Hardens `lookup_guest_order` RPC:
--    - Requires full 10-digit mobile number verification.
--    - Enforces rate limiting against brute-force harvesting.
--    - Returns customer order status directly WITHOUT disclosing raw bearer guest_access_tokens.
-- 12. Enforces `SECURITY DEFINER`, fixed `search_path = public, extensions, pg_temp`,
--     and explicit least-privilege EXECUTE grants.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SEED CORE ROLES & INTERNAL STAFF PROFILES (DISTINGUISHED AS UNLINKED)
-- ============================================================================

INSERT INTO public.roles (id, name, description)
VALUES
    ('admin', 'Administrator', 'Full system management, analytics, and billing control'),
    ('manager', 'Duty Manager', 'Store operations, staff oversight, and order fulfillment'),
    ('cashier', 'Billing Cashier', 'Point of sale, payment acceptance, and takeaway dispatch'),
    ('waiter', 'Floor Staff', 'Table service, order delivery, and guest assistance'),
    ('kitchen', 'Kitchen Chef', 'KDS station view and food preparation')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Seed staff profiles with auth_user_id = NULL.
-- These represent pre-provisioned staff role definitions.
-- They CANNOT authenticate against get_admin_orders until genuinely bound to a verified Supabase Auth user.
INSERT INTO public.user_profiles (id, email, full_name, role_id, is_active, auth_user_id)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'admin@hangout.in', 'Administrator', 'admin', true, NULL),
    ('00000000-0000-0000-0000-000000000002', 'manager@hangout.in', 'Duty Manager', 'manager', true, NULL),
    ('00000000-0000-0000-0000-000000000003', 'cashier@hangout.in', 'Billing Cashier', 'cashier', true, NULL),
    ('00000000-0000-0000-0000-000000000004', 'staff@hangout.in', 'Floor Staff', 'waiter', true, NULL),
    ('00000000-0000-0000-0000-000000000005', 'kitchen@hangout.in', 'Kitchen Staff', 'kitchen', true, NULL)
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    role_id = EXCLUDED.role_id,
    is_active = EXCLUDED.is_active;

-- ============================================================================
-- 2. SECURE STAFF PROVISIONING & INVITATION ARCHITECTURE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.staff_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    role_id TEXT NOT NULL REFERENCES public.roles(id) ON UPDATE CASCADE,
    full_name TEXT NOT NULL,
    provisioning_code_hash TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMPTZ DEFAULT NULL,
    claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_invitations_email
ON public.staff_invitations (LOWER(email));

REVOKE ALL ON public.staff_invitations FROM PUBLIC, anon, authenticated;

-- First-Administrator One-Time Bootstrap RPC
-- Requires confirmed email and an explicit secret configured outside the repository
-- via database parameter: app.settings.admin_bootstrap_secret
-- Automatically permanently disabled once any active administrator exists.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
    p_bootstrap_secret TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_has_active_admin BOOLEAN := FALSE;
    v_configured_secret TEXT;
    v_bound_profile public.user_profiles%ROWTYPE;
BEGIN
    -- 1. Strictly require authenticated Supabase Auth user
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Access denied: Valid Supabase Auth session required.';
    END IF;

    -- 2. Strictly require confirmed email
    SELECT email, email_confirmed_at
    INTO v_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = v_uid;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authenticated user has no registered email address.';
    END IF;

    IF v_email_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Access denied: Email address "%" must be confirmed before claiming administrative access.', v_email;
    END IF;

    -- 3. One-Time Guarantee: Ensure no active administrator already exists in the system
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE role_id = 'admin'
          AND auth_user_id IS NOT NULL
          AND is_active = TRUE
    ) INTO v_has_active_admin;

    IF v_has_active_admin THEN
        RAISE EXCEPTION 'Access denied: The system has already been bootstrapped with an active Administrator. Subsequent staff must be provisioned by an Administrator.';
    END IF;

    -- 4. Check explicit secret configured outside repository
    -- Set outside Git via: ALTER DATABASE postgres SET app.settings.admin_bootstrap_secret = '<secure_random_token>';
    v_configured_secret := NULLIF(TRIM(current_setting('app.settings.admin_bootstrap_secret', true)), '');

    IF v_configured_secret IS NULL THEN
        RAISE EXCEPTION 'Access denied: First-administrator bootstrap secret has not been configured in database settings.';
    END IF;

    IF p_bootstrap_secret IS NULL OR TRIM(p_bootstrap_secret) = '' OR TRIM(p_bootstrap_secret) <> v_configured_secret THEN
        RAISE EXCEPTION 'Access denied: Invalid administrator bootstrap secret.';
    END IF;

    -- 5. Bind caller as Administrator
    INSERT INTO public.user_profiles (email, full_name, role_id, is_active, auth_user_id, updated_at)
    VALUES (LOWER(v_email), 'Administrator', 'admin', TRUE, v_uid, NOW())
    ON CONFLICT (email) DO UPDATE
    SET auth_user_id = v_uid,
        role_id = 'admin',
        is_active = TRUE,
        updated_at = NOW()
    RETURNING * INTO v_bound_profile;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'First administrator successfully bootstrapped.',
        'profile_id', v_bound_profile.id,
        'role_id', 'admin',
        'email', v_bound_profile.email
    );
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_first_admin(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(TEXT) TO authenticated;

-- Secure Manual Administrator Provisioning Procedure (for direct DB owner setup outside Git)
CREATE OR REPLACE FUNCTION public.manual_provision_admin(
    p_email TEXT,
    p_auth_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_target_email TEXT;
    v_confirmed_at TIMESTAMPTZ;
    v_bound_profile public.user_profiles%ROWTYPE;
BEGIN
    SELECT email, email_confirmed_at
    INTO v_target_email, v_confirmed_at
    FROM auth.users
    WHERE id = p_auth_user_id;

    IF v_target_email IS NULL THEN
        RAISE EXCEPTION 'Target user "%" not found in auth.users.', p_auth_user_id;
    END IF;

    IF LOWER(TRIM(v_target_email)) <> LOWER(TRIM(p_email)) THEN
        RAISE EXCEPTION 'Target user email "%" does not match supplied email "%".', v_target_email, p_email;
    END IF;

    IF v_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Email "%" must be confirmed in Supabase Auth before provisioning as Administrator.', v_target_email;
    END IF;

    INSERT INTO public.user_profiles (email, full_name, role_id, is_active, auth_user_id, updated_at)
    VALUES (LOWER(TRIM(p_email)), 'Administrator', 'admin', TRUE, p_auth_user_id, NOW())
    ON CONFLICT (email) DO UPDATE
    SET auth_user_id = p_auth_user_id,
        role_id = 'admin',
        is_active = TRUE,
        updated_at = NOW()
    RETURNING * INTO v_bound_profile;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Administrator manually provisioned successfully.',
        'profile_id', v_bound_profile.id,
        'role_id', 'admin',
        'email', v_bound_profile.email
    );
END;
$$;

REVOKE ALL ON FUNCTION public.manual_provision_admin(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manual_provision_admin(TEXT, UUID) TO postgres, service_role;

-- Administrative Provisioning RPC: Strictly restricted to active confirmed Administrators
CREATE OR REPLACE FUNCTION public.admin_provision_staff(
    p_email TEXT,
    p_full_name TEXT,
    p_role_id TEXT,
    p_provisioning_code TEXT DEFAULT NULL,
    p_target_auth_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_admin_uid UUID := auth.uid();
    v_is_admin BOOLEAN := FALSE;
    v_code TEXT := p_provisioning_code;
    v_code_hash TEXT := NULL;
    v_profile_id UUID;
    v_target_email TEXT;
    v_target_confirmed_at TIMESTAMPTZ;
BEGIN
    -- 1. Strictly verify caller is an active, confirmed Admin
    IF v_admin_uid IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authentication required.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles up
        JOIN auth.users au ON au.id = up.auth_user_id
        WHERE up.auth_user_id = v_admin_uid
          AND up.is_active = TRUE
          AND up.role_id = 'admin'
          AND au.email_confirmed_at IS NOT NULL
    ) INTO v_is_admin;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Access denied: Only an active Administrator with confirmed email can provision staff accounts.';
    END IF;

    -- 2. Validate role
    IF LOWER(TRIM(p_role_id)) NOT IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen') THEN
        RAISE EXCEPTION 'Invalid role: "%". Allowed roles are admin, manager, cashier, waiter, kitchen.', p_role_id;
    END IF;

    -- 3. If target auth_user_id is provided directly by admin, perform strict identity & confirmation checks
    IF p_target_auth_user_id IS NOT NULL THEN
        -- 3a. Verify that the target exists in auth.users
        SELECT email, email_confirmed_at
        INTO v_target_email, v_target_confirmed_at
        FROM auth.users
        WHERE id = p_target_auth_user_id;

        IF v_target_email IS NULL THEN
            RAISE EXCEPTION 'Target user "%" does not exist in auth.users.', p_target_auth_user_id;
        END IF;

        -- 3b. Verify the target's registered email matches p_email
        IF LOWER(TRIM(v_target_email)) <> LOWER(TRIM(p_email)) THEN
            RAISE EXCEPTION 'Email mismatch: Target user email "%" does not match supplied email "%".', v_target_email, p_email;
        END IF;

        -- 3c. Require confirmed email
        IF v_target_confirmed_at IS NULL THEN
            RAISE EXCEPTION 'Access denied: Target user email "%" is not confirmed in Supabase Auth.', v_target_email;
        END IF;

        -- 3d. Prevent an already-linked user from being reassigned to another staff identity
        IF EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE auth_user_id = p_target_auth_user_id
              AND LOWER(email) <> LOWER(TRIM(p_email))
        ) THEN
            RAISE EXCEPTION 'Security violation: The target Supabase Auth user is already bound to another staff profile.';
        END IF;

        -- Prevent staff profile from being reassigned to a different Supabase Auth user
        IF EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE LOWER(email) = LOWER(TRIM(p_email))
              AND auth_user_id IS NOT NULL
              AND auth_user_id <> p_target_auth_user_id
        ) THEN
            RAISE EXCEPTION 'Security violation: The staff profile "%" is already bound to a different Supabase Auth user.', p_email;
        END IF;

        INSERT INTO public.user_profiles (email, full_name, role_id, is_active, auth_user_id, updated_at)
        VALUES (LOWER(TRIM(p_email)), TRIM(p_full_name), LOWER(TRIM(p_role_id)), TRUE, p_target_auth_user_id, NOW())
        ON CONFLICT (email) DO UPDATE
        SET full_name = EXCLUDED.full_name,
            role_id = EXCLUDED.role_id,
            is_active = TRUE,
            auth_user_id = p_target_auth_user_id,
            updated_at = NOW()
        RETURNING id INTO v_profile_id;

        RETURN jsonb_build_object(
            'success', true,
            'message', 'Staff account bound directly to target auth user.',
            'profile_id', v_profile_id,
            'email', LOWER(TRIM(p_email)),
            'role_id', LOWER(TRIM(p_role_id))
        );
    END IF;

    -- 4. Otherwise, generate or record an invitation code
    IF v_code IS NULL OR TRIM(v_code) = '' THEN
        v_code := encode(sha256((gen_random_uuid()::text || clock_timestamp()::text || random()::text)::bytea), 'hex');
    END IF;
    v_code_hash := encode(sha256(TRIM(v_code)::bytea), 'hex');

    INSERT INTO public.staff_invitations (email, role_id, full_name, provisioning_code_hash, created_by, expires_at)
    VALUES (LOWER(TRIM(p_email)), LOWER(TRIM(p_role_id)), TRIM(p_full_name), v_code_hash, v_admin_uid, NOW() + INTERVAL '14 days')
    ON CONFLICT (email) DO UPDATE
    SET role_id = EXCLUDED.role_id,
        full_name = EXCLUDED.full_name,
        provisioning_code_hash = EXCLUDED.provisioning_code_hash,
        created_by = v_admin_uid,
        is_claimed = FALSE,
        claimed_at = NULL,
        claimed_by = NULL,
        expires_at = NOW() + INTERVAL '14 days';

    RETURN jsonb_build_object(
        'success', true,
        'email', LOWER(TRIM(p_email)),
        'role_id', LOWER(TRIM(p_role_id)),
        'provisioning_code', v_code,
        'expires_at', (NOW() + INTERVAL '14 days')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_provision_staff(TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_provision_staff(TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- Secure Staff Self-Binding RPC with Atomic Claiming, Email Confirmation & Immutability Enforcement
DROP FUNCTION IF EXISTS public.bind_staff_auth_user();

CREATE OR REPLACE FUNCTION public.bind_staff_auth_user(
    p_provisioning_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_existing_profile_for_uid public.user_profiles%ROWTYPE;
    v_invite public.staff_invitations%ROWTYPE;
    v_code_hash TEXT;
    v_bound_profile public.user_profiles%ROWTYPE;
    v_has_active_admin BOOLEAN := FALSE;
    v_configured_secret TEXT;
    v_rows_updated INT := 0;
BEGIN
    -- 1. Strictly require an authenticated Supabase Auth user
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Access denied: Valid Supabase Auth session required.';
    END IF;

    -- 2. Explicitly verify that the user email is confirmed in auth.users
    SELECT email, email_confirmed_at
    INTO v_email, v_email_confirmed_at
    FROM auth.users
    WHERE id = v_uid;

    IF v_email IS NULL THEN
        RAISE EXCEPTION 'Access denied: Authenticated user has no registered email address.';
    END IF;

    IF v_email_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Access denied: Email address "%" must be confirmed before claiming staff access.', v_email;
    END IF;

    -- 3. Enforce Account Identity Immutability:
    -- Check if this auth.uid is ALREADY bound to a staff profile
    SELECT * INTO v_existing_profile_for_uid
    FROM public.user_profiles
    WHERE auth_user_id = v_uid;

    IF v_existing_profile_for_uid.id IS NOT NULL THEN
        -- Prevent role jumping: if auth.users email was changed, do not allow re-binding to a different profile
        IF LOWER(v_existing_profile_for_uid.email) <> LOWER(v_email) THEN
            RAISE EXCEPTION 'Security violation: Account identity was modified. Staff role cannot be transferred across email addresses.';
        END IF;

        -- Return legitimate existing profile idempotently
        RETURN jsonb_build_object(
            'success', true,
            'profile_id', v_existing_profile_for_uid.id,
            'role_id', v_existing_profile_for_uid.role_id,
            'full_name', v_existing_profile_for_uid.full_name,
            'email', v_existing_profile_for_uid.email,
            'is_active', v_existing_profile_for_uid.is_active
        );
    END IF;

    -- 4. Check whether an administrator has directly bound this user
    SELECT * INTO v_bound_profile
    FROM public.user_profiles
    WHERE LOWER(email) = LOWER(v_email)
      AND auth_user_id = v_uid
      AND is_active = TRUE;

    IF v_bound_profile.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'profile_id', v_bound_profile.id,
            'role_id', v_bound_profile.role_id,
            'full_name', v_bound_profile.full_name,
            'email', v_bound_profile.email,
            'is_active', v_bound_profile.is_active
        );
    END IF;

    -- 5. First-Administrator Bootstrap Fallback:
    -- If no active administrator currently exists in the system, allow one-time bootstrapping
    -- using the database parameter configured outside the repository.
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE role_id = 'admin'
          AND auth_user_id IS NOT NULL
          AND is_active = TRUE
    ) INTO v_has_active_admin;

    IF NOT v_has_active_admin THEN
        v_configured_secret := NULLIF(TRIM(current_setting('app.settings.admin_bootstrap_secret', true)), '');
        IF v_configured_secret IS NOT NULL AND p_provisioning_code IS NOT NULL AND TRIM(p_provisioning_code) = v_configured_secret THEN
            INSERT INTO public.user_profiles (email, full_name, role_id, is_active, auth_user_id, updated_at)
            VALUES (LOWER(v_email), 'Administrator', 'admin', TRUE, v_uid, NOW())
            ON CONFLICT (email) DO UPDATE
            SET auth_user_id = v_uid,
                role_id = 'admin',
                is_active = TRUE,
                updated_at = NOW()
            RETURNING * INTO v_bound_profile;

            RETURN jsonb_build_object(
                'success', true,
                'message', 'First administrator successfully bootstrapped.',
                'profile_id', v_bound_profile.id,
                'role_id', 'admin',
                'email', v_bound_profile.email
            );
        END IF;
    END IF;

    -- 6. Atomic Staff Invitation Claiming:
    IF p_provisioning_code IS NULL OR TRIM(p_provisioning_code) = '' THEN
        RAISE EXCEPTION 'Access denied: A valid staff provisioning code is required to claim this profile.';
    END IF;

    v_code_hash := encode(sha256(TRIM(p_provisioning_code)::bytea), 'hex');

    -- Acquire exclusive row lock on matching invitation
    SELECT * INTO v_invite
    FROM public.staff_invitations
    WHERE LOWER(email) = LOWER(v_email)
    FOR UPDATE;

    IF v_invite.id IS NULL THEN
        RAISE EXCEPTION 'Access denied: No authorized staff invitation exists for "%". Privileged accounts must be explicitly provisioned by an administrator.', v_email;
    END IF;

    -- Verify invitation is unclaimed while holding row lock
    IF v_invite.is_claimed THEN
        RAISE EXCEPTION 'Access denied: Staff invitation for "%" has already been claimed.', v_email;
    END IF;

    -- Verify invitation is not expired while holding row lock
    IF v_invite.expires_at <= NOW() THEN
        RAISE EXCEPTION 'Access denied: Staff invitation for "%" has expired.', v_email;
    END IF;

    -- Verify provisioning code hash
    IF v_invite.provisioning_code_hash <> v_code_hash THEN
        RAISE EXCEPTION 'Access denied: Invalid staff provisioning code.';
    END IF;

    -- Conditional atomic claim update
    UPDATE public.staff_invitations
    SET is_claimed = TRUE,
        claimed_at = NOW(),
        claimed_by = v_uid
    WHERE id = v_invite.id
      AND is_claimed = FALSE
      AND expires_at > NOW();

    -- Verify exactly one row was updated
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated <> 1 THEN
        RAISE EXCEPTION 'Concurrent update detected: Staff invitation was claimed or modified by another transaction.';
    END IF;

    -- Claim and bind staff profile atomically
    INSERT INTO public.user_profiles (email, full_name, role_id, is_active, auth_user_id, updated_at)
    VALUES (LOWER(v_email), v_invite.full_name, v_invite.role_id, TRUE, v_uid, NOW())
    ON CONFLICT (email) DO UPDATE
    SET auth_user_id = v_uid,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = TRUE,
        updated_at = NOW()
    RETURNING * INTO v_bound_profile;

    RETURN jsonb_build_object(
        'success', true,
        'profile_id', v_bound_profile.id,
        'role_id', v_bound_profile.role_id,
        'full_name', v_bound_profile.full_name,
        'email', v_bound_profile.email,
        'is_active', v_bound_profile.is_active
    );
END;
$$;

REVOKE ALL ON FUNCTION public.bind_staff_auth_user(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bind_staff_auth_user(TEXT) TO authenticated;

-- ============================================================================
-- 3. ORDERS TABLE SCHEMA ENHANCEMENT & CSPRNG BACKFILL
-- ============================================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS guest_access_token TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_guest_access_token
ON public.orders (guest_access_token);

-- Backfill legacy records using multi-source entropy CSPRNG
UPDATE public.orders
SET guest_access_token = encode(sha256((gen_random_uuid()::text || clock_timestamp()::text || random()::text || id::text)::bytea), 'hex')
WHERE guest_access_token IS NULL;

-- Synchronize guest_access_token_hash with guest_access_token for all orders
UPDATE public.orders
SET guest_access_token_hash = encode(sha256(guest_access_token::bytea), 'hex')
WHERE guest_access_token IS NOT NULL
  AND (guest_access_token_hash IS NULL OR guest_access_token_hash != encode(sha256(guest_access_token::bytea), 'hex'));

-- ============================================================================
-- 4. RATE-LIMITING TABLE FOR GUEST ORDER LOOKUPS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.guest_lookup_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    attempt_count INT NOT NULL DEFAULT 1,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_guest_lookup_attempts_order
ON public.guest_lookup_attempts (order_number);

-- Restricted: only accessible through SECURITY DEFINER RPCs
REVOKE ALL ON public.guest_lookup_attempts FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 5. PLACE ORDER RPC (DUAL TOKEN PERSISTENCE + CSPRNG GENERATION)
-- ============================================================================

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

    -- 10. Insert Parent Order Record (Storing raw token + hash for QR & live access)
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
        'UNPAID',
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
            RAISE EXCEPTION 'Menu item not found with ID: %', v_menu_item_id;
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
                IF v_addon_elem->>'id' IS NOT NULL AND TRIM(v_addon_elem->>'id') <> '' THEN
                    BEGIN
                        v_addon_id := (v_addon_elem->>'id')::UUID;
                        IF NOT (v_addon_id = ANY(v_addon_ids_seen)) THEN
                            SELECT * INTO v_addon FROM public.menu_item_addons WHERE id = v_addon_id AND menu_item_id = v_menu_item_id;
                            IF FOUND THEN
                                v_addon_ids_seen := array_append(v_addon_ids_seen, v_addon.id);
                                v_addon_names := array_append(v_addon_names, v_addon.name);
                                v_item_addons_total := v_item_addons_total + v_addon.price;
                                v_validated_addons := v_validated_addons || jsonb_build_object(
                                    'id', v_addon.id,
                                    'name', v_addon.name,
                                    'price', v_addon.price
                                );
                            END IF;
                        END IF;
                    EXCEPTION WHEN invalid_text_representation THEN
                        -- Ignore malformed addon UUIDs gracefully
                    END;
                END IF;
            END LOOP;
        END IF;

        v_item_unit_price := v_item_unit_price + v_item_addons_total;
        v_item_subtotal := ROUND((v_item_unit_price * v_qty)::numeric, 2);
        v_order_subtotal := v_order_subtotal + v_item_subtotal;
        v_item_notes := NULLIF(TRIM(COALESCE(v_item_elem->>'special_instructions', v_item_elem->>'notes', '')), '');

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
-- 6. GET ADMIN ORDERS RPC (LEAST-PRIVILEGE FIELD MASKING PER ROLE)
-- ============================================================================

-- Drop all legacy overloads
DROP FUNCTION IF EXISTS public.get_admin_orders(TEXT, INT);
DROP FUNCTION IF EXISTS public.get_admin_orders(TEXT, INT, TEXT, TEXT);

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
    v_uid UUID := auth.uid();
    v_caller_role TEXT;
    v_result JSONB;
BEGIN
    -- 1. Strictly require an authenticated Supabase Auth session with confirmed email
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Access denied: Valid Supabase Auth credentials required.';
    END IF;

    -- 2. Verify active staff role linked to auth.uid with confirmed email
    SELECT up.role_id INTO v_caller_role
    FROM public.user_profiles up
    JOIN auth.users au ON au.id = up.auth_user_id
    WHERE up.auth_user_id = v_uid
      AND up.is_active = TRUE
      AND au.email_confirmed_at IS NOT NULL;

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'manager', 'cashier', 'waiter', 'kitchen') THEN
        RAISE EXCEPTION 'Access denied: Account does not have an active internal staff role.';
    END IF;

    -- 3. Return internal order records for verified staff with least-privilege field masking:
    -- 'admin', 'manager', 'cashier' have billing authority and need guest_access_token for receipt QR generation.
    -- 'waiter' and 'kitchen' have zero billing need for bearer tracking tokens and sensitive customer contact info.
    SELECT COALESCE(jsonb_agg(order_row ORDER BY (order_row->>'created_at') DESC), '[]'::jsonb)
    INTO v_result
    FROM (
        SELECT jsonb_build_object(
            'id', o.id,
            'order_number', o.order_number,
            -- Least Privilege: Only billing roles (admin, manager, cashier) receive raw bearer token
            'guest_access_token', CASE
                WHEN v_caller_role IN ('admin', 'manager', 'cashier') THEN o.guest_access_token
                ELSE NULL
            END,
            'order_type', o.order_type,
            'table_id', o.table_id,
            'table_number_snapshot', o.table_number_snapshot,
            'pickup_time_slot', o.pickup_time_slot,
            'pickup_slot_snapshot', COALESCE(o.pickup_slot_snapshot, o.pickup_time_slot),
            'pickup_notes', o.pickup_notes,
            'customer_id', o.customer_id,
            'customer_name_snapshot', o.customer_name_snapshot,
            -- Mask customer mobile for kitchen and waiter
            'customer_mobile_snapshot', CASE
                WHEN v_caller_role IN ('admin', 'manager', 'cashier') THEN o.customer_mobile_snapshot
                ELSE 'XXXXXX' || RIGHT(regexp_replace(COALESCE(o.customer_mobile_snapshot, ''), '\D', '', 'g'), 4)
            END,
            -- Mask customer email for kitchen and waiter
            'customer_email_snapshot', CASE
                WHEN v_caller_role IN ('admin', 'manager', 'cashier') THEN o.customer_email_snapshot
                ELSE NULL
            END,
            'subtotal', o.subtotal,
            'discount_amount', o.discount_amount,
            'discount_code', CASE
                WHEN v_caller_role IN ('admin', 'manager', 'cashier') THEN o.discount_code
                ELSE NULL
            END,
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
                    'unit_price_snapshot', oi.unit_price,
                    'quantity', oi.quantity,
                    'total_price', (oi.unit_price * oi.quantity),
                    'variant_id', oi.variant_id,
                    'variant_name_snapshot', oi.variant_name_snapshot,
                    'selected_addons', oi.selected_addons,
                    'addon_names_snapshot', oi.addon_names_snapshot,
                    'addons_total', oi.addons_total,
                    'item_subtotal', oi.item_subtotal,
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

-- Revoke all access from public and anon
REVOKE ALL ON FUNCTION public.get_admin_orders(TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_orders(TEXT, INT) FROM anon;

-- Grant execution ONLY to authenticated users
GRANT EXECUTE ON FUNCTION public.get_admin_orders(TEXT, INT) TO authenticated;

-- ============================================================================
-- 7. GET ORDER BY ACCESS TOKEN RPC (CUSTOMER ORDER TRACKING VIA QR BEARER TOKEN)
-- ============================================================================

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
            'guest_access_token', COALESCE(o.guest_access_token, p_access_token),
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
            'status', o.order_status,
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
                'unit_price_snapshot', oi.unit_price,
                'quantity', oi.quantity,
                'total_price', (oi.unit_price * oi.quantity),
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
    WHERE (o.id::text = p_order_id OR o.order_number = p_order_id)
      AND (
          o.guest_access_token_hash = v_token_hash
          OR o.guest_access_token = p_access_token
      );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.get_order_by_access_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_order_by_access_token(TEXT, TEXT) TO anon, authenticated;

-- ============================================================================
-- 8. LOOKUP GUEST ORDER RPC (RATE-LIMITED, DOES NOT DISCLOSE BEARER TOKENS)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.lookup_guest_order(
    p_order_number TEXT,
    p_mobile_number TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_clean_mobile TEXT;
    v_order_num TEXT;
    v_attempt public.guest_lookup_attempts%ROWTYPE;
    v_order public.orders%ROWTYPE;
    v_items JSONB;
BEGIN
    IF p_order_number IS NULL OR TRIM(p_order_number) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'MISSING_ORDER_NUMBER',
            'message', 'Order number is required.'
        );
    END IF;
    IF p_mobile_number IS NULL OR TRIM(p_mobile_number) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'MISSING_MOBILE_NUMBER',
            'message', '10-digit mobile number is required.'
        );
    END IF;

    v_order_num := UPPER(TRIM(regexp_replace(p_order_number, '^#', '')));
    v_clean_mobile := regexp_replace(p_mobile_number, '\D', '', 'g');

    -- Require full 10-digit mobile number to prevent partial guessing
    IF LENGTH(v_clean_mobile) < 10 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_MOBILE',
            'message', 'Please enter a valid 10-digit mobile number for order verification.'
        );
    END IF;

    -- 1. Check Rate Limiting & Lockout Status
    SELECT * INTO v_attempt FROM public.guest_lookup_attempts WHERE order_number = v_order_num;
    IF FOUND AND v_attempt.locked_until IS NOT NULL AND v_attempt.locked_until > NOW() THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'RATE_LIMITED',
            'message', 'Too many failed verification attempts for this order. Please try again in ' ||
                       CEIL(EXTRACT(EPOCH FROM (v_attempt.locked_until - NOW())) / 60.0)::TEXT || ' minutes, or scan your bill QR code.'
        );
    END IF;

    -- 2. Fetch Target Order
    SELECT * INTO v_order
    FROM public.orders
    WHERE UPPER(TRIM(order_number)) = v_order_num
       OR id::text = p_order_number;

    IF v_order.id IS NULL THEN
        -- Record failed attempt to protect against order enumeration
        INSERT INTO public.guest_lookup_attempts (order_number, attempt_count, last_attempt_at)
        VALUES (v_order_num, 1, NOW())
        ON CONFLICT (order_number) DO UPDATE
        SET attempt_count = public.guest_lookup_attempts.attempt_count + 1,
            last_attempt_at = NOW(),
            locked_until = CASE
                WHEN public.guest_lookup_attempts.attempt_count + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'NOT_FOUND',
            'message', 'Order not found. Please check your order number.'
        );
    END IF;

    -- 3. Verify Exact 10-Digit Mobile Number Match
    IF RIGHT(regexp_replace(COALESCE(v_order.customer_mobile_snapshot, ''), '\D', '', 'g'), 10) = RIGHT(v_clean_mobile, 10) THEN
        -- Verification SUCCESS: Reset rate limit attempts
        DELETE FROM public.guest_lookup_attempts WHERE order_number = v_order_num;

        -- Fetch order items for the verified customer receipt view
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', oi.id,
            'order_id', oi.order_id,
            'menu_item_id', oi.menu_item_id,
            'item_name_snapshot', oi.item_name_snapshot,
            'is_veg', oi.is_veg,
            'unit_price', oi.unit_price,
            'quantity', oi.quantity,
            'total_price', (oi.unit_price * oi.quantity),
            'variant_name_snapshot', oi.variant_name_snapshot,
            'selected_addons', oi.selected_addons,
            'item_subtotal', oi.item_subtotal
        ) ORDER BY oi.created_at ASC), '[]'::jsonb)
        INTO v_items
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id;

        -- Return customer order status WITHOUT disclosing the raw bearer guest_access_token
        RETURN jsonb_build_object(
            'success', true,
            'order', jsonb_build_object(
                'id', v_order.id,
                'order_number', v_order.order_number,
                'order_type', v_order.order_type,
                'table_number_snapshot', v_order.table_number_snapshot,
                'pickup_time_slot', v_order.pickup_time_slot,
                'pickup_slot_snapshot', COALESCE(v_order.pickup_slot_snapshot, v_order.pickup_time_slot),
                'customer_name_snapshot', v_order.customer_name_snapshot,
                'customer_mobile_snapshot', 'XXXXXX' || RIGHT(v_clean_mobile, 4),
                'subtotal', v_order.subtotal,
                'discount_amount', v_order.discount_amount,
                'tax_amount', v_order.tax_amount,
                'tax_breakdown', v_order.tax_breakdown,
                'total_amount', v_order.total_amount,
                'payment_method', v_order.payment_method,
                'payment_status', v_order.payment_status,
                'order_status', v_order.order_status,
                'status', v_order.order_status,
                'created_at', v_order.created_at,
                'updated_at', v_order.updated_at,
                'items', v_items
            )
        );
    ELSE
        -- Verification FAILED: Increment attempt count and trigger rate limit lockout if threshold reached
        INSERT INTO public.guest_lookup_attempts (order_number, attempt_count, last_attempt_at)
        VALUES (v_order_num, 1, NOW())
        ON CONFLICT (order_number) DO UPDATE
        SET attempt_count = public.guest_lookup_attempts.attempt_count + 1,
            last_attempt_at = NOW(),
            locked_until = CASE
                WHEN public.guest_lookup_attempts.attempt_count + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
                ELSE NULL
            END;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'VERIFICATION_FAILED',
            'message', 'The mobile number provided did not match the registered number for this order.'
        );
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_guest_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_guest_order(TEXT, TEXT) TO anon, authenticated;

COMMIT;
