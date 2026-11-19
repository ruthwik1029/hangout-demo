# HANGOUT — SUPABASE LIVE PROJECT CONNECTION & VERIFICATION REPORT

**Official Backend Integration & Architectural Audit**

- **Date:** November 19, 2026
- **Target Project Base URL:** `https://jxfqoexvujssbtdbpdmx.supabase.co`
- **Target Project REST URL:** `https://jxfqoexvujssbtdbpdmx.supabase.co/rest/v1/`
- **Target Project Reference:** `jxfqoexvujssbtdbpdmx`
- **Publishable Key (Sanitized):** `sb_publishable_kAp...umlWIw` (46 characters)
- **Local Storage Location:** [`.env.local`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/.env.local) (Protected & Git-ignored via `*.local`)

---

## 1. Official Connection Verification Matrix

Each architectural boundary was independently probed and evaluated:

| # | Verification Aspect | Result | Technical Evidence |
| :--- | :--- | :---: | :--- |
| **1** | **Cloud Gateway Connectivity** | **PASS** | Probed `https://jxfqoexvujssbtdbpdmx.supabase.co`. Cloudflare Edge and Supabase Gateway returned `HTTP 200 OK` with header `sb-project-ref: jxfqoexvujssbtdbpdmx`. |
| **2** | **API Key Acceptance by Project** | **PASS** | `sb_publishable_kAp...umlWIw` is recognized and authorized. `UNAUTHORIZED_INVALID_API_KEY` is completely resolved. |
| **3** | **Supabase Auth API** | **PASS** | Query to `/auth/v1/settings` returned `HTTP 200 OK` with external auth providers and settings payload. |
| **4** | **Supabase Storage API** | **PASS** | Query to `/storage/v1/bucket` returned `HTTP 200 OK` (`[]`), verifying storage engine readiness. |
| **5** | **Realtime WebSocket Channel** | **PASS** | WebSocket subscription to channel `hangout_operational_sync_verify` connected with state `SUBSCRIBED`. |
| **6** | **PostgREST Schema Access** | **PASS** | Requests are authenticated and routed to PostgreSQL PostgREST proxy (`Proxy-Status: PostgREST`). |
| **7** | **Database Tables Presence** | **BLOCKED** | PostgREST returned code `PGRST205` (`Could not find the table 'public.cafe_settings' in the schema cache`), confirming the target database is fresh and unmigrated. |
| **8** | **Reversible Read/Write Verification** | **BLOCKED** | Reversible insert/read-back is blocked because target tables do not yet exist in the remote `public` schema. |

---

## 2. Environment Configuration & Security Compliance

1. **Environment Conventions Preserved:**
   - Both `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_SUPABASE_ANON_KEY` are configured in [`.env.local`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/.env.local) to guarantee compatibility across all client modules without conflicts.
   - [`.env.local`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/.env.local) is strictly Git-ignored via `.gitignore` (`*.local`) and is not committed.
2. **Credential Hygiene:**
   - Zero credentials hardcoded in application source files.
   - Masked everywhere in console logs, audit scripts, and Markdown reports.
3. **Frontend Security Guardrail:**
   - [`src/lib/supabase.ts`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/src/lib/supabase.ts) actively validates that supplied keys are publishable. If a `service_role` key or secret key is ever supplied in client variables, an immediate runtime exception is thrown before any network call occurs.
4. **Transparent Failure Architecture:**
   - If a remote database call fails or returns an error, the repository layer throws an explicit `Error` and refuses to silently disguise the failure as a mock success.

---

## 3. Database Migration Inspection & Staging Plan

Per strict instructions:
> **Do not execute migrations automatically without authorization. Present the required migration execution plan for owner approval.**

### Migration Files Discovered:
1. **[`20250101000000_initial_schema.sql`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/supabase/migrations/20250101000000_initial_schema.sql) (13.4 KB):**
   - **Extensions:** `uuid-ossp`, `pgcrypto`.
   - **Tables:** `roles`, `user_profiles`, `cafe_settings`, `cafe_tables`, `customers`, `customer_sessions`, `menu_categories`, `menu_items`, `menu_item_variants`, `menu_item_addons`.
   - **Storage:** Declares public bucket `menu-assets` in `storage.buckets` and read policy in `storage.objects`.
   - **Security:** Enables RLS across all tables; defines customer and public policies.
2. **[`20250102000000_batch02_ordering_admin.sql`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/supabase/migrations/20250102000000_batch02_ordering_admin.sql) (15.8 KB):**
   - **Sequences:** `hangout_order_number_seq`, `hangout_txn_seq`.
   - **Tables:** `tax_configurations`, `tax_categories`, `discounts`, `orders`, `order_items`, `payments`, `payment_transactions`, `order_status_history`, `admin_audit_logs`, `pickup_settings`.
   - **Seeds:** Initial tax setup (5% GST), default discounts (`HANGOUT10`, `FIRSTBITE`, `COFFEELOVER`), and pickup policies.
3. **[`20250103000000_batch03_staff_kds.sql`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/supabase/migrations/20250103000000_batch03_staff_kds.sql) (8.5 KB):**
   - **Tables:** `kitchen_stations`, `bill_splits`, `staff_audit_logs`.
   - **Extensions:** Extends `cafe_tables` (`cleaning` status, waiter assignment, running bill, active order), `orders` (`READY_FOR_SERVICE`, `SERVED`, split bills, outstanding balance), and `order_items` (preparation lifecycle, station routing, timestamps).

### Migration Execution Plan (Awaiting Owner Approval):
To apply the schema safely to project `jxfqoexvujssbtdbpdmx`:
- **Option A (Supabase Dashboard SQL Editor - Recommended):**
  1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/jxfqoexvujssbtdbpdmx/sql).
  2. Paste and run [`20250101000000_initial_schema.sql`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/supabase/migrations/20250101000000_initial_schema.sql).
  3. Paste and run [`20250102000000_batch02_ordering_admin.sql`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/supabase/migrations/20250102000000_batch02_ordering_admin.sql).
  4. Paste and run [`20250103000000_batch03_staff_kds.sql`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/supabase/migrations/20250103000000_batch03_staff_kds.sql).
- **Option B (Supabase CLI):**
  ```bash
  supabase link --project-ref jxfqoexvujssbtdbpdmx
  supabase db push
  ```

---

## 4. GST & Bill Splitting Engine Verification

1. **Eliminated Hardcoded Rates:**
   - Removed any hardcoded `0.05` tax assumption in [`createBillSplits`](file:///c:/Users/Administrator/OneDrive/Desktop/hangout%20demo/src/lib/supabase.ts#L2410-L2465).
   - Taxes are computed from each item's immutable `tax_rate_snapshot` and proportional order tax.
2. **Reconciliation to Outstanding Balance:**
   - Both Equal Split, Item-Based Split, and Custom Split reconcile strictly to the remaining `order.outstanding_balance` down to the exact paisa ($|\text{sum} - \text{balance}| \le 0.01$).
   - Exact mathematical remainder distribution allocates unrounded paise ($totalPaise \pmod N$) across the first $k$ splits.

---

## 5. Quality Assurance & Test Verification

All local verification suites passed with zero regressions:

- **TypeScript Compilation (`npx tsc -b`):** **0 errors**
- **Vitest Automated Test Suite (`npx vitest run`):** **37 / 37 passed** across 6 test suites
  - `src/test/staff-kds-operations.test.ts` (14 passed)
  - `src/test/ordering-engine.test.ts` (7 passed)
  - `src/test/routes.test.tsx` (7 passed)
  - `src/test/business-rules.test.ts` (5 passed)
  - `src/test/session-strategy.test.ts` (3 passed)
  - `src/test/cart-isolation.test.tsx` (1 passed)
- **Linter (`npx oxlint`):** **0 errors**
- **Production Build (`npm run build`):** **Cleanly built in 2.30s**
- **Automated Verification Script (`node scripts/verify-supabase.mjs`):** **Executed and verified**

---

## 6. Summary of Remaining Blockers

- **Only Blocker:** Execution of the 3 database migration scripts against project `jxfqoexvujssbtdbpdmx` to instantiate the schema cache and tables.
- **Next Step:** Upon project owner approval, execute Migrations 1, 2, and 3 in the Supabase SQL Editor. Once executed, running `node scripts/verify-supabase.mjs` will automatically confirm live database reads and write-back verification.

*Batch 04 and Batch 05 have not been started. No code has been deployed to production or Vercel.*
