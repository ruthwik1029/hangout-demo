import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CafeSettings, CafeTable, Customer, CustomerSession, MenuCategory, MenuItem, OrderMode } from '../types';
import { INITIAL_CAFE_SETTINGS, INITIAL_CATEGORIES, INITIAL_MENU_ITEMS, INITIAL_TABLES } from './mockData';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
  );
};

// Create client (with dummy values if not configured, preventing crash)
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// Local persistence storage keys
const LOCAL_STORAGE_CUSTOMERS = 'hangout_customers_store';
const LOCAL_STORAGE_SESSIONS = 'hangout_sessions_store';
const LOCAL_STORAGE_SETTINGS = 'hangout_settings_store';

// Helper for local mock storage
function getLocalStore<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setLocalStore<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
  }
}

// ---------------------------------------------------------------------------
// 1. Cafe Settings Repository
// ---------------------------------------------------------------------------
export async function fetchCafeSettings(): Promise<CafeSettings> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('cafe_settings')
        .select('*')
        .limit(1)
        .single();
      if (!error && data) {
        return data as CafeSettings;
      }
    } catch (e) {
      console.warn('Supabase fetchCafeSettings failed, falling back to local seed:', e);
    }
  }
  return getLocalStore<CafeSettings>(LOCAL_STORAGE_SETTINGS, INITIAL_CAFE_SETTINGS);
}

// ---------------------------------------------------------------------------
// 2. Menu Repository
// ---------------------------------------------------------------------------
export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('menu_categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as MenuCategory[];
      }
    } catch (e) {
      console.warn('Supabase fetchMenuCategories failed, using fallback:', e);
    }
  }
  return INITIAL_CATEGORIES;
}

export async function fetchMenuItems(): Promise<MenuItem[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          variants:menu_item_variants(*),
          addons:menu_item_addons(*)
        `)
        .eq('is_available', true)
        .order('display_order', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as MenuItem[];
      }
    } catch (e) {
      console.warn('Supabase fetchMenuItems failed, using fallback:', e);
    }
  }
  return INITIAL_MENU_ITEMS;
}

// ---------------------------------------------------------------------------
// 3. Cafe Tables Repository
// ---------------------------------------------------------------------------
export async function fetchCafeTables(): Promise<CafeTable[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('cafe_tables')
        .select('*')
        .eq('is_active', true)
        .order('table_number', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as CafeTable[];
      }
    } catch (e) {
      console.warn('Supabase fetchCafeTables failed, using fallback:', e);
    }
  }
  return INITIAL_TABLES;
}

export async function fetchTableByIdentifier(identifier: string): Promise<CafeTable | null> {
  const cleanId = identifier.trim().toLowerCase();
  const tables = await fetchCafeTables();
  return (
    tables.find(
      (t) =>
        t.table_number.toLowerCase() === cleanId ||
        t.qr_code_identifier.toLowerCase() === cleanId ||
        t.table_number.toLowerCase().replace('-', '') === cleanId
    ) || null
  );
}

// ---------------------------------------------------------------------------
// 4. Safe Customer Registration & Session Strategy
// ---------------------------------------------------------------------------
// Generate a safe, cryptographically unguessable session token
function generateSecureToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return 'hg_' + crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
  }
  return 'hg_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export async function registerOrFindCustomer(
  fullName: string,
  mobileNumber: string,
  email?: string
): Promise<Customer> {
  const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10); // Standardize 10 digits
  const cleanName = fullName.trim();
  const cleanEmail = email?.trim() || null;

  if (isSupabaseConfigured()) {
    try {
      // Look up existing customer by mobile
      const { data: existing, error: searchErr } = await supabase
        .from('customers')
        .select('*')
        .eq('mobile_number', cleanMobile)
        .maybeSingle();

      if (!searchErr && existing) {
        // Update visit timestamp & name if changed
        const { data: updated } = await supabase
          .from('customers')
          .update({
            full_name: cleanName,
            email: cleanEmail || existing.email,
            last_visit_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        return (updated as Customer) || (existing as Customer);
      }

      // Create new customer
      const { data: created, error: insertErr } = await supabase
        .from('customers')
        .insert({
          full_name: cleanName,
          mobile_number: cleanMobile,
          email: cleanEmail,
        })
        .select()
        .single();

      if (!insertErr && created) {
        return created as Customer;
      }
    } catch (e) {
      console.warn('Supabase registerOrFindCustomer failed, falling back to local:', e);
    }
  }

  // Local storage persistence
  const customers = getLocalStore<Customer[]>(LOCAL_STORAGE_CUSTOMERS, [
    {
      id: 'e0000000-0000-0000-0000-000000000001',
      full_name: 'Aarav Sharma',
      mobile_number: '9876543210',
      email: 'aarav.sharma@example.com',
      total_orders: 3,
      total_spent: 1840,
      last_visit_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ]);

  const existingIdx = customers.findIndex((c) => c.mobile_number === cleanMobile);
  if (existingIdx >= 0) {
    const existing = customers[existingIdx];
    const updated: Customer = {
      ...existing,
      full_name: cleanName,
      email: cleanEmail || existing.email,
      last_visit_at: new Date().toISOString(),
    };
    customers[existingIdx] = updated;
    setLocalStore(LOCAL_STORAGE_CUSTOMERS, customers);
    return updated;
  }

  const newCustomer: Customer = {
    id: 'cust_' + Date.now().toString(36),
    full_name: cleanName,
    mobile_number: cleanMobile,
    email: cleanEmail,
    total_orders: 0,
    total_spent: 0,
    last_visit_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  customers.push(newCustomer);
  setLocalStore(LOCAL_STORAGE_CUSTOMERS, customers);
  return newCustomer;
}

export async function createCustomerSession(
  customer: Customer,
  orderMode: OrderMode,
  table?: CafeTable | null
): Promise<CustomerSession> {
  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  const sessionObj: CustomerSession = {
    id: 'sess_' + Date.now().toString(36),
    session_token: token,
    customer_id: customer.id,
    table_id: table?.id || null,
    table_number: table?.table_number || null,
    order_mode: orderMode,
    device_info: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  };

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('customer_sessions').insert({
        session_token: token,
        customer_id: customer.id,
        table_id: table?.id || null,
        order_mode: orderMode,
        device_info: sessionObj.device_info,
        expires_at: expiresAt,
      });
    } catch (e) {
      console.warn('Supabase createCustomerSession failed, saving locally:', e);
    }
  }

  // Local storage sessions
  const sessions = getLocalStore<CustomerSession[]>(LOCAL_STORAGE_SESSIONS, []);
  sessions.push(sessionObj);
  setLocalStore(LOCAL_STORAGE_SESSIONS, sessions);

  return sessionObj;
}
