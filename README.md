# HANGOUT — Authentic Shawarma, Murtabak & Chicken Starters Platform

HANGOUT is a modern restaurant digital platform engineered for authentic flame-roasted chicken shawarma, flaky pan-fried Chicken Murtabak, and crispy chicken starters. It features seamless QR table dining, rapid self-pickup takeaway ordering, floor staff operations, a Kitchen Display System (KDS), and comprehensive administrative controls.

---

## 🍗 Key Features & Scope

### 1. Unified Customer Web Application
- **Brand Identity & Aesthetic:**
  - Modern street-food elegance with high-contrast palette: Primary Yellow (`#FFD600`), Pitch Black (`#111111`), Charcoal (`#202020`), and Warm White (`#FAFAF6`).
  - Typography: Space Grotesk (headings) and Inter (body).
  - Micro-animations powered by Framer Motion.
- **Shawarma-Focused Catalog (`/menu`):**
  - **4 Product Families:** Shawarma - With Salad, Shawarma - No Salad (All Meat), Chicken Murtabak, and Chicken Starters.
  - **13 Confirmed Products:** Hand-crafted rotisserie wraps, layered murtabaks, and crispy chicken tenders/wings.
  - **Customization Modal:** Wrap bread selection (Rumali Roti / Kubbos Pocket), portion sizes, extra toum/cheese addons, and live price recalculation.
  - **Real-Time Filters:** Category switching, search by ingredient/dish, FSSAI-style Veg-only filter, and sorting.

### 2. Dual Ordering Modes & Anti-Delivery Policy
- **Dining In (QR Table Ordering):**
  - Scanned via QR code (`/table/:tableNumber` or `?table=T-01`).
  - Context recognized and persisted across customer session.
- **Takeaway (Self-Pickup Only):**
  - Explicit customer notice across navigation, cart, and checkout:
    > *"Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end."*
- **Strict Cart Isolation:** Dining and takeaway carts remain completely independent.

### 3. Demo Payment Simulation
- **Payment Sandbox Options:**
  - **UPI Simulation:** GPay, PhonePe, Paytm with simulated instant approval.
  - **Card Simulation:** Visa, Mastercard, RuPay.
  - **Cash at Counter:** Supported for counter collection and table dining.
  - **Clear Sandbox Notice:** Labeled with `"Demo Simulation"` to reassure clients that no real bank accounts are charged.

### 4. Internal Portals & Role Architecture (`/auth/portal-login`)
Exactly four visible operational roles:
1. **Admin (`/admin`):** Full restaurant controls, GST tax configuration, menu catalog editor, orders list, and customer directory.
2. **Manager (`/admin`):** Operational oversight, daily reporting, staff monitoring, and live order management.
3. **Cashier (`/staff` Billing Tab):** Payment collection, table bill settlements, split billing, and cash reconciliation.
4. **Staff (`/staff` + `/kitchen`):** Table floor status, customer dining approval/rejection, manual waiter order creation, and **KDS food preparation queue**.

### 5. Kitchen Display System (KDS) (`/kitchen`)
- Multi-station live ticket dispatch (`Shawarma Spit`, `Murtabak Griddle`, `Grills & Starters`, `Dispatch`).
- Floor Staff approval gate for dining orders before kitchen cooking begins.
- Live ticket progression (`PREPARING` → `READY` → `COMPLETED`).

---

## 🗄️ Database Architecture (Supabase / PostgreSQL)

Database migrations are chronologically organized under `supabase/migrations/`:
- `20250101000000_initial_schema.sql`: Core schema (roles, user profiles, settings, tables, menu, customers, orders).
- `20250101000001_batch01_security_correction.sql`: Security correction and RLS tightening.
- `20250102000000_batch02_ordering_admin.sql`: Ordering engine, payment audit, GST calculation, and RLS customer data isolation.
- `20250103000000_batch03_staff_kds.sql`: Kitchen stations, multi-station routing, bill splitting, and staff audit trails.
- `20250104000000_demo_readiness_fix.sql`: Demo readiness fixes.

### Security Highlights
- **Customer Data Isolation:** Row Level Security (RLS) ensures anonymous callers cannot harvest customer profiles, mobile numbers, or order histories (`42501 permission denied`).
- **Cryptographic Sessions:** Token-based guest authorization without using phone numbers as authentication credentials.

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
Create `.env.local` from the template in `.env.example`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-publishable-key
VITE_CAFE_NAME=HANGOUT
```
*(Note: If left unset or set to placeholder, HANGOUT automatically runs using its high-fidelity built-in seed store with full state persistence).*

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Verification & Tests
```bash
# Unit & Integration Tests (55 tests)
npm run test

# TypeScript type check
npx tsc -b

# Linter
npm run lint

# Production Build
npm run build
```

---

## 🌐 Vercel Deployment Configuration

When deploying to Vercel:
1. **Framework Preset:** Vite
2. **Build Command:** `npm run build`
3. **Output Directory:** `dist`
4. **Environment Variables:**
   - `VITE_SUPABASE_URL`: Your Supabase Project URL (`https://<project-ref>.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase client publishable anon key
   - `VITE_CAFE_NAME`: `HANGOUT` (optional)
5. **SPA Rewrites:** Included in `vercel.json` to route all paths to `index.html`.

---

## 📋 Quality Verification Status
- ✅ **Vitest Test Suite:** 55 / 55 tests passing across 7 test files.
- ✅ **TypeScript Checks (`tsc -b`):** 0 errors.
- ✅ **Production Build (`vite build`):** 0 errors; clean chunks generated in 5.53s.
- ✅ **Linter (`oxlint`):** 0 errors (19 non-blocking warnings).
- ✅ **Security Audit:** Zero secrets or service-role keys bundled in frontend.
