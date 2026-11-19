# HANGOUT — Modern Cafe Digital Platform
> **Batch 01: Foundation + Complete Customer Website**

HANGOUT is a premium, youthful, modern cafe digital platform engineered for specialty coffee culture, artisanal bakery, gourmet smash burgers, and effortless dining experiences.

---

## ☕ Key Features & Implemented Scope

### 1. Unified Responsive Customer Website
- **Branding & Visual Design System:**
  - Modern cafe aesthetic with youthful elegance.
  - Color Palette: Primary Yellow (`#FFD600`), Primary Black (`#111111`), Charcoal (`#202020`), Warm White (`#FAFAF6`), Soft Yellow (`#FFF3A6`).
  - Typography: Space Grotesk (headings) & Inter (body text).
  - Lightweight, hardware-accelerated micro-animations powered by Framer Motion.
- **Customer Homepage:**
  - Dynamic Hero section with single-origin highlights.
  - Interactive Dining & Takeaway mode selector.
  - Curated Menu Categories preview.
  - Today's Specials (Chef's picks).
  - Popular at HANGOUT showcase with quick customization actions.
  - QR table ordering feature explanation.
  - Philosophy & About HANGOUT.
  - Cafe Contact, Timings (Mon-Fri 8am-11pm, Sat-Sun 8am-Midnight) & Indiranagar location details.
  - Comprehensive modern footer with anti-delivery guarantee notice.
- **Full Interactive Menu (`/menu`):**
  - Database-backed category filters.
  - Real-time search by dish title, ingredients, or allergens.
  - Veg-Only toggle with authentic FSSAI-style green dot indicator.
  - Sort by Featured, Price (Low to High, High to Low), or Preparation Time.
  - Food Item Customization modal with variants (e.g. Size, Milk Option), addons (e.g. Extra Espresso Shot, Truffle Aioli), special notes, and live price calculation.

### 2. Dual Ordering Modes & Cart Isolation
- **Dining In Mode:**
  - Default mode when table QR code is scanned (`/table/:tableNumber` or `?table=...`).
  - Table context is recognized and persisted across customer session.
  - Visual table badge in navbar and cart with table switching modal.
- **Takeaway Mode (Self-Pickup Only):**
  - Never advertises or offers home delivery.
  - Prominent customer-facing notice:
    > *"Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end."*
- **Strict Cart Isolation:**
  - Independent dining and takeaway carts. Adding items to a dining table order never leaks into or pollutes a self-pickup cart.

### 3. Safe Customer Registration & Session Strategy
- Simple frictionless customer check-in: Name + 10-digit mobile number (+ optional email).
- No OTP or password hurdles for fast cafe checkout demo.
- Cryptographically secure bearer token generated and stored in `customer_sessions`.
- Prevents treating a mobile number alone as proof of identity.
- Persisted profile reuse and visit timestamps.

### 4. Admin, Staff & Kitchen Foundations
- **Protected Route Architecture:**
  - `/admin`: Overview metrics, cafe configuration link, table layout.
  - `/admin/settings`: Centralized cafe settings, independent Dining/Takeaway availability toggles, GST configuration (5%), and Takeaway Notice editor.
  - `/staff`: Service crew station with 8 seeded cafe tables, QR identifiers, and occupancy states.
  - `/kitchen`: Kitchen Display System (KDS) board with active ticket queue, cooking timers, and dispatch actions.
- **Portal Role Switcher (`/auth/portal-login`):**
  - One-click testing across roles: `admin`, `manager`, `waiter`, `kitchen`.

---

## 🗄️ Database Architecture (Supabase / PostgreSQL)

Migrations and seed data are structured under `supabase/`:
- `supabase/migrations/20250101000000_initial_schema.sql`
- `supabase/seed.sql`

### Tables Included
1. `roles`: Role definitions and JSONB permissions.
2. `user_profiles`: Internal staff/admin users.
3. `cafe_settings`: Global configuration, GST rates, timings, and notices.
4. `cafe_tables`: Cafe tables with capacity, sections, and unique QR identifiers.
5. `customers`: Customer store with mobile number index and order metrics.
6. `customer_sessions`: Safe session bearer token store with expiration.
7. `menu_categories`: Categories with display order and icons.
8. `menu_items`: Items with base price, veg classification, prep time, calories, allergens.
9. `menu_item_variants`: Size, roast, and milk variants.
10. `menu_item_addons`: Extras with price adjustments.
11. `storage.buckets`: Storage bucket `menu-assets` configured for future image uploads.

### Row Level Security (RLS)
- Public read access for active categories, available menu items, variants, addons, tables, and cafe settings.
- Customer session bearer isolation for profile access.
- Role-based policy placeholders for staff updates.

---

## 🚀 Setup & Local Development

### 1. Prerequisites
- Node.js v18+ (tested on Node v22)
- npm v9+

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_CAFE_NAME=HANGOUT
```
*(Note: If left unset or set to placeholder, HANGOUT automatically runs using its high-fidelity built-in seed store with full state persistence).*

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Verification & Tests
```bash
# Run unit & integration tests
npm run test

# Run linter
npm run lint

# Run production build
npm run build
```

---

## 📋 Batch 01 Quality Verification Summary
- ✅ **TypeScript Checks (`tsc -b`):** 0 errors.
- ✅ **Production Build (`vite build`):** 0 errors; code-split into modern vendor, motion, supabase, and icon chunks.
- ✅ **Linter (`oxlint`):** 0 errors.
- ✅ **Test Suite (`vitest`):** 16 / 16 tests passing across 4 test suites.
- ✅ **Business Rules:** Takeaway pickup-only notice, 5% GST calculation, QR table entry, and dual cart isolation strictly verified.
- ✅ **Console Integrity:** Clean runtime with zero broken links or unhandled exceptions.
