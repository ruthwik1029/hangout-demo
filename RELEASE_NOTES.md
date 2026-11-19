# HANGOUT — Release Notes (v1.0.0-showcase)
**Platform:** HANGOUT Restaurant Digital Platform
**Target Environment:** Client Showcase Demo & Cloud Deployment (Vercel / Supabase)
**Release Date:** November 19, 2026
**Status:** **READY FOR RELEASE**
---
## 1. Release Overview
HANGOUT has been transformed into a restaurant ordering and management platform focused on authentic flame-roasted chicken shawarma, Chicken Murtabak, and crispy chicken starters.
This release represents a client showcase demo with end-to-end functionality across customer QR dining, self-pickup takeaway ordering, floor staff operations, kitchen ticket execution (KDS), and administrative oversight.
---
## 2. Core Functional Highlights
### 🍗 1. Shawarma-Focused Restaurant Identity & Catalog
- **Active Menu:** Exactly 13 confirmed items across 4 categories:
  1. `Shawarma - With Salad` (Classic, Grilled, Cheese)
  2. `Shawarma - No Salad (All Meat)` (Classic, Grilled, Cheese Blast)
  3. `Chicken Murtabak` (Classic, Cheese, Spicy Peri-Peri)
  4. `Chicken Starters` (Peri-Peri Strips, Tikka Skewers, Popcorn Bites, BBQ Wings)
- **Zero Unrelated Remnants:** All cafe, coffee, burger, and pizza items removed.
- **Verified Visuals:** All menu items and categories are mapped to verified high-resolution food assets (HTTP 200 OK).
### 🛍️ 2. Customer Ordering & Self-Pickup Policy
- **Dual Ordering Modes:**
  - **Dine-In:** QR table ordering with table context persistence (`T-01` through `T-08`).
  - **Takeaway (Self-Pickup Only):** Explicit customer-facing policy across navigation, cart, and checkout:
    > *"Pickup only. HANGOUT does not provide home delivery. You can collect your order yourself, send someone to collect it, or arrange a Rapido ride from your end."*
  - **Cart Isolation:** Independent dining and takeaway carts to prevent state leakage.
### 💳 3. Demo Payment Simulation
- **Isolated Payment Sandbox:**
  - **UPI Simulation:** GPay, PhonePe, Paytm with instant demo confirmation.
  - **Card Simulation:** Visa, Mastercard, RuPay.
  - **Cash at Counter:** Settle bills at cashier desk or table.
- **Clear Demonstration Warnings:** Labeled with `"Demo Simulation"` and explicit warnings that no real bank accounts are charged.
### 🛡️ 4. Role-Based Access Control (RBAC)
Exactly four visible operational roles exposed in `/auth/portal-login`:
- **Admin (`admin`):** Full system control, GST settings, restaurant configuration, menu editing, and table/order management.
- **Manager (`manager`):** Restaurant operations, reporting, staff oversight, and live order tracking.
- **Cashier (`cashier`):** Counter billing, payment collection, split-bill settlements, and cash reconciliation.
- **Staff (`waiter`):** Floor table service, dining order approval/rejection, order placement, and **KDS kitchen food preparation**.
- *Note:* Kitchen Staff is consolidated under Staff permissions (`PREPARE_FOOD`) without weakening RBAC safeguards (Staff cannot edit menu or alter restaurant settings).
### 🔥 5. Kitchen Display System (KDS)
- Live cooking queue at `/kitchen` with real-time station routing (`Shawarma Spit`, `Murtabak Griddle`, `Grills & Starters`, `Dispatch`).
- Pending dining orders must be approved by Floor Staff before entering the kitchen cooking queue.
- Tickets progress through `PENDING` → `CONFIRMED` → `PREPARING` → `READY` → `SERVED` / `COMPLETED`.
---
## 3. Database Security & Architecture
- **Row Level Security (RLS):** Anonymous users cannot harvest customer orders, mobile numbers, emails, or payments (`42501 permission denied`).
- **Safe Session Strategy:** Cryptographic session tokens (`hg_...`); mobile numbers are used as contact information, not authentication credentials.
- **Clean Remote Database:** Live Supabase database contains zero fake customer profiles, zero mock orders, and zero fake reservations.
---
## 4. Known Limitations & Architecture Notes
1. **Local Catalog Fallback:** Remote Supabase `menu_categories` and `menu_items` tables are currently clean/empty (0 rows). The showcase application automatically loads the verified 13-item shawarma catalog from `src/lib/mockData.ts`. When the owner populates the remote catalog, the application seamlessly switches to remote items.
2. **Remote Kitchen Station Labels:** The remote Supabase database contains 4 station records with generic Batch 03 placeholder labels (`MAIN_KITCHEN`, `BEVERAGE`, `BAKERY`, `DESSERT`). The local fallback provides authentic shawarma stations (`SHAWARMA`, `MURTABAK`, `STARTERS`, `DISPATCH`). Preserved without remote modifications to respect the read-only audit boundary.
3. **Nutritional & Portion Approximations:** Approximate calorie figures and portion weights (e.g., 150g Box / 300g Bucket) are showcase demonstration values awaiting kitchen scale and dietician validation.
4. **GST Default:** Remote `tax_configurations` has `is_gst_enabled: false` (0% rate) until the owner enters their valid GSTIN in the Admin Settings portal.
---
## 5. Verification Status
```
Vitest Test Suite:       55 / 55 passed (100%)
TypeScript Compilation:  0 errors
ESLint (oxlint):         0 errors (19 non-blocking warnings)
Production Build:        Built in 5.53s (Vite + Rolldown chunks)
```
