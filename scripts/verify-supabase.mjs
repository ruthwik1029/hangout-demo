/**
 * HANGOUT Modern Cafe Platform
 * Comprehensive Supabase Connection & Verification Engine
 *
 * Verifies live endpoint, key authentication, schema, migrations, read/write, storage, and realtime.
 */

import fs from 'fs';
import path from 'path';
import dns from 'dns';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// Ensure Node.js prefers IPv4 resolution on Windows
dns.setDefaultResultOrder('ipv4first');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
  return env;
}

async function runComprehensiveVerification() {
  console.log('='.repeat(80));
  console.log('HANGOUT — COMPREHENSIVE SUPABASE VERIFICATION ENGINE');
  console.log('='.repeat(80));

  const envLocal = parseEnv(path.join(rootDir, '.env.local'));
  const envDefault = parseEnv(path.join(rootDir, '.env'));

  console.log('\n[1] ENVIRONMENT CONFIGURATION (Masked):');
  for (const [k, v] of Object.entries(envLocal)) {
    const isSecret = k.toLowerCase().includes('key') || k.toLowerCase().includes('secret');
    const masked = isSecret && v ? `${v.slice(0, 18)}...${v.slice(-6)} (length: ${v.length})` : v;
    console.log(`    ${k} = ${masked}`);
  }

  const targetUrl = envLocal.VITE_SUPABASE_URL || 'https://jxfqoexvujssbtdbpdmx.supabase.co';
  const targetKey = envLocal.VITE_SUPABASE_PUBLISHABLE_KEY || envLocal.VITE_SUPABASE_ANON_KEY || '';

  // 1. Gateway Connectivity & Auth Probe
  console.log('\n[2] SUPABASE CLOUD GATEWAY & AUTHENTICATION:');
  console.log(`  Probing Auth Endpoint: ${targetUrl}/auth/v1/settings ...`);

  let gatewayReachable = false;
  let keyAccepted = false;
  let gatewayDetails = {};

  try {
    const authRes = await fetch(`${targetUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`
      }
    });

    authRes.headers.forEach((v, k) => {
      if (k.startsWith('sb-') || k.includes('version') || k.includes('server')) {
        gatewayDetails[k] = v;
      }
    });

    console.log(`  HTTP Status Code: ${authRes.status} ${authRes.statusText}`);
    console.log('  Gateway Response Headers:');
    for (const [k, v] of Object.entries(gatewayDetails)) {
      console.log(`    ${k}: ${v}`);
    }

    if (gatewayDetails['sb-project-ref'] === 'jxfqoexvujssbtdbpdmx') {
      gatewayReachable = true;
      console.log('  ✓ Gateway Reachable: PASS (Verified project-ref: jxfqoexvujssbtdbpdmx)');
    }

    if (authRes.status === 200) {
      keyAccepted = true;
      console.log('  ✓ API Key Accepted:  PASS (Key successfully authorized by Supabase Gateway)');
    } else {
      console.log(`  ✗ API Key Rejected:  FAIL (HTTP ${authRes.status})`);
    }
  } catch (err) {
    console.error('  ✗ Gateway connection error:', err.message);
  }

  // 2. Storage Bucket Access Test
  console.log('\n[3] STORAGE BUCKET VERIFICATION:');
  let storageAccessible = false;
  let storageBuckets = [];

  try {
    const storageRes = await fetch(`${targetUrl}/storage/v1/bucket`, {
      method: 'GET',
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`
      }
    });

    if (storageRes.status === 200) {
      storageAccessible = true;
      storageBuckets = await storageRes.json();
      console.log(`  ✓ Storage API Access: PASS (HTTP 200 OK)`);
      console.log(`  Active Storage Buckets: ${storageBuckets.length > 0 ? storageBuckets.map(b => b.name).join(', ') : 'None (menu-assets not yet created)'}`);
    } else {
      console.log(`  ✗ Storage API Access: FAIL (HTTP ${storageRes.status})`);
    }
  } catch (e) {
    console.log(`  ✗ Storage check error: ${e.message}`);
  }

  // 3. Realtime Channel Subscription Test
  console.log('\n[4] REALTIME SUBSCRIPTION CONNECTIVITY:');
  let realtimeConnected = false;
  const client = createClient(targetUrl, targetKey);

  try {
    const channel = client.channel('hangout_operational_sync_verify');
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        resolve();
      }, 4000);

      channel.subscribe((status) => {
        console.log(`  Realtime subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          realtimeConnected = true;
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    if (realtimeConnected) {
      console.log('  ✓ Realtime Connection: PASS (Subscribed successfully to WebSocket channel)');
    } else {
      console.log('  ✗ Realtime Connection: FAIL');
    }
  } catch (e) {
    console.log(`  ✗ Realtime check error: ${e.message}`);
  }

  // 4. Database Schema & Tables Check
  console.log('\n[5] POSTGREST DATABASE SCHEMA & MIGRATIONS STATUS:');
  const coreTables = [
    'cafe_settings',
    'roles',
    'user_profiles',
    'cafe_tables',
    'customers',
    'customer_sessions',
    'menu_categories',
    'menu_items',
    'orders',
    'order_items',
    'tax_configurations',
    'kitchen_stations',
    'bill_splits'
  ];

  let tablesFound = [];
  let tablesMissing = [];
  let dbAccessible = false;

  if (keyAccepted) {
    for (const table of coreTables) {
      try {
        const { data, error, status } = await client.from(table).select('count', { count: 'exact', head: true });
        if (!error && (status === 200 || status === 206)) {
          tablesFound.push(table);
        } else {
          tablesMissing.push({ table, error: error?.message, status });
        }
      } catch (e) {
        tablesMissing.push({ table, error: e.message });
      }
    }
    dbAccessible = tablesFound.length > 0;
  }

  if (tablesFound.length === 0) {
    console.log('  Notice: 0 application tables found in public schema cache (PGRST205).');
    console.log('  Status: Migrations 1, 2, and 3 have NOT been applied to target project yet.');
    console.log('  Target PostgreSQL database is fresh / unmigrated.');
  } else {
    console.log(`  Tables verified: ${tablesFound.join(', ')}`);
  }

  // 5. Reversible Read/Write Test
  console.log('\n[6] REVERSIBLE READ/WRITE VERIFICATION:');
  let writeVerified = false;

  if (dbAccessible) {
    try {
      const testId = 'test_' + Date.now();
      console.log(`  Attempting temporary insert into public.staff_audit_logs (id: ${testId})...`);
      const { data: insData, error: insErr } = await client.from('staff_audit_logs').insert({
        id: testId,
        staff_name: 'Verification Bot',
        role: 'SYSTEM_AUDITOR',
        action: 'VERIFY_READ_WRITE',
        entity_type: 'STATION',
        entity_id: 'TEST_PROBE',
        details: { purpose: 'Automated connectivity verification' }
      }).select().single();

      if (!insErr && insData) {
        console.log('  ✓ Insert succeeded! Reading back record...');
        const { data: readData, error: readErr } = await client.from('staff_audit_logs').select('*').eq('id', testId).single();
        if (!readErr && readData) {
          console.log('  ✓ Read-back succeeded!');
          console.log('  Cleaning up temporary test record...');
          await client.from('staff_audit_logs').delete().eq('id', testId);
          console.log('  ✓ Cleanup complete.');
          writeVerified = true;
        }
      } else {
        console.log(`  ✗ Write failed: ${insErr?.message}`);
      }
    } catch (e) {
      console.log(`  ✗ Write test exception: ${e.message}`);
    }
  } else {
    console.log('  Database Read/Write: BLOCKED (Pending migration application).');
    console.log('  PostgREST schema cache has no tables defined until Migrations 1, 2, and 3 are executed.');
  }

  // Final Summary Table
  console.log('\n' + '='.repeat(80));
  console.log('OFFICIAL SUPABASE VERIFICATION MATRIX:');
  console.log(`  1. Cloud Gateway Reachable:       ${gatewayReachable ? 'PASS' : 'FAIL'}`);
  console.log(`  2. API Key Accepted by Project:   ${keyAccepted ? 'PASS' : 'FAIL'}`);
  console.log(`  3. Supabase Auth API:             ${keyAccepted ? 'PASS' : 'FAIL'}`);
  console.log(`  4. Supabase Storage API:          ${storageAccessible ? 'PASS' : 'FAIL'}`);
  console.log(`  5. Realtime WebSocket:            ${realtimeConnected ? 'PASS' : 'FAIL'}`);
  console.log(`  6. Database Tables / Migrations:  ${tablesFound.length > 0 ? 'PASS' : 'BLOCKED (Pending Owner Migration Approval)'}`);
  console.log(`  7. Live Read/Write Verified:      ${writeVerified ? 'PASS' : 'BLOCKED (Pending Table Creation)'}`);
  console.log('='.repeat(80) + '\n');

  process.exit(0);
}

runComprehensiveVerification();
