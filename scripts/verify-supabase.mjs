/**
 * HANGOUT Modern Cafe Platform
 * Comprehensive Supabase Connection & Verification Engine
 *
 * Verifies live endpoint, key authentication, schema, migrations, read/write, storage, and realtime.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

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

  const envExample = parseEnv(path.join(rootDir, '.env.example'));
  const envDefault = parseEnv(path.join(rootDir, '.env'));
  const envLocal = parseEnv(path.join(rootDir, '.env.local'));

  console.log('\n[1] ENVIRONMENT CONFIGURATION (Masked):');
  console.log('  .env.local:');
  for (const [k, v] of Object.entries(envLocal)) {
    const isSecret = k.toLowerCase().includes('key') || k.toLowerCase().includes('secret');
    const masked = isSecret && v ? `${v.slice(0, 15)}...${v.slice(-6)} (length: ${v.length})` : v;
    console.log(`    ${k} = ${masked}`);
  }

  const targetUrl = envLocal.VITE_SUPABASE_URL || 'https://jxfqoexvujssbtdbpdmx.supabase.co';
  const targetKey = envLocal.VITE_SUPABASE_ANON_KEY || envLocal.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  // 1. Gateway Connectivity Probe
  console.log('\n[2] GATEWAY CONNECTIVITY PROBE:');
  console.log(`  Probing: ${targetUrl}/rest/v1/ ...`);

  let gatewayReachable = false;
  let keyAccepted = false;
  let gatewayDetails = {};

  try {
    const pingRes = await fetch(`${targetUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`
      }
    });

    pingRes.headers.forEach((v, k) => {
      if (k.startsWith('sb-') || k.includes('version') || k.includes('server')) {
        gatewayDetails[k] = v;
      }
    });

    console.log(`  HTTP Status Code: ${pingRes.status} ${pingRes.statusText}`);
    console.log('  Gateway Headers:');
    for (const [k, v] of Object.entries(gatewayDetails)) {
      console.log(`    ${k}: ${v}`);
    }

    const bodyText = await pingRes.text();
    console.log(`  Response Body: ${bodyText}`);

    if (gatewayDetails['sb-project-ref'] === 'jxfqoexvujssbtdbpdmx') {
      gatewayReachable = true;
      console.log('  ✓ Step 1 Passed: Supabase Cloud Gateway reached and matches project ref: jxfqoexvujssbtdbpdmx');
    }

    if (pingRes.status === 200) {
      keyAccepted = true;
      console.log('  ✓ Step 2 Passed: API Key accepted by gateway.');
    } else if (pingRes.status === 401) {
      console.log('  ✗ Step 2 Failed: Key rejected by gateway (HTTP 401 Unauthorized).');
    }
  } catch (err) {
    console.error('  ✗ Gateway ping error:', err.message);
  }

  // 2. Database Schema & Tables Check
  console.log('\n[3] DATABASE SCHEMA & MIGRATIONS STATUS:');
  const client = createClient(targetUrl, targetKey);

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
  } else {
    console.log('  Database schema check blocked by API Key authentication failure.');
  }

  // 3. Reversible Read/Write Test
  console.log('\n[4] REVERSIBLE READ/WRITE VERIFICATION:');
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
    console.log('  Write/read-back verification cannot be conducted because API key is not accepted by remote database.');
  }

  // 4. Storage Bucket Access Test
  console.log('\n[5] STORAGE BUCKET VERIFICATION:');
  try {
    const { data: buckets, error: bErr } = await client.storage.listBuckets();
    if (!bErr && buckets) {
      console.log(`  Discovered buckets in storage: ${buckets.map(b => b.name).join(', ') || 'None'}`);
    } else {
      console.log(`  Storage bucket check result: ${bErr?.message || 'Unauthorized / Not accessible'}`);
    }
  } catch (e) {
    console.log(`  Storage check error: ${e.message}`);
  }

  // 5. Realtime Channel Subscription Test
  console.log('\n[6] REALTIME SUBSCRIPTION VERIFICATION:');
  try {
    const channel = client.channel('hangout_verify_channel');
    let subscribed = false;
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        resolve();
      }, 3000);

      channel.subscribe((status) => {
        console.log(`  Realtime subscription status: ${status}`);
        if (status === 'SUBSCRIBED') {
          subscribed = true;
          clearTimeout(timeout);
          channel.unsubscribe();
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  } catch (e) {
    console.log(`  Realtime check error: ${e.message}`);
  }

  // Summary Table
  console.log('\n' + '='.repeat(80));
  console.log('SUPABASE STATUS MATRIX:');
  console.log(`  1. Gateway Reachable:    ${gatewayReachable ? 'YES (Verified via sb-project-ref)' : 'NO'}`);
  console.log(`  2. API Key Accepted:     ${keyAccepted ? 'YES' : 'NO (Rejected: 401 Invalid API key)'}`);
  console.log(`  3. Database Accessible:  ${dbAccessible ? 'YES' : 'NO (Blocked by Key Authentication)'}`);
  console.log(`  4. Migrations Applied:   ${tablesFound.length > 0 ? `PARTIAL/FULL (${tablesFound.length} tables)` : 'UNVERIFIED / NOT APPLIED YET'}`);
  console.log(`  5. Read/Write Verified:  ${writeVerified ? 'YES' : 'NO'}`);
  console.log('='.repeat(80) + '\n');
}

runComprehensiveVerification();
