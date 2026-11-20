import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

let envUrl = '';
let envAnonKey = '';

try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      envUrl = trimmed.split('=')[1].trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      envAnonKey = trimmed.split('=')[1].trim();
    }
  }
} catch (e) {
  console.log('Error reading .env.local:', e.message);
}

console.log('Connecting read-only to Supabase:', envUrl);
const supabase = createClient(envUrl, envAnonKey);

async function runAudit() {
  console.log('=== REMOTE SUPABASE READ-ONLY AUDIT ===\n');

  // 1. Menu Categories
  const { data: categories, error: catErr } = await supabase
    .from('menu_categories')
    .select('id, name, slug, display_order, is_active')
    .order('display_order', { ascending: true });
  
  console.log('1. REMOTE MENU CATEGORIES:');
  if (catErr) {
    console.log('   Error querying menu_categories:', catErr.message);
  } else {
    console.log(`   Count: ${categories?.length || 0}`);
    categories?.forEach((c) => console.log(`   - [${c.id}] ${c.name} (slug: ${c.slug}, active: ${c.is_active})`));
  }

  // 2. Menu Items
  const { data: items, error: itemErr } = await supabase
    .from('menu_items')
    .select('id, name, base_price, category_id, is_available')
    .order('name');
  
  console.log('\n2. REMOTE MENU ITEMS:');
  if (itemErr) {
    console.log('   Error querying menu_items:', itemErr.message);
  } else {
    console.log(`   Count: ${items?.length || 0}`);
    items?.forEach((i) => console.log(`   - [${i.id}] ${i.name} (₹${i.base_price})`));
  }

  // 3. Customers
  const { data: customers, count: custCount, error: custErr } = await supabase
    .from('customers')
    .select('id, full_name, phone, email, created_at', { count: 'exact' });
  
  console.log('\n3. REMOTE CUSTOMERS:');
  if (custErr) {
    console.log('   Error querying customers:', custErr.message);
  } else {
    console.log(`   Count: ${customers?.length || 0}`);
    customers?.forEach((c) => console.log(`   - [${c.id}] ${c.full_name} (${c.phone || c.email})`));
  }

  // 4. Orders
  const { data: orders, error: orderErr } = await supabase
    .from('orders')
    .select('id, order_number, order_type, order_status, total_amount, created_at')
    .order('created_at', { ascending: false });
  
  console.log('\n4. REMOTE ORDERS:');
  if (orderErr) {
    console.log('   Error querying orders:', orderErr.message);
  } else {
    console.log(`   Count: ${orders?.length || 0}`);
    orders?.forEach((o) => console.log(`   - [${o.order_number}] Status: ${o.order_status}, Type: ${o.order_type}, Total: ₹${o.total_amount}`));
  }

  // 5. Payments
  const { data: payments, error: payErr } = await supabase
    .from('payments')
    .select('id, order_id, amount, payment_method, payment_status, created_at');
  
  console.log('\n5. REMOTE PAYMENTS:');
  if (payErr) {
    console.log('   Error querying payments:', payErr.message);
  } else {
    console.log(`   Count: ${payments?.length || 0}`);
    payments?.forEach((p) => console.log(`   - [${p.id}] Amount: ₹${p.amount}, Method: ${p.payment_method}, Status: ${p.payment_status}`));
  }

  // 6. Cafe Tables
  const { data: tables, error: tableErr } = await supabase
    .from('cafe_tables')
    .select('id, table_number, seating_capacity, status, is_active')
    .order('table_number');
  
  console.log('\n6. REMOTE CAFE TABLES:');
  if (tableErr) {
    console.log('   Error querying cafe_tables:', tableErr.message);
  } else {
    console.log(`   Count: ${tables?.length || 0}`);
    tables?.forEach((t) => console.log(`   - [${t.table_number}] Capacity: ${t.seating_capacity}, Status: ${t.status}, Active: ${t.is_active}`));
  }

  // 7. Check for reservations table
  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .select('id');
  console.log('\n7. REMOTE RESERVATIONS:');
  if (resErr) {
    console.log('   Reservations table status:', resErr.message);
  } else {
    console.log(`   Count: ${reservations?.length || 0}`);
  }
}

runAudit();
