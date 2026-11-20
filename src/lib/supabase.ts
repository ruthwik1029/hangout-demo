import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CafeSettings,
  CafeTable,
  Customer,
  CustomerSession,
  MenuCategory,
  MenuItem,
  OrderMode,
  OrderType,
  CartItem,
  Order,
  OrderItem,
  OrderStatus,
  Payment,
  PaymentTransaction,
  PaymentMethod,
  PaymentStatus,
  TaxConfiguration,
  TaxCategory,
  TaxBreakdown,
  Discount,
  PickupSettings,
  AdminAuditLog,
  OrderStatusHistory,
  TableStatus,
  OrderItemStatus,
  KitchenStation,
  BillSplit,
  BillSplitType,
  StaffAuditLog,
  UserRole,
  UserProfile,
  AdminActivityLog,
} from '../types';
import {
  INITIAL_CAFE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_MENU_ITEMS,
  INITIAL_TABLES,
  INITIAL_TAX_CONFIG,
  INITIAL_TAX_CATEGORIES,
  INITIAL_DISCOUNTS,
  INITIAL_PICKUP_SETTINGS,
  INITIAL_ORDERS,
  INITIAL_CUSTOMERS,
  INITIAL_KITCHEN_STATIONS,
  DEMO_PROFILES,
  INITIAL_ADMIN_ACTIVITY,
} from './mockData';
import { publishRealtimeEvent } from './realtime';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

// Security safeguard: Prevent accidental exposure or usage of service_role key in client bundle
if (typeof window !== 'undefined' && supabaseAnonKey) {
  try {
    const payloadBase64 = supabaseAnonKey.split('.')[1];
    if (payloadBase64) {
      const decoded = JSON.parse(atob(payloadBase64));
      if (decoded.role === 'service_role') {
        throw new Error('SECURITY VIOLATION: Supabase service_role key must NEVER be exposed in frontend client code!');
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('SECURITY VIOLATION')) {
      throw err;
    }
  }
}

export const isSupabaseConfigured = (): boolean => {
  if (import.meta.env.MODE === 'test' && !import.meta.env.VITE_TEST_LIVE_SUPABASE) {
    return false;
  }
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder') &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('your-anon') &&
    (supabaseAnonKey.startsWith('sb_publishable_') || supabaseAnonKey.startsWith('eyJ'))
  );
};

export function getDataSourceMode(): 'supabase' | 'local_storage' {
  return isSupabaseConfigured() ? 'supabase' : 'local_storage';
}

export interface SupabaseConnectionHealth {
  isConfigured: boolean;
  url: string;
  projectRef: string;
  status: 'unconfigured' | 'connected' | 'auth_error' | 'network_error';
  message: string;
  testedAt: string;
  tablesChecked?: Record<string, boolean>;
}

export async function checkSupabaseConnectionHealth(): Promise<SupabaseConnectionHealth> {
  const configured = isSupabaseConfigured();
  const projectRef = supabaseUrl ? supabaseUrl.replace('https://', '').split('.')[0] : '';

  if (!configured) {
    return {
      isConfigured: false,
      url: supabaseUrl,
      projectRef,
      status: 'unconfigured',
      message: 'Supabase credentials are not configured or still contain placeholder values.',
      testedAt: new Date().toISOString(),
    };
  }

  try {
    const { data: _data, error, status } = await supabase
      .from('cafe_settings')
      .select('id, cafe_name')
      .limit(1);

    if (error) {
      if (status === 401 || error.message.includes('API key') || error.message.includes('JWT')) {
        return {
          isConfigured: true,
          url: supabaseUrl,
          projectRef,
          status: 'auth_error',
          message: `Authentication failed (HTTP ${status}): ${error.message}. Please verify the publishable/anon key for project ${projectRef}.`,
          testedAt: new Date().toISOString(),
        };
      }
      return {
        isConfigured: true,
        url: supabaseUrl,
        projectRef,
        status: 'network_error',
        message: `Supabase query returned error (${status}): ${error.message}`,
        testedAt: new Date().toISOString(),
      };
    }

    return {
      isConfigured: true,
      url: supabaseUrl,
      projectRef,
      status: 'connected',
      message: `Successfully connected to Supabase project ${projectRef} and verified read access.`,
      testedAt: new Date().toISOString(),
      tablesChecked: {
        cafe_settings: true,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isConfigured: true,
      url: supabaseUrl,
      projectRef,
      status: 'network_error',
      message: `Connection attempt failed: ${msg}`,
      testedAt: new Date().toISOString(),
    };
  }
}

// Create client (with dummy values if not configured, preventing crash)
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

// Local persistence storage keys
const LOCAL_STORAGE_CUSTOMERS = 'hangout_customers_store';
const LOCAL_STORAGE_SESSIONS = 'hangout_sessions_store';
const LOCAL_STORAGE_SETTINGS = 'hangout_settings_store';
const LOCAL_STORAGE_CATEGORIES = 'hangout_categories_store';
const LOCAL_STORAGE_MENU_ITEMS = 'hangout_menu_items_store';
const LOCAL_STORAGE_TAX_CONFIG = 'hangout_tax_config_store';
const LOCAL_STORAGE_TAX_CATEGORIES = 'hangout_tax_categories_store';
const LOCAL_STORAGE_DISCOUNTS = 'hangout_discounts_store';
const LOCAL_STORAGE_PICKUP_SETTINGS = 'hangout_pickup_settings_store';
const LOCAL_STORAGE_ORDERS = 'hangout_orders_store';
const LOCAL_STORAGE_PAYMENTS = 'hangout_payments_store';
const LOCAL_STORAGE_TRANSACTIONS = 'hangout_transactions_store';
const LOCAL_STORAGE_STATUS_HISTORY = 'hangout_status_history_store';
const LOCAL_STORAGE_AUDIT_LOGS = 'hangout_audit_logs_store';
const LOCAL_STORAGE_TABLES = 'hangout_tables_store';
const LOCAL_STORAGE_KITCHEN_STATIONS = 'hangout_stations_store';
const LOCAL_STORAGE_BILL_SPLITS = 'hangout_bill_splits_store';
const LOCAL_STORAGE_STAFF_AUDIT_LOGS = 'hangout_staff_audit_logs_store';
const LOCAL_STORAGE_STAFF_PROFILES = 'hangout_staff_profiles_store';
const LOCAL_STORAGE_ADMIN_ACTIVITY = 'hangout_admin_activity_store';

// Decimal-safe rounding helper
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function generateUUIDv4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function generateGuestToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'gat_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Helper for local mock storage
function getLocalStore<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : JSON.parse(JSON.stringify(defaultValue));
  } catch {
    return JSON.parse(JSON.stringify(defaultValue));
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

export async function saveCafeSettings(settings: CafeSettings): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('cafe_settings')
      .upsert(settings);
    if (error) {
      console.error('Supabase saveCafeSettings failed:', error);
      throw new Error(`Failed to save cafe settings to Supabase: ${error.message}`);
    }
    return true;
  }
  setLocalStore(LOCAL_STORAGE_SETTINGS, settings);
  return true;
}

// ---------------------------------------------------------------------------
// 2. Tax & GST Configuration Repository
// ---------------------------------------------------------------------------
export async function fetchTaxConfiguration(): Promise<TaxConfiguration> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('tax_configurations')
        .select('*')
        .limit(1)
        .single();
      if (!error && data) {
        return data as TaxConfiguration;
      }
    } catch (e) {
      console.warn('Supabase fetchTaxConfiguration failed, fallback:', e);
    }
  }
  return getLocalStore<TaxConfiguration>(LOCAL_STORAGE_TAX_CONFIG, INITIAL_TAX_CONFIG);
}

export async function saveTaxConfiguration(config: TaxConfiguration): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase
      .from('tax_configurations')
      .upsert(config);
    if (error) {
      console.error('Supabase saveTaxConfiguration failed:', error);
      throw new Error(`Failed to save tax configuration to Supabase: ${error.message}`);
    }
    return true;
  }
  setLocalStore(LOCAL_STORAGE_TAX_CONFIG, config);
  return true;
}

export async function fetchTaxCategories(): Promise<TaxCategory[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('tax_categories')
        .select('*')
        .eq('is_active', true);
      if (!error && data && data.length > 0) {
        return data as TaxCategory[];
      }
    } catch (e) {
      console.warn('Supabase fetchTaxCategories failed, fallback:', e);
    }
  }
  return getLocalStore<TaxCategory[]>(LOCAL_STORAGE_TAX_CATEGORIES, INITIAL_TAX_CATEGORIES);
}

export function calculateOrderTaxes(
  subtotal: number,
  discountAmount: number,
  taxConfig: TaxConfiguration
): { taxBreakdown: TaxBreakdown; taxAmount: number; totalPayable: number } {
  const isGstEnabled = taxConfig.is_gst_enabled !== false;
  const rate = taxConfig.default_tax_rate ?? (taxConfig as unknown as { tax_rate_percentage?: number }).tax_rate_percentage ?? 5.0;

  if (!isGstEnabled || rate <= 0) {
    const netPayable = Math.max(0, roundMoney(subtotal - discountAmount));
    return {
      taxAmount: 0,
      totalPayable: netPayable,
      taxBreakdown: {
        is_gst_enabled: false,
        is_tax_inclusive: taxConfig.is_tax_inclusive,
        tax_rate: 0,
        cgst_rate: 0,
        cgst_amount: 0,
        sgst_rate: 0,
        sgst_amount: 0,
        igst_rate: 0,
        igst_amount: 0,
        total_tax: 0,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
      },
    };
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const halfRate = roundMoney(rate / 2);

  let totalTax: number;
  let totalPayable: number;

  if (taxConfig.is_tax_inclusive) {
    // Price includes tax: base = taxable / (1 + rate/100)
    const baseAmount = taxableAmount / (1 + rate / 100);
    totalTax = roundMoney(taxableAmount - baseAmount);
    totalPayable = roundMoney(taxableAmount);
  } else {
    // Price excludes tax: tax = taxable * rate / 100
    totalTax = roundMoney((taxableAmount * rate) / 100);
    totalPayable = roundMoney(taxableAmount + totalTax);
  }

  const cgstAmount = roundMoney(totalTax / 2);
  const sgstAmount = roundMoney(totalTax - cgstAmount); // Avoid rounding mismatch

  const taxBreakdown: TaxBreakdown = {
    is_gst_enabled: true,
    is_tax_inclusive: taxConfig.is_tax_inclusive,
    tax_rate: rate,
    cgst_rate: halfRate,
    cgst_amount: cgstAmount,
    sgst_rate: halfRate,
    sgst_amount: sgstAmount,
    igst_rate: rate,
    igst_amount: 0,
    total_tax: totalTax,
    cgstRate: halfRate,
    cgstAmount: cgstAmount,
    sgstRate: halfRate,
    sgstAmount: sgstAmount,
  };

  return { taxBreakdown, taxAmount: totalTax, totalPayable };
}

// ---------------------------------------------------------------------------
// 3. Discounts Repository
// ---------------------------------------------------------------------------
export async function fetchDiscounts(): Promise<Discount[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('discounts')
        .select('*')
        .eq('is_active', true);
      if (!error && data && data.length > 0) {
        return data as Discount[];
      }
    } catch (e) {
      console.warn('Supabase fetchDiscounts failed, fallback:', e);
    }
  }
  return getLocalStore<Discount[]>(LOCAL_STORAGE_DISCOUNTS, INITIAL_DISCOUNTS);
}

export async function validateAndApplyDiscount(
  code: string,
  subtotal: number
): Promise<{ isValid: boolean; discountAmount: number; discount?: Discount; error?: string }> {
  const discounts = await fetchDiscounts();
  const matched = discounts.find(
    (d) => d.code.toUpperCase() === code.trim().toUpperCase() && d.is_active
  );

  if (!matched) {
    return { isValid: false, discountAmount: 0, error: 'Invalid or expired coupon code' };
  }

  if (subtotal < matched.min_order_amount) {
    return {
      isValid: false,
      discountAmount: 0,
      error: `Minimum order amount of ₹${matched.min_order_amount} required for this coupon`,
    };
  }

  let calcDiscount = 0;
  if (matched.discount_type === 'PERCENTAGE') {
    calcDiscount = roundMoney((subtotal * matched.discount_value) / 100);
    if (matched.max_discount_amount && calcDiscount > matched.max_discount_amount) {
      calcDiscount = matched.max_discount_amount;
    }
  } else {
    calcDiscount = Math.min(subtotal, matched.discount_value);
  }

  return {
    isValid: true,
    discountAmount: calcDiscount,
    discount: matched,
  };
}

// ---------------------------------------------------------------------------
// 4. Pickup & Ordering Controls
// ---------------------------------------------------------------------------
export async function fetchPickupSettings(): Promise<PickupSettings> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('pickup_settings')
        .select('*')
        .limit(1)
        .single();
      if (!error && data) {
        return data as PickupSettings;
      }
    } catch (e) {
      console.warn('Supabase fetchPickupSettings failed, fallback:', e);
    }
  }
  return getLocalStore<PickupSettings>(LOCAL_STORAGE_PICKUP_SETTINGS, INITIAL_PICKUP_SETTINGS);
}

export async function savePickupSettings(settings: PickupSettings): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('pickup_settings').upsert(settings);
    if (error) {
      console.error('Supabase savePickupSettings failed:', error);
      throw new Error(`Failed to save pickup settings to Supabase: ${error.message}`);
    }
    return true;
  }
  setLocalStore(LOCAL_STORAGE_PICKUP_SETTINGS, settings);
  return true;
}

// ---------------------------------------------------------------------------
// 5. Menu Repository & Admin CRUD
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
  return getLocalStore<MenuCategory[]>(LOCAL_STORAGE_CATEGORIES, INITIAL_CATEGORIES);
}

export async function saveCategory(category: Partial<MenuCategory> & { name: string }): Promise<MenuCategory> {
  const categories = await fetchMenuCategories();
  const slug = category.slug || category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  if (category.id) {
    const idx = categories.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      const updated: MenuCategory = { ...categories[idx], ...category, slug };
      categories[idx] = updated;
      setLocalStore(LOCAL_STORAGE_CATEGORIES, categories);
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('menu_categories').upsert(updated);
        } catch {
          // Fallback to local persistence
        }
      }
      return updated;
    }
  }

  const newCat: MenuCategory = {
    id: category.id || 'cat_' + Date.now().toString(36),
    name: category.name,
    slug,
    description: category.description || '',
    display_order: category.display_order ?? categories.length + 1,
    icon_name: category.icon_name || 'Utensils',
    image_url: category.image_url || '/images/food/cat-shawarma-with-salad.jpg',
    is_active: category.is_active ?? true,
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('menu_categories').insert(newCat).select().single();
    if (error) {
      console.error('Supabase saveCategory error:', error);
      throw new Error(`Failed to save category to Supabase: ${error.message}`);
    }
    return (data as MenuCategory) || newCat;
  }

  categories.push(newCat);
  setLocalStore(LOCAL_STORAGE_CATEGORIES, categories);
  return newCat;
}

export async function deleteOrArchiveCategory(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('menu_categories').update({ is_active: false }).eq('id', id);
    if (error) {
      console.error('Supabase deleteOrArchiveCategory error:', error);
      throw new Error(`Failed to archive category in Supabase: ${error.message}`);
    }
    return true;
  }
  const categories = await fetchMenuCategories();
  const filtered = categories.filter((c) => c.id !== id);
  setLocalStore(LOCAL_STORAGE_CATEGORIES, filtered);
  return true;
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
  return getLocalStore<MenuItem[]>(LOCAL_STORAGE_MENU_ITEMS, INITIAL_MENU_ITEMS);
}

export async function fetchAllAdminMenuItems(): Promise<MenuItem[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select(`
          *,
          variants:menu_item_variants(*),
          addons:menu_item_addons(*)
        `)
        .order('display_order', { ascending: true });
      if (!error && data && data.length > 0) {
        return data as MenuItem[];
      }
    } catch (e) {
      console.warn('Supabase fetchAllAdminMenuItems failed, using fallback:', e);
    }
  }
  return getLocalStore<MenuItem[]>(LOCAL_STORAGE_MENU_ITEMS, INITIAL_MENU_ITEMS);
}

export async function saveMenuItem(
  item: Partial<MenuItem> & { name: string; base_price?: number; price?: number; category_id: string }
): Promise<MenuItem> {
  const items = await fetchAllAdminMenuItems();
  const slug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const priceVal = item.price ?? item.base_price ?? 150;

  if (item.id) {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      const updated: MenuItem = {
        ...items[idx],
        ...item,
        base_price: priceVal,
        price: priceVal,
        slug,
      };
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('menu_items').upsert(updated);
        if (error) {
          console.error('Supabase saveMenuItem update error:', error);
          throw new Error(`Failed to update menu item in Supabase: ${error.message}`);
        }
        return updated;
      }
      return updated;
    }
  }

  const newItem: MenuItem = {
    id: item.id || 'item_' + Date.now().toString(36),
    category_id: item.category_id,
    name: item.name,
    slug,
    description: item.description || '',
    base_price: priceVal,
    price: priceVal,
    image_url: item.image_url || '/images/food/item-01-classic-shawarma-salad.jpg',
    is_veg: item.is_veg ?? true,
    is_available: item.is_available ?? true,
    is_featured: item.is_featured ?? false,
    is_today_special: item.is_today_special ?? false,
    preparation_time_mins: item.prep_time_minutes ?? item.preparation_time_mins ?? 15,
    prep_time_minutes: item.prep_time_minutes ?? item.preparation_time_mins ?? 15,
    calories: item.calories,
    allergens: item.allergens || [],
    display_order: item.display_order ?? items.length + 1,
    variants: item.variants || [],
    addons: item.addons || [],
  };

  if (isSupabaseConfigured()) {
    const { data, error } = await supabase.from('menu_items').insert(newItem).select().single();
    if (error) {
      console.error('Supabase saveMenuItem insert error:', error);
      throw new Error(`Failed to create menu item in Supabase: ${error.message}`);
    }
    return (data as MenuItem) || newItem;
  }

  items.push(newItem);
  setLocalStore(LOCAL_STORAGE_MENU_ITEMS, items);
  return newItem;
}

export async function archiveMenuItem(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from('menu_items').update({ is_available: false }).eq('id', id);
    if (error) {
      console.error('Supabase archiveMenuItem error:', error);
      throw new Error(`Failed to archive menu item in Supabase: ${error.message}`);
    }
    return true;
  }
  const items = await fetchAllAdminMenuItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx].is_available = false;
    items[idx].is_archived = true;
    setLocalStore(LOCAL_STORAGE_MENU_ITEMS, items);
  }
  return true;
}

// Supabase Storage & Image Upload helper
export async function uploadMenuImage(file: File): Promise<{ url: string; error?: string }> {
  // Validate file type & size
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return { url: '', error: 'Only JPEG, PNG, WebP or GIF images are allowed' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { url: '', error: 'Image size exceeds maximum limit of 5MB' };
  }

  const fileName = `item_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.storage
        .from('menu-assets')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('menu-assets')
          .getPublicUrl(fileName);
        return { url: publicUrlData.publicUrl };
      }
    } catch (e) {
      console.warn('Supabase storage upload failed, converting to local object URL:', e);
    }
  }

  // Graceful local FileReader / Data URL fallback
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({ url: reader.result as string });
    };
    reader.onerror = () => {
      resolve({ url: '', error: 'Failed to read image file' });
    };
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// 6. Cafe Tables Repository & Floor Management
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
        setLocalStore(LOCAL_STORAGE_TABLES, data);
        return data as CafeTable[];
      }
    } catch (e) {
      console.warn('Supabase fetchCafeTables failed, using fallback:', e);
    }
  }
  return getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
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

export async function updateTableStatus(
  tableId: string,
  newStatus: TableStatus,
  guestCount?: number,
  waiterId?: string | null,
  waiterName?: string | null,
  actorName: string = 'Staff'
): Promise<CafeTable> {
  const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
  const idx = tables.findIndex((t) => t.id === tableId);
  if (idx === -1) {
    throw new Error(`Table ${tableId} not found`);
  }

  const table = tables[idx];
  const previousStatus = table.status;

  // Strict Rule: Prevent marking table available while an active unpaid order remains!
  if (newStatus === 'available') {
    const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
    const unpaidActiveOrder = orders.find(
      (o) =>
        (o.table_id === tableId || o.table_number_snapshot === table.table_number) &&
        o.payment_status !== 'PAID' &&
        o.order_status !== 'COMPLETED' &&
        o.order_status !== 'CANCELLED' &&
        o.order_status !== 'REJECTED'
    );
    if (unpaidActiveOrder) {
      throw new Error(
        `Cannot mark table available while an active unpaid order (${unpaidActiveOrder.order_number}) remains. Please settle payment or close the order first.`
      );
    }
  }

  const updated: CafeTable = {
    ...table,
    status: newStatus,
    guest_count: guestCount !== undefined ? guestCount : table.guest_count,
    assigned_waiter_id: waiterId !== undefined ? waiterId : table.assigned_waiter_id,
    assigned_waiter_name: waiterName !== undefined ? waiterName : table.assigned_waiter_name,
    last_activity_at: new Date().toISOString(),
  };

  if (newStatus === 'available') {
    updated.guest_count = 0;
    updated.active_order_id = null;
    updated.active_order_number = null;
    updated.current_bill_amount = 0;
  }

  tables[idx] = updated;
  setLocalStore(LOCAL_STORAGE_TABLES, tables);

  // Log staff audit
  await logStaffAction('TABLE', tableId, actorName, 'UPDATE_STATUS', {
    previousStatus,
    newStatus,
    tableNumber: table.table_number,
    guestCount: updated.guest_count,
  });

  // Realtime notification
  publishRealtimeEvent({
    type: 'TABLE_UPDATED',
    tableId,
    tableNumber: table.table_number,
    status: newStatus,
    actorName,
  });

  return updated;
}

export async function openTable(
  tableId: string,
  guestCount: number,
  waiterId?: string | null,
  waiterName?: string | null,
  actorName: string = 'Staff'
): Promise<CafeTable> {
  return updateTableStatus(tableId, 'occupied', guestCount, waiterId, waiterName, actorName);
}

export async function markTableCleaning(tableId: string, actorName: string = 'Staff'): Promise<CafeTable> {
  return updateTableStatus(tableId, 'cleaning', undefined, undefined, undefined, actorName);
}

export async function markTableAvailable(tableId: string, actorName: string = 'Staff'): Promise<CafeTable> {
  return updateTableStatus(tableId, 'available', 0, null, null, actorName);
}

export async function assignWaiterToTable(
  tableId: string,
  waiterId: string,
  waiterName: string,
  actorName: string = 'Staff'
): Promise<CafeTable> {
  const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
  const idx = tables.findIndex((t) => t.id === tableId);
  if (idx === -1) {
    throw new Error(`Table ${tableId} not found`);
  }

  tables[idx].assigned_waiter_id = waiterId;
  tables[idx].assigned_waiter_name = waiterName;
  tables[idx].last_activity_at = new Date().toISOString();
  setLocalStore(LOCAL_STORAGE_TABLES, tables);

  await logStaffAction('TABLE', tableId, actorName, 'ASSIGN_WAITER', {
    waiterId,
    waiterName,
    tableNumber: tables[idx].table_number,
  });

  publishRealtimeEvent({
    type: 'TABLE_UPDATED',
    tableId,
    tableNumber: tables[idx].table_number,
    actorName,
  });

  return tables[idx];
}

// ---------------------------------------------------------------------------
// 7. Customer Registration & Session Strategy
// ---------------------------------------------------------------------------
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
  const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
  const cleanName = fullName.trim();
  const cleanEmail = email?.trim() || null;

  if (isSupabaseConfigured()) {
    try {
      const { data: existing, error: searchErr } = await supabase
        .from('customers')
        .select('*')
        .eq('mobile_number', cleanMobile)
        .maybeSingle();

      if (!searchErr && existing) {
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
      } else if (!searchErr) {
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
      }
    } catch {
      // Direct table access may be blocked by RLS for anonymous users; safely fall back to local store
    }
  }

  const customers = getLocalStore<Customer[]>(LOCAL_STORAGE_CUSTOMERS, INITIAL_CUSTOMERS);

  const existingIdx = customers.findIndex((c) => c.mobile_number === cleanMobile);
  if (existingIdx >= 0) {
    const existing = customers[existingIdx];
    const updated: Customer = {
      ...existing,
      full_name: cleanName || existing.full_name,
      email: cleanEmail || existing.email,
      last_visit_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      status: existing.status || 'ACTIVE',
    };
    customers[existingIdx] = updated;
    setLocalStore(LOCAL_STORAGE_CUSTOMERS, customers);
    return updated;
  }

  const newCustomer: Customer = {
    id: generateUUIDv4(),
    full_name: cleanName,
    mobile_number: cleanMobile,
    email: cleanEmail,
    total_orders: 0,
    total_spent: 0,
    last_visit_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    status: 'NEW REGISTERED',
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
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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

  const sessions = getLocalStore<CustomerSession[]>(LOCAL_STORAGE_SESSIONS, []);
  sessions.push(sessionObj);
  setLocalStore(LOCAL_STORAGE_SESSIONS, sessions);

  return sessionObj;
}

// ---------------------------------------------------------------------------
// 8. Order Creation, State Machine & Order Management Repository
// ---------------------------------------------------------------------------

export function generateOrderNumber(): string {
  const currentYear = new Date().getFullYear();
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const nextSeq = orders.length + 1;
  return `HG-${currentYear}-${String(nextSeq).padStart(5, '0')}`;
}

export const generateDemoOrderNumber = generateOrderNumber;

export const updateCafeSettings = saveCafeSettings;
export const updateTaxConfiguration = saveTaxConfiguration;

export interface CreateOrderParams {
  customerId?: string | null;
  customerName: string;
  customerMobile: string;
  customerEmail?: string | null;
  orderType: OrderType;
  tableId?: string | null;
  tableNumberSnapshot?: string | null;
  pickupSlotSnapshot?: string | null;
  pickupNotes?: string | null;
  cartItems: CartItem[];
  subtotal: number;
  discountAmount: number;
  discountCode?: string | null;
  taxAmount: number;
  taxBreakdown: TaxBreakdown;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes?: string;
  initialTransaction?: PaymentTransaction;
}

export async function createOrder(
  paramOrOrderData: CreateOrderParams | Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'>,
  itemsDataArg?: Omit<OrderItem, 'id' | 'order_id' | 'created_at'>[]
): Promise<Order> {
  const newOrderId = generateUUIDv4();
  const orderNumber = generateOrderNumber();
  const timestamp = new Date().toISOString();

  let orderData: Omit<Order, 'id' | 'order_number' | 'created_at' | 'updated_at'>;
  let itemsData: Omit<OrderItem, 'id' | 'order_id' | 'created_at'>[];

  if ('cartItems' in paramOrOrderData) {
    const params = paramOrOrderData as CreateOrderParams;
    orderData = {
      customer_id: params.customerId || null,
      customer_name_snapshot: params.customerName,
      customer_mobile_snapshot: params.customerMobile,
      customer_email_snapshot: params.customerEmail || null,
      order_type: params.orderType,
      table_id: params.tableId || null,
      table_number_snapshot: params.tableNumberSnapshot || null,
      pickup_time_slot: params.pickupSlotSnapshot || null,
      pickup_slot_snapshot: params.pickupSlotSnapshot || null,
      pickup_notes: params.pickupNotes || null,
      subtotal: params.subtotal,
      discount_amount: params.discountAmount,
      discount_code: params.discountCode || null,
      tax_amount: params.taxAmount,
      tax_breakdown: params.taxBreakdown,
      total_amount: params.totalAmount,
      payment_method: params.paymentMethod,
      payment_status: params.paymentStatus,
      order_status: 'PENDING',
      status: 'PENDING',
      special_instructions: params.notes || null,
      notes: params.notes || null,
    };

    itemsData = params.cartItems.map((ci) => ({
      menu_item_id: ci.menuItem.id,
      item_name_snapshot: ci.menuItem.name,
      is_veg: ci.menuItem.is_veg,
      unit_price_snapshot: ci.unitPrice,
      quantity: ci.quantity,
      total_price: ci.totalPrice,
      variant_snapshot: ci.selectedVariant
        ? { name: ci.selectedVariant.name, price_delta: ci.selectedVariant.price_delta }
        : null,
      variant_name_snapshot: ci.selectedVariant?.name || null,
      addons_snapshot: ci.selectedAddons.map((a: { name: string; price: number }) => ({ name: a.name, price: a.price })),
      addon_names_snapshot: ci.selectedAddons.map((a: { name: string }) => a.name),
      special_instructions: ci.specialInstructions,
      tax_rate_snapshot: 5.0,
    }));
  } else {
    const raw = paramOrOrderData as any;
    orderData = {
      ...raw,
      customer_id: raw.customer_id || raw.customerId || null,
      customer_name_snapshot: raw.customer_name_snapshot || raw.customerName || '',
      customer_mobile_snapshot: raw.customer_mobile_snapshot || raw.customerMobile || '',
      customer_email_snapshot: raw.customer_email_snapshot || raw.customerEmail || null,
      order_type: raw.order_type || raw.orderType || 'DINING',
      subtotal: raw.subtotal || 0,
      discount_amount: raw.discount_amount ?? raw.discountAmount ?? 0,
      tax_amount: raw.tax_amount ?? raw.taxAmount ?? 0,
      total_amount: raw.total_amount ?? raw.totalAmount ?? 0,
      payment_method: raw.payment_method || raw.paymentMethod || 'UPI',
      payment_status: raw.payment_status || raw.paymentStatus || 'PENDING',
      status: raw.status || raw.order_status || raw.orderStatus || 'PENDING',
      order_status: raw.order_status || raw.status || raw.orderStatus || 'PENDING',
    };
    itemsData = itemsDataArg || raw.items || [];
  }

  const createdOrder: Order = {
    ...orderData,
    id: newOrderId,
    order_number: orderNumber,
    guest_access_token: generateGuestToken(),
    created_at: timestamp,
    updated_at: timestamp,
    items: itemsData.map((item: any, idx) => ({
      ...item,
      id: item.id || `oi_${Date.now().toString(36)}_${idx}`,
      order_id: newOrderId,
      menu_item_id: item.menu_item_id || item.menuItemId || '',
      item_name_snapshot: item.item_name_snapshot || item.name || 'Item',
      unit_price_snapshot: item.unit_price_snapshot ?? item.unitPrice ?? 0,
      quantity: item.quantity || 1,
      total_price: item.total_price ?? item.totalPrice ?? (item.unit_price_snapshot ?? item.unitPrice ?? 0) * (item.quantity || 1),
      status: item.status || item.item_status || 'QUEUED',
      item_status: item.item_status || item.status || 'QUEUED',
      created_at: timestamp,
    })),
  };

  if (isSupabaseConfigured()) {
    const rawMobile = (orderData.customer_mobile_snapshot || '').replace(/\D/g, '');
    const cleanMobile = rawMobile.length === 12 && rawMobile.startsWith('91')
      ? rawMobile.slice(2)
      : rawMobile.slice(-10);

    const orderPayload = {
      order_type: ((orderData.order_type as string) === 'DINING' || (orderData.order_type as string) === 'DINE_IN') ? 'DINING' : 'TAKEAWAY',
      table_id: orderData.table_id || null,
      table_number: orderData.table_number_snapshot || null,
      pickup_time_slot: orderData.pickup_time_slot || orderData.pickup_slot_snapshot || 'ASAP Pickup',
      pickup_slot_snapshot: orderData.pickup_slot_snapshot || orderData.pickup_time_slot || 'ASAP Pickup',
      pickup_notes: orderData.pickup_notes || null,
      customer_name_snapshot: orderData.customer_name_snapshot || 'Guest Customer',
      customer_mobile_snapshot: cleanMobile,
      customer_email_snapshot: orderData.customer_email_snapshot || null,
      payment_method: orderData.payment_method === 'CARD'
        ? 'CARD_DEMO'
        : orderData.payment_method === 'UPI'
        ? 'UPI_DEMO'
        : orderData.payment_method,
      discount_code: orderData.discount_code || null,
      special_instructions: orderData.special_instructions || null,
    };

    const itemsPayload = itemsData.map((item: any) => ({
      menu_item_id: item.menu_item_id || item.menuItemId,
      item_name: item.item_name_snapshot || item.name || 'Item',
      quantity: item.quantity || 1,
      variant_id: item.variant_id || item.variantSnapshot?.id || null,
      variant_name: item.variant_name_snapshot || item.variantSnapshot?.name || null,
      selected_addons: item.selected_addons || item.addons_snapshot || item.selectedAddons || [],
      special_instructions: item.special_instructions || null,
    }));

    const { data: rpcResult, error: rpcErr } = await supabase.rpc('place_order', {
      order_payload: orderPayload,
      items_payload: itemsPayload,
    });

    if (rpcErr) {
      console.error('Supabase place_order RPC error:', rpcErr);
      throw new Error(`Failed to create order in Supabase: ${rpcErr.message}`);
    }

    if (rpcResult && rpcResult.success) {
      createdOrder.id = rpcResult.order_id;
      createdOrder.order_number = rpcResult.order_number;
      createdOrder.guest_access_token = rpcResult.guest_access_token;
      if (rpcResult.customer_id) {
        createdOrder.customer_id = rpcResult.customer_id;
      }
      if (rpcResult.pickup_slot_snapshot) {
        createdOrder.pickup_slot_snapshot = rpcResult.pickup_slot_snapshot;
      }
      if (rpcResult.pickup_time_slot) {
        createdOrder.pickup_time_slot = rpcResult.pickup_time_slot;
      }
      if (rpcResult.subtotal !== undefined) createdOrder.subtotal = rpcResult.subtotal;
      if (rpcResult.discount_amount !== undefined) createdOrder.discount_amount = rpcResult.discount_amount;
      if (rpcResult.tax_amount !== undefined) createdOrder.tax_amount = rpcResult.tax_amount;
      if (rpcResult.total_amount !== undefined) createdOrder.total_amount = rpcResult.total_amount;
      createdOrder.payment_status = (rpcResult.payment_status as PaymentStatus) || 'UNPAID';
      createdOrder.order_status = (rpcResult.order_status as OrderStatus) || 'PENDING';
      createdOrder.status = createdOrder.order_status;

      // Update items with real order_id
      if (createdOrder.items) {
        createdOrder.items = createdOrder.items.map((it) => ({
          ...it,
          order_id: rpcResult.order_id,
        }));
      }

      // Cache guest token in localStorage for subsequent tracking and payment calls
      if (typeof localStorage !== 'undefined' && rpcResult.guest_access_token) {
        localStorage.setItem(`hangout_guest_token_${rpcResult.order_id}`, rpcResult.guest_access_token);
        localStorage.setItem(`hangout_guest_token_${rpcResult.order_number}`, rpcResult.guest_access_token);
      }
    }
  }

  // Save to local store
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  orders.unshift(createdOrder);
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  // Update customer order count and spending stats, or register guest customer
  if (orderData.customer_id || orderData.customer_mobile_snapshot) {
    const customers = getLocalStore<Customer[]>(LOCAL_STORAGE_CUSTOMERS, INITIAL_CUSTOMERS);
    const cleanPhone = (orderData.customer_mobile_snapshot || '').replace(/\D/g, '').slice(-10);
    const custIdx = customers.findIndex(
      (c) =>
        (orderData.customer_id && c.id === orderData.customer_id) ||
        (cleanPhone && c.mobile_number === cleanPhone)
    );
    if (custIdx >= 0) {
      customers[custIdx].total_orders += 1;
      customers[custIdx].last_visit_at = timestamp;
      customers[custIdx].status = 'ACTIVE';
      if (orderData.customer_email_snapshot && !customers[custIdx].email) {
        customers[custIdx].email = orderData.customer_email_snapshot;
      }
      if (orderData.payment_status === 'PAID') {
        customers[custIdx].total_spent = roundMoney(
          customers[custIdx].total_spent + orderData.total_amount
        );
      }
      setLocalStore(LOCAL_STORAGE_CUSTOMERS, customers);
    } else if (cleanPhone) {
      // Create new customer record for guest checkout
      const newCust: Customer = {
        id: orderData.customer_id || generateUUIDv4(),
        full_name: orderData.customer_name_snapshot || 'Guest Customer',
        mobile_number: cleanPhone,
        email: orderData.customer_email_snapshot || null,
        total_orders: 1,
        total_spent: orderData.payment_status === 'PAID' ? roundMoney(orderData.total_amount) : 0,
        last_visit_at: timestamp,
        last_login_at: timestamp,
        created_at: timestamp,
        status: 'ACTIVE',
      };
      customers.push(newCust);
      setLocalStore(LOCAL_STORAGE_CUSTOMERS, customers);
    }
  }

  // Record initial status in status history
  const history = getLocalStore<OrderStatusHistory[]>(LOCAL_STORAGE_STATUS_HISTORY, []);
  history.push({
    id: 'osh_' + Date.now().toString(36),
    order_id: newOrderId,
    previous_status: null,
    new_status: orderData.order_status,
    changed_by_role: 'CUSTOMER',
    notes: 'Order submitted by customer',
    created_at: timestamp,
  });
  setLocalStore(LOCAL_STORAGE_STATUS_HISTORY, history);

  // Broadcast operational event for cross-device/tab synchronization
  publishRealtimeEvent({
    type: 'ORDER_CREATED',
    orderId: createdOrder.id,
    status: createdOrder.order_status,
    tableId: createdOrder.table_id || undefined,
    tableNumber: createdOrder.table_number_snapshot || undefined,
    payload: {
      orderNumber: createdOrder.order_number,
      totalAmount: createdOrder.total_amount,
      paymentStatus: createdOrder.payment_status,
    },
  });

  return createdOrder;
}

export async function fetchOrders(filter?: {
  status?: string;
  orderType?: string;
  paymentStatus?: string;
  search?: string;
}): Promise<Order[]> {
  let serverOrders: Order[] | null = null;

  if (isSupabaseConfigured()) {
    try {
      let staffRole: string | null = null;
      let staffId: string | null = null;
      try {
        if (typeof localStorage !== 'undefined') {
          const staffSession = localStorage.getItem('hangout_staff_session');
          if (staffSession) {
            const parsed = JSON.parse(staffSession);
            staffRole = parsed.role_id || parsed.role || null;
            staffId = parsed.id || parsed.email || null;
          }
        }
      } catch {
        // ignore parsing issues
      }

      // 1. Authoritative SECURITY DEFINER RPC: Retrieves authoritative orders with items
      // Protected by internal staff authorization check in Postgres
      const { data: rpcData, error: rpcErr } = await supabase.rpc('get_admin_orders', {
        p_status: filter?.status && filter.status !== 'ALL' ? filter.status : null,
        p_limit: 200,
        p_staff_role: staffRole,
        p_staff_id: staffId,
      });

      if (!rpcErr && Array.isArray(rpcData)) {
        serverOrders = rpcData.map((o: any) => ({
          ...o,
          status: (o.status || o.order_status) as OrderStatus,
          order_status: (o.order_status || o.status) as OrderStatus,
          items: Array.isArray(o.items) ? o.items : [],
        }));
      } else if (rpcErr) {
        // Fallback: direct table select if RPC not yet deployed
        const { data: rawOrders, error: rawErr } = await supabase
          .from('orders')
          .select('*, items:order_items(*)')
          .order('created_at', { ascending: false });

        if (!rawErr && Array.isArray(rawOrders)) {
          serverOrders = rawOrders.map((o: any) => ({
            ...o,
            status: (o.status || o.order_status) as OrderStatus,
            order_status: (o.order_status || o.status) as OrderStatus,
            items: Array.isArray(o.items) ? o.items : [],
          }));
        }
      }
    } catch (err) {
      console.warn('Supabase fetchOrders network attempt failed, using local store:', err);
    }
  }

  // Authoritative Server Data Reconciliation:
  // When server orders are retrieved, server data is authoritative across devices.
  if (serverOrders !== null) {
    const localOrders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
    const serverIds = new Set(serverOrders.map((o) => o.id));

    // Preserve any local uncommitted temporary orders that are not on the server
    const localPending = localOrders.filter(
      (o) => !serverIds.has(o.id) && o.id.startsWith('temp-')
    );

    const reconciled = [...serverOrders, ...localPending];
    setLocalStore(LOCAL_STORAGE_ORDERS, reconciled);

    let result = reconciled;
    if (filter?.status && filter.status !== 'ALL') {
      result = result.filter((o) => (o.status || o.order_status) === filter.status);
    }
    if (filter?.orderType && filter.orderType !== 'ALL') {
      result = result.filter((o) => o.order_type === filter.orderType);
    }
    if (filter?.paymentStatus && filter.paymentStatus !== 'ALL') {
      result = result.filter((o) => o.payment_status === filter.paymentStatus);
    }
    if (filter?.search?.trim()) {
      const q = filter.search.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) ||
          (o.customer_name_snapshot && o.customer_name_snapshot.toLowerCase().includes(q)) ||
          (o.customer_mobile_snapshot && o.customer_mobile_snapshot.includes(q))
      );
    }
    return result;
  }

  // Fallback to local store when Supabase is unconfigured or unavailable
  let orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);

  if (filter?.status && filter.status !== 'ALL') {
    orders = orders.filter((o) => (o.status || o.order_status) === filter.status);
  }
  if (filter?.orderType && filter.orderType !== 'ALL') {
    orders = orders.filter((o) => o.order_type === filter.orderType);
  }
  if (filter?.paymentStatus && filter.paymentStatus !== 'ALL') {
    orders = orders.filter((o) => o.payment_status === filter.paymentStatus);
  }
  if (filter?.search?.trim()) {
    const q = filter.search.toLowerCase().trim();
    orders = orders.filter(
      (o) =>
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name_snapshot && o.customer_name_snapshot.toLowerCase().includes(q)) ||
        (o.customer_mobile_snapshot && o.customer_mobile_snapshot.includes(q))
    );
  }

  return orders;
}

export async function fetchOrderById(idOrNumber: string, guestAccessToken?: string | null): Promise<Order | null> {
  if (isSupabaseConfigured()) {
    let token = guestAccessToken || null;
    if (!token && typeof localStorage !== 'undefined') {
      token =
        localStorage.getItem(`hangout_guest_token_${idOrNumber}`) ||
        localStorage.getItem(`hangout_guest_token_${idOrNumber.toLowerCase()}`) ||
        localStorage.getItem(`hangout_guest_token_${idOrNumber.toUpperCase()}`) ||
        null;
    }

    if (token) {
      try {
        const { data: res, error } = await supabase.rpc('get_order_by_access_token', {
          p_order_id: idOrNumber,
          p_access_token: token,
        });

        if (!error && res && res.order) {
          const ord = res.order;
          const fullOrder = {
            ...ord,
            status: (ord.status || ord.order_status) as OrderStatus,
            order_status: (ord.order_status || ord.status) as OrderStatus,
            guest_access_token: ord.guest_access_token || token,
            items: res.items || [],
          } as Order;

          // Cache in local storage for continuous access
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(`hangout_guest_token_${fullOrder.id}`, token);
            localStorage.setItem(`hangout_guest_token_${fullOrder.order_number}`, token);
          }

          return fullOrder;
        }
      } catch {
        // Fall back to local store
      }
    }
  }

  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  return (
    orders.find(
      (o) =>
        o.id === idOrNumber ||
        o.order_number.toLowerCase() === idOrNumber.toLowerCase()
    ) || null
  );
}

export async function lookupGuestOrder(
  idOrNumber: string,
  mobileOrToken: string
): Promise<Order | null> {
  if (!idOrNumber || !mobileOrToken) return null;

  if (isSupabaseConfigured()) {
    try {
      const { data: rpcRes, error } = await supabase.rpc('lookup_guest_order', {
        p_order_number: idOrNumber,
        p_mobile_or_token: mobileOrToken,
      });

      if (!error && rpcRes && rpcRes.success && rpcRes.order_id) {
        const order = await fetchOrderById(rpcRes.order_id, rpcRes.guest_access_token);
        if (order) {
          if (typeof localStorage !== 'undefined' && rpcRes.guest_access_token) {
            localStorage.setItem(`hangout_guest_token_${order.id}`, rpcRes.guest_access_token);
            localStorage.setItem(`hangout_guest_token_${order.order_number}`, rpcRes.guest_access_token);
          }
          return order;
        }
      }
    } catch {
      // Fall through to local fallback
    }
  }

  const clean = mobileOrToken.replace(/\D/g, '');
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const found = orders.find(
    (o) =>
      (o.id === idOrNumber || o.order_number.toLowerCase() === idOrNumber.toLowerCase()) &&
      (o.guest_access_token === mobileOrToken ||
        (clean.length >= 10 &&
          o.customer_mobile_snapshot &&
          o.customer_mobile_snapshot.replace(/\D/g, '').endsWith(clean.slice(-10))))
  );

  if (found && typeof localStorage !== 'undefined') {
    if (found.guest_access_token) {
      localStorage.setItem(`hangout_guest_token_${found.id}`, found.guest_access_token);
      localStorage.setItem(`hangout_guest_token_${found.order_number}`, found.guest_access_token);
    }
  }

  return found || null;
}

export async function fetchCustomerOrders(
  mobileNumberOrId: string
): Promise<Order[]> {
  const clean = mobileNumberOrId.replace(/\D/g, '').slice(-10);
  let orders: Order[] = [];
  const staffSession = typeof localStorage !== 'undefined' ? localStorage.getItem('hangout_staff_session') : null;
  if (staffSession) {
    orders = await fetchOrders();
  } else {
    orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  }
  return orders.filter(
    (o) =>
      o.customer_id === mobileNumberOrId ||
      (Boolean(clean) && Boolean(o.customer_mobile_snapshot) && (
        o.customer_mobile_snapshot === clean ||
        o.customer_mobile_snapshot.endsWith(clean)
      ))
  );
}

// Order State Machine Validation Rule Engine
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['PREPARATION_COMPLETED', 'READY_FOR_PICKUP', 'READY_FOR_SERVICE', 'CANCELLED'],
  PREPARATION_COMPLETED: ['READY_FOR_PICKUP', 'READY_FOR_SERVICE', 'SERVED', 'COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  READY_FOR_SERVICE: ['SERVED', 'COMPLETED', 'CANCELLED'],
  SERVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
};

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  reasonOrRole?: string,
  paymentStatusOrReason?: string,
  actorName: string = 'Staff'
): Promise<Order & { success: boolean; order: Order }> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  let idx = orders.findIndex((o) => o.id === orderId);

  let currentOrder: Order;
  if (idx === -1) {
    if (isSupabaseConfigured()) {
      const fetched = await fetchOrderById(orderId);
      if (fetched) {
        orders.push(fetched);
        idx = orders.length - 1;
        currentOrder = fetched;
      } else {
        throw new Error('Order not found');
      }
    } else {
      throw new Error('Order not found');
    }
  } else {
    currentOrder = orders[idx];
  }
  const isStatusChanging = newStatus !== currentOrder.order_status;

  if (isStatusChanging) {
    const allowed = VALID_ORDER_TRANSITIONS[currentOrder.order_status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Cannot transition order status from ${currentOrder.order_status} to ${newStatus}`);
    }
  }

  const timestamp = new Date().toISOString();
  currentOrder.order_status = newStatus;
  currentOrder.status = newStatus;
  currentOrder.updated_at = timestamp;

  if (paymentStatusOrReason === 'PAID' || reasonOrRole === 'PAID') {
    currentOrder.payment_status = 'PAID';
  }

  if (newStatus === 'REJECTED') {
    currentOrder.rejection_reason = reasonOrRole || 'Order rejected by cafe management';
  } else if (newStatus === 'CANCELLED') {
    currentOrder.cancellation_reason = reasonOrRole || 'Order cancelled';
  }

  if (isSupabaseConfigured()) {
    const updatePayload: Record<string, unknown> = {
      order_status: newStatus,
      updated_at: timestamp,
    };
    if (paymentStatusOrReason === 'PAID' || reasonOrRole === 'PAID') {
      updatePayload.payment_status = 'PAID';
    }
    if (newStatus === 'REJECTED') {
      updatePayload.rejection_reason = reasonOrRole || 'Order rejected by cafe management';
    } else if (newStatus === 'CANCELLED') {
      updatePayload.cancellation_reason = reasonOrRole || 'Order cancelled';
    }

    const { error: sbErr } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId);

    if (sbErr) {
      console.error('Supabase updateOrderStatus error:', sbErr);
      throw new Error(`Failed to update order status in Supabase: ${sbErr.message}`);
    }
  }

  orders[idx] = currentOrder;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  // Record audit in status history
  const history = getLocalStore<OrderStatusHistory[]>(LOCAL_STORAGE_STATUS_HISTORY, []);
  history.push({
    id: 'osh_' + Date.now().toString(36),
    order_id: orderId,
    previous_status: currentOrder.order_status,
    new_status: newStatus,
    changed_by_role: 'ADMIN',
    notes: reasonOrRole || `Status updated to ${newStatus}`,
    created_at: timestamp,
  });
  setLocalStore(LOCAL_STORAGE_STATUS_HISTORY, history);

  // Record in admin audit logs
  await logAdminAction(
    `ORDER_STATUS_${newStatus}`,
    'ORDER',
    orderId,
    'ADMIN',
    actorName,
    { previousStatus: currentOrder.order_status, newStatus, reason: reasonOrRole }
  );

  return Object.assign(currentOrder, { success: true, order: currentOrder });
}

// ---------------------------------------------------------------------------
// 9. Simulated Payment Gateway & Adapter
// ---------------------------------------------------------------------------
export function generateDemoTransactionRef(): string {
  return `TXN-DEMO-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;
}

export async function processSimulatedPayment(params: {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  shouldFail?: boolean;
  guestAccessToken?: string | null;
}): Promise<{
  success: boolean;
  payment: Payment;
  transaction: PaymentTransaction;
  error?: string;
}> {
  if (params.orderId.startsWith('temp-ord-')) {
    return {
      success: false,
      payment: {} as Payment,
      transaction: {} as PaymentTransaction,
      error: `Payment authorization failed: Temporary order reference "${params.orderId}" cannot be used for payment. Order must be created before payment confirmation.`,
    };
  }

  // Prevent duplicate payment on already settled orders
  const existingOrders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const existingOrder = existingOrders.find((o) => o.id === params.orderId);
  if (existingOrder && existingOrder.payment_status === 'PAID') {
    return {
      success: false,
      payment: {} as Payment,
      transaction: {} as PaymentTransaction,
      error: `Payment confirmation failed: Order ${existingOrder.order_number || params.orderId} has already been paid and settled.`,
    };
  }

  const timestamp = new Date().toISOString();
  const paymentId = 'pay_' + Date.now().toString(36);
  const txnRef = generateDemoTransactionRef();

  const isSuccess = !params.shouldFail && params.paymentMethod !== 'PAY_AFTER_MEAL';
  const isPayLater = params.paymentMethod === 'PAY_AFTER_MEAL';

  const paymentStatus: PaymentStatus = isPayLater
    ? 'UNPAID'
    : isSuccess
    ? 'PAID'
    : 'FAILED';

  const paymentObj: Payment = {
    id: paymentId,
    order_id: params.orderId,
    amount: roundMoney(params.amount),
    currency: 'INR',
    payment_method: params.paymentMethod,
    payment_status: paymentStatus,
    is_demo: true,
    created_at: timestamp,
  };

  const transactionObj: PaymentTransaction = {
    id: 'txn_' + Date.now().toString(36),
    payment_id: paymentId,
    transaction_reference: txnRef,
    transaction_number: txnRef,
    gateway_provider: 'SIMULATED_DEMO_GATEWAY',
    status: isSuccess ? 'SUCCESS' : isPayLater ? 'INITIATED' : 'FAILURE',
    amount: roundMoney(params.amount),
    gateway_response: {
      gateway_label: 'DEMO SIMULATION ONLY',
      provider: params.paymentMethod,
      timestamp,
      verified: isSuccess,
    },
    error_message: isSuccess ? null : params.shouldFail ? 'Simulated Bank Gateway Error' : null,
    created_at: timestamp,
  };

  if (isSupabaseConfigured() && isSuccess) {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (params.orderId.startsWith('temp-ord-')) {
      return {
        success: false,
        payment: {} as Payment,
        transaction: {} as PaymentTransaction,
        error: `Payment authorization failed: invalid input syntax for type uuid: "${params.orderId}". Order must be created before payment confirmation.`,
      };
    }

    if (UUID_REGEX.test(params.orderId)) {
      try {
        const dbMethod = params.paymentMethod === 'CARD'
          ? 'CARD_DEMO'
          : params.paymentMethod === 'UPI'
          ? 'UPI_DEMO'
          : params.paymentMethod;

        const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
        const ord = orders.find((o) => o.id === params.orderId);
        let token = params.guestAccessToken || ord?.guest_access_token || null;
        if (!token && typeof localStorage !== 'undefined') {
          token = localStorage.getItem(`hangout_guest_token_${params.orderId}`) ||
                  (ord ? localStorage.getItem(`hangout_guest_token_${ord.order_number}`) : null);
        }

        let { error: rpcErr } = await supabase.rpc('confirm_demo_payment', {
          p_order_id: params.orderId,
          p_payment_method: dbMethod,
          p_guest_access_token: token,
          p_amount: params.amount,
        });

        if (rpcErr && (rpcErr.code === 'PGRST202' || rpcErr.message?.includes('parameters') || rpcErr.message?.includes('function'))) {
          const retry = await supabase.rpc('confirm_demo_payment', {
            p_order_id: params.orderId,
            p_payment_method: dbMethod,
          });
          rpcErr = retry.error;
        }

        if (rpcErr) {
          console.error('Remote confirm_demo_payment RPC error:', rpcErr);
          const errMessage = rpcErr.message || 'Payment confirmation failed in backend';
          return {
            success: false,
            payment: { ...paymentObj, payment_status: 'FAILED' },
            transaction: {
              ...transactionObj,
              status: 'FAILURE',
              error_message: errMessage,
            },
            error: `Payment confirmation failed: ${errMessage}`,
          };
        }
      } catch (e: unknown) {
        const errMessage = e instanceof Error ? e.message : 'Payment RPC exception';
        console.error('confirm_demo_payment exception:', e);
        return {
          success: false,
          payment: { ...paymentObj, payment_status: 'FAILED' },
          transaction: {
            ...transactionObj,
            status: 'FAILURE',
            error_message: errMessage,
          },
          error: `Payment confirmation failed: ${errMessage}`,
        };
      }
    }
  }

  // Update order's payment status in storage
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const ordIdx = orders.findIndex((o) => o.id === params.orderId);
  if (ordIdx >= 0) {
    orders[ordIdx].payment_status = paymentStatus;
    orders[ordIdx].updated_at = timestamp;
    setLocalStore(LOCAL_STORAGE_ORDERS, orders);

    if (isSuccess) {
      const paidOrd = orders[ordIdx];
      const customers = getLocalStore<Customer[]>(LOCAL_STORAGE_CUSTOMERS, INITIAL_CUSTOMERS);
      const cleanPhone = (paidOrd.customer_mobile_snapshot || '').replace(/\D/g, '').slice(-10);
      const custIdx = customers.findIndex(
        (c) =>
          (paidOrd.customer_id && c.id === paidOrd.customer_id) ||
          (cleanPhone && c.mobile_number === cleanPhone)
      );
      if (custIdx >= 0) {
        customers[custIdx].total_spent = roundMoney(customers[custIdx].total_spent + paidOrd.total_amount);
        customers[custIdx].last_visit_at = timestamp;
        customers[custIdx].status = 'ACTIVE';
        setLocalStore(LOCAL_STORAGE_CUSTOMERS, customers);
      }
    }
  }

  // Persist payments & transactions
  const payments = getLocalStore<Payment[]>(LOCAL_STORAGE_PAYMENTS, []);
  payments.push(paymentObj);
  setLocalStore(LOCAL_STORAGE_PAYMENTS, payments);

  const txns = getLocalStore<PaymentTransaction[]>(LOCAL_STORAGE_TRANSACTIONS, []);
  txns.push(transactionObj);
  setLocalStore(LOCAL_STORAGE_TRANSACTIONS, txns);

  // Broadcast operational payment event for multi-device synchronization
  publishRealtimeEvent({
    type: 'ORDER_STATUS_CHANGED',
    orderId: params.orderId,
    status: paymentStatus === 'PAID' ? 'PAID' : 'PAYMENT_PENDING',
    payload: {
      paymentStatus,
      amount: params.amount,
      method: params.paymentMethod,
      transactionRef: transactionObj.transaction_reference,
    },
  });

  return {
    success: isSuccess || isPayLater,
    payment: paymentObj,
    transaction: transactionObj,
    error: isSuccess || isPayLater ? undefined : 'Simulated payment processing failed. Please retry.',
  };
}

export const confirmDemoPayment = processSimulatedPayment;

// ---------------------------------------------------------------------------
// 10. Admin Customer Management & Audit Logs
// ---------------------------------------------------------------------------
export async function fetchAdminCustomers(searchQuery?: string): Promise<Customer[]> {
  let customers = getLocalStore<Customer[]>(LOCAL_STORAGE_CUSTOMERS, INITIAL_CUSTOMERS);
  const orders = await fetchOrders();

  // Derive dynamic stats from actual stored orders
  customers = customers.map((c) => {
    const cleanMobile = c.mobile_number.replace(/\D/g, '').slice(-10);
    const matchedOrders = orders.filter(
      (o) =>
        o.customer_id === c.id ||
        (o.customer_mobile_snapshot && o.customer_mobile_snapshot.replace(/\D/g, '').slice(-10) === cleanMobile)
    );

    // Honest calculation of paid spend from genuine paid orders
    const dynamicPaidSpend = matchedOrders
      .filter((o) => o.payment_status === 'PAID' && o.status !== 'CANCELLED' && o.status !== 'REJECTED')
      .reduce((sum, o) => sum + o.total_amount, 0);

    // Most recent order timestamp
    const latestOrder = matchedOrders.length > 0
      ? [...matchedOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;

    // Use dynamic stats if actual orders exist, or preserve mock baseline
    const calculatedSpend = matchedOrders.length > 0 ? dynamicPaidSpend : c.total_spent;
    const calculatedOrders = matchedOrders.length > 0 ? matchedOrders.length : c.total_orders;

    return {
      ...c,
      status: c.status || (calculatedOrders > 0 ? 'ACTIVE' : 'NEW REGISTERED'),
      total_orders: calculatedOrders,
      total_spent: roundMoney(calculatedSpend),
      last_visit_at: latestOrder ? latestOrder.created_at : c.last_visit_at,
    };
  });

  if (searchQuery?.trim()) {
    const q = searchQuery.toLowerCase().trim();
    customers = customers.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        c.mobile_number.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }

  return customers;
}

export async function logAdminAction(
  action: string,
  entityType: string,
  entityId: string,
  actorRole: string,
  actorName: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const logs = getLocalStore<AdminAuditLog[]>(LOCAL_STORAGE_AUDIT_LOGS, []);
  logs.unshift({
    id: 'log_' + Date.now().toString(36),
    action,
    entity_type: entityType,
    entity_id: entityId,
    actor_role: actorRole,
    actor_name: actorName,
    details,
    created_at: new Date().toISOString(),
  });
  setLocalStore(LOCAL_STORAGE_AUDIT_LOGS, logs);
}

export async function fetchAuditLogs(): Promise<AdminAuditLog[]> {
  return getLocalStore<AdminAuditLog[]>(LOCAL_STORAGE_AUDIT_LOGS, []);
}

// ============================================================================
// BATCH 03: STAFF ROLES & PERMISSION ENGINE
// ============================================================================

export type StaffAction =
  | 'MANAGE_TABLES'
  | 'APPROVE_ORDERS'
  | 'CREATE_ORDERS'
  | 'PREPARE_FOOD'
  | 'SETTLE_BILLS'
  | 'MANAGE_SETTINGS'
  | 'EDIT_MENU';

export function assertStaffPermission(role: UserRole, action: StaffAction): void {
  const permissions: Record<UserRole, StaffAction[]> = {
    admin: [
      'MANAGE_TABLES',
      'APPROVE_ORDERS',
      'CREATE_ORDERS',
      'PREPARE_FOOD',
      'SETTLE_BILLS',
      'MANAGE_SETTINGS',
      'EDIT_MENU',
    ],
    manager: [
      'MANAGE_TABLES',
      'APPROVE_ORDERS',
      'CREATE_ORDERS',
      'PREPARE_FOOD',
      'SETTLE_BILLS',
    ],
    waiter: [
      'MANAGE_TABLES',
      'APPROVE_ORDERS',
      'CREATE_ORDERS',
      'PREPARE_FOOD',
      'SETTLE_BILLS',
    ],
    kitchen: [
      'PREPARE_FOOD',
    ],
    cashier: [
      'SETTLE_BILLS',
      'MANAGE_TABLES',
    ],
  };

  const allowed = permissions[role] || [];
  if (!allowed.includes(action)) {
    throw new Error(`Unauthorized: Role "${role}" does not have permission to "${action}".`);
  }
}

export async function logStaffAction(
  entityType: 'TABLE' | 'ORDER' | 'ORDER_ITEM' | 'BILL' | 'STATION' | string,
  entityId: string,
  staffName: string,
  action: string,
  details: Record<string, unknown> = {},
  role: string = 'STAFF'
): Promise<void> {
  const logs = getLocalStore<StaffAuditLog[]>(LOCAL_STORAGE_STAFF_AUDIT_LOGS, []);
  logs.unshift({
    id: 'staff_log_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
    staff_name: staffName,
    role,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details,
    created_at: new Date().toISOString(),
  });
  setLocalStore(LOCAL_STORAGE_STAFF_AUDIT_LOGS, logs);
}

export async function fetchStaffAuditLogs(): Promise<StaffAuditLog[]> {
  return getLocalStore<StaffAuditLog[]>(LOCAL_STORAGE_STAFF_AUDIT_LOGS, []);
}

// ============================================================================
// BATCH 03: KITCHEN STATIONS REPOSITORY
// ============================================================================

export async function fetchKitchenStations(): Promise<KitchenStation[]> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('kitchen_stations')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (!error && data && data.length > 0) {
        setLocalStore(LOCAL_STORAGE_KITCHEN_STATIONS, data);
        return data as KitchenStation[];
      }
    } catch (e) {
      console.warn('Supabase fetchKitchenStations failed, using fallback:', e);
    }
  }
  return getLocalStore<KitchenStation[]>(LOCAL_STORAGE_KITCHEN_STATIONS, INITIAL_KITCHEN_STATIONS);
}

export async function saveKitchenStation(station: KitchenStation): Promise<KitchenStation> {
  const stations = getLocalStore<KitchenStation[]>(LOCAL_STORAGE_KITCHEN_STATIONS, INITIAL_KITCHEN_STATIONS);
  const idx = stations.findIndex((s) => s.id === station.id);
  if (idx >= 0) {
    stations[idx] = station;
  } else {
    stations.push(station);
  }
  setLocalStore(LOCAL_STORAGE_KITCHEN_STATIONS, stations);
  return station;
}

// ============================================================================
// BATCH 03: DINING ORDER APPROVAL ENGINE
// ============================================================================

export async function approveDiningOrder(
  orderId: string,
  waiterId: string,
  waiterName: string
): Promise<Order> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const order = orders[idx];
  if (order.order_status !== 'PENDING') {
    throw new Error(`Cannot approve order in status ${order.order_status}`);
  }
  if (order.order_type !== 'DINING') {
    throw new Error('Only dining orders require waiter approval');
  }

  const now = new Date().toISOString();
  order.order_status = 'ACCEPTED';
  order.status = 'ACCEPTED';
  order.approved_by_waiter_id = waiterId;
  order.waiter_id = order.waiter_id || waiterId;
  order.waiter_name = order.waiter_name || waiterName;
  order.approved_at = now;
  order.updated_at = now;

  // Initialize items as QUEUED for kitchen
  if (order.items) {
    order.items = order.items.map((it) => ({
      ...it,
      status: it.status || 'QUEUED',
      item_status: it.item_status || 'QUEUED',
    }));
  }

  orders[idx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  // Bind active order to table if table exists
  if (order.table_id) {
    const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
    const tIdx = tables.findIndex((t) => t.id === order.table_id);
    if (tIdx >= 0) {
      tables[tIdx].active_order_id = order.id;
      tables[tIdx].active_order_number = order.order_number;
      tables[tIdx].current_bill_amount = order.total_amount;
      tables[tIdx].status = 'occupied';
      tables[tIdx].last_activity_at = now;
      setLocalStore(LOCAL_STORAGE_TABLES, tables);
    }
  }

  // Record status history & audit
  const history = getLocalStore<OrderStatusHistory[]>(LOCAL_STORAGE_STATUS_HISTORY, []);
  history.push({
    id: 'osh_' + Date.now().toString(36),
    order_id: orderId,
    previous_status: 'PENDING',
    new_status: 'ACCEPTED',
    changed_by_role: 'WAITER',
    changed_by_user_id: waiterId,
    notes: `Dining order approved by waiter ${waiterName}`,
    created_at: now,
  });
  setLocalStore(LOCAL_STORAGE_STATUS_HISTORY, history);

  await logStaffAction('ORDER', orderId, waiterName, 'APPROVE_DINING_ORDER', {
    orderNumber: order.order_number,
    tableId: order.table_id,
    total: order.total_amount,
  });

  // Realtime notification: updates KDS immediately
  publishRealtimeEvent({
    type: 'ORDER_APPROVED',
    orderId,
    tableId: order.table_id || undefined,
    tableNumber: order.table_number_snapshot || undefined,
    status: 'ACCEPTED',
    actorRole: 'WAITER',
    actorName: waiterName,
  });

  return order;
}

export async function rejectDiningOrder(
  orderId: string,
  reason: string,
  waiterId: string,
  waiterName: string
): Promise<Order> {
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is required');
  }

  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const order = orders[idx];
  if (order.order_status !== 'PENDING') {
    throw new Error(`Cannot reject order in status ${order.order_status}`);
  }

  const now = new Date().toISOString();
  order.order_status = 'REJECTED';
  order.status = 'REJECTED';
  order.rejection_reason = reason.trim();
  order.updated_at = now;

  // Mark all items cancelled
  if (order.items) {
    order.items = order.items.map((it) => ({
      ...it,
      status: 'CANCELLED',
      item_status: 'CANCELLED',
    }));
  }

  orders[idx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  // If table had this active order, clear it
  if (order.table_id) {
    const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
    const tIdx = tables.findIndex((t) => t.id === order.table_id);
    if (tIdx >= 0 && tables[tIdx].active_order_id === order.id) {
      tables[tIdx].active_order_id = null;
      tables[tIdx].active_order_number = null;
      tables[tIdx].current_bill_amount = 0;
      setLocalStore(LOCAL_STORAGE_TABLES, tables);
    }
  }

  const history = getLocalStore<OrderStatusHistory[]>(LOCAL_STORAGE_STATUS_HISTORY, []);
  history.push({
    id: 'osh_' + Date.now().toString(36),
    order_id: orderId,
    previous_status: 'PENDING',
    new_status: 'REJECTED',
    changed_by_role: 'WAITER',
    changed_by_user_id: waiterId,
    notes: `Rejected by waiter ${waiterName}: ${reason.trim()}`,
    created_at: now,
  });
  setLocalStore(LOCAL_STORAGE_STATUS_HISTORY, history);

  await logStaffAction('ORDER', orderId, waiterName, 'REJECT_DINING_ORDER', {
    orderNumber: order.order_number,
    reason: reason.trim(),
  });

  publishRealtimeEvent({
    type: 'ORDER_REJECTED',
    orderId,
    status: 'REJECTED',
    actorRole: 'WAITER',
    actorName: waiterName,
  });

  return order;
}

// ============================================================================
// BATCH 03: WAITER ORDER CREATION & ADDING ITEMS
// ============================================================================

export interface CreateWaiterOrderParams {
  tableId: string;
  guestCount: number;
  waiterId: string;
  waiterName: string;
  customerName?: string;
  customerMobile?: string;
  items: {
    menuItemId: string;
    variantName?: string;
    addonNames?: string[];
    quantity: number;
    specialInstructions?: string;
  }[];
  notes?: string;
}

export async function createWaiterOrder(params: CreateWaiterOrderParams): Promise<Order> {
  const tables = await fetchCafeTables();
  const table = tables.find((t) => t.id === params.tableId);
  if (!table) throw new Error(`Table ${params.tableId} not found`);

  const allMenuItems = await fetchMenuItems();
  const menuMap = new Map(allMenuItems.map((m) => [m.id, m]));

  const orderId = 'ord_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const orderNumber = generateDemoOrderNumber();
  const now = new Date().toISOString();

  let subtotal = 0;
  const orderItems: OrderItem[] = [];

  for (const rawItem of params.items) {
    const menuItem = menuMap.get(rawItem.menuItemId);
    if (!menuItem) {
      throw new Error(`Menu item ${rawItem.menuItemId} not found`);
    }

    let unitPrice = menuItem.base_price ?? menuItem.price ?? 0;
    let variantSnapshot: { name: string; price_delta: number } | null = null;

    if (rawItem.variantName && menuItem.variants) {
      const foundVar = menuItem.variants.find((v) => v.name === rawItem.variantName);
      if (foundVar) {
        unitPrice += foundVar.price_delta;
        variantSnapshot = { name: foundVar.name, price_delta: foundVar.price_delta };
      }
    }

    const addonsSnapshot: { name: string; price: number }[] = [];
    if (rawItem.addonNames && menuItem.addons) {
      for (const aName of rawItem.addonNames) {
        const foundAddon = menuItem.addons.find((a) => a.name === aName);
        if (foundAddon) {
          unitPrice += foundAddon.price;
          addonsSnapshot.push({ name: foundAddon.name, price: foundAddon.price });
        }
      }
    }

    unitPrice = roundMoney(unitPrice);
    const totalPrice = roundMoney(unitPrice * rawItem.quantity);
    subtotal = roundMoney(subtotal + totalPrice);

    orderItems.push({
      id: 'oi_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      order_id: orderId,
      menu_item_id: menuItem.id,
      item_name_snapshot: menuItem.name,
      is_veg: menuItem.is_veg,
      unit_price_snapshot: unitPrice,
      quantity: rawItem.quantity,
      total_price: totalPrice,
      variant_snapshot: variantSnapshot,
      variant_name_snapshot: variantSnapshot?.name || null,
      addons_snapshot: addonsSnapshot,
      addon_names_snapshot: addonsSnapshot.map((a) => a.name),
      special_instructions: rawItem.specialInstructions || '',
      tax_rate_snapshot: 5.0,
      status: 'QUEUED',
      item_status: 'QUEUED',
      kitchen_station_id: menuItem.kitchen_station_id || 's0000000-0000-0000-0000-000000000001',
      station_code: menuItem.station_code || 'MAIN_KITCHEN',
      estimated_prep_mins: menuItem.preparation_time_mins || 15,
      created_at: now,
    });
  }

  const taxConfig = await fetchTaxConfiguration();
  const taxResult = calculateOrderTaxes(subtotal, 0, taxConfig);

  const newOrder: Order = {
    id: orderId,
    order_number: orderNumber,
    customer_id: null,
    customer_name_snapshot: params.customerName?.trim() || 'Walk-in Guest',
    customer_mobile_snapshot: params.customerMobile?.trim() || '0000000000',
    customer_email_snapshot: null,
    order_type: 'DINING',
    table_id: table.id,
    table_number_snapshot: table.table_number,
    guest_count: params.guestCount,
    waiter_id: params.waiterId,
    waiter_name: params.waiterName,
    pickup_time_slot: null,
    pickup_slot_snapshot: null,
    pickup_notes: null,
    subtotal,
    discount_amount: 0,
    discount_code: null,
    tax_amount: taxResult.taxAmount,
    tax_breakdown: taxResult.taxBreakdown,
    total_amount: taxResult.totalPayable,
    outstanding_balance: taxResult.totalPayable,
    payment_method: 'PAY_AFTER_MEAL',
    payment_status: 'UNPAID',
    order_status: 'ACCEPTED',
    status: 'ACCEPTED',
    special_instructions: params.notes || null,
    notes: params.notes || null,
    items: orderItems,
    created_at: now,
    updated_at: now,
  };

  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  orders.unshift(newOrder);
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  // Update table status
  await updateTableStatus(
    table.id,
    'occupied',
    params.guestCount,
    params.waiterId,
    params.waiterName,
    params.waiterName
  );

  // Re-save table with active order
  const allTables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
  const tIdx = allTables.findIndex((t) => t.id === table.id);
  if (tIdx >= 0) {
    allTables[tIdx].active_order_id = newOrder.id;
    allTables[tIdx].active_order_number = newOrder.order_number;
    allTables[tIdx].current_bill_amount = newOrder.total_amount;
    setLocalStore(LOCAL_STORAGE_TABLES, allTables);
  }

  // Audit
  await logStaffAction('ORDER', newOrder.id, params.waiterName, 'CREATE_WAITER_ORDER', {
    orderNumber: newOrder.order_number,
    table: table.table_number,
    guestCount: params.guestCount,
    total: newOrder.total_amount,
  });

  publishRealtimeEvent({
    type: 'ORDER_CREATED',
    orderId: newOrder.id,
    tableId: table.id,
    tableNumber: table.table_number,
    status: 'ACCEPTED',
    actorRole: 'WAITER',
    actorName: params.waiterName,
  });

  return newOrder;
}

export async function addItemsToExistingOrder(
  orderId: string,
  newItems: {
    menuItemId: string;
    variantName?: string;
    addonNames?: string[];
    quantity: number;
    specialInstructions?: string;
  }[],
  actorName: string = 'Staff'
): Promise<Order> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const order = orders[idx];
  if (order.order_status === 'COMPLETED' || order.order_status === 'CANCELLED' || order.order_status === 'REJECTED') {
    throw new Error(`Cannot add items to order in status ${order.order_status}`);
  }

  const allMenuItems = await fetchMenuItems();
  const menuMap = new Map(allMenuItems.map((m) => [m.id, m]));
  const now = new Date().toISOString();

  let addedSubtotal = 0;
  const addedItems: OrderItem[] = [];

  for (const rawItem of newItems) {
    const menuItem = menuMap.get(rawItem.menuItemId);
    if (!menuItem) continue;

    let unitPrice = menuItem.base_price ?? menuItem.price ?? 0;
    let variantSnapshot: { name: string; price_delta: number } | null = null;

    if (rawItem.variantName && menuItem.variants) {
      const foundVar = menuItem.variants.find((v) => v.name === rawItem.variantName);
      if (foundVar) {
        unitPrice += foundVar.price_delta;
        variantSnapshot = { name: foundVar.name, price_delta: foundVar.price_delta };
      }
    }

    const addonsSnapshot: { name: string; price: number }[] = [];
    if (rawItem.addonNames && menuItem.addons) {
      for (const aName of rawItem.addonNames) {
        const foundAddon = menuItem.addons.find((a) => a.name === aName);
        if (foundAddon) {
          unitPrice += foundAddon.price;
          addonsSnapshot.push({ name: foundAddon.name, price: foundAddon.price });
        }
      }
    }

    unitPrice = roundMoney(unitPrice);
    const totalPrice = roundMoney(unitPrice * rawItem.quantity);
    addedSubtotal = roundMoney(addedSubtotal + totalPrice);

    addedItems.push({
      id: 'oi_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      order_id: order.id,
      menu_item_id: menuItem.id,
      item_name_snapshot: menuItem.name,
      is_veg: menuItem.is_veg,
      unit_price_snapshot: unitPrice,
      quantity: rawItem.quantity,
      total_price: totalPrice,
      variant_snapshot: variantSnapshot,
      variant_name_snapshot: variantSnapshot?.name || null,
      addons_snapshot: addonsSnapshot,
      addon_names_snapshot: addonsSnapshot.map((a) => a.name),
      special_instructions: rawItem.specialInstructions || '',
      tax_rate_snapshot: 5.0,
      status: 'QUEUED',
      item_status: 'QUEUED',
      kitchen_station_id: menuItem.kitchen_station_id || 's0000000-0000-0000-0000-000000000001',
      station_code: menuItem.station_code || 'MAIN_KITCHEN',
      estimated_prep_mins: menuItem.preparation_time_mins || 15,
      created_at: now,
    });
  }

  order.items = [...(order.items || []), ...addedItems];
  order.subtotal = roundMoney(order.subtotal + addedSubtotal);

  const taxConfig = await fetchTaxConfiguration();
  const taxResult = calculateOrderTaxes(order.subtotal, order.discount_amount, taxConfig);
  order.tax_amount = taxResult.taxAmount;
  order.tax_breakdown = taxResult.taxBreakdown;
  order.total_amount = taxResult.totalPayable;
  order.outstanding_balance = roundMoney(order.total_amount - (order.payment_status === 'PAID' ? order.total_amount : 0));
  order.updated_at = now;

  orders[idx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  // Update table bill
  if (order.table_id) {
    const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
    const tIdx = tables.findIndex((t) => t.id === order.table_id);
    if (tIdx >= 0) {
      tables[tIdx].current_bill_amount = order.total_amount;
      setLocalStore(LOCAL_STORAGE_TABLES, tables);
    }
  }

  await logStaffAction('ORDER', order.id, actorName, 'ADD_ITEMS_TO_ORDER', {
    addedItemsCount: addedItems.length,
    newTotal: order.total_amount,
  });

  publishRealtimeEvent({
    type: 'ORDER_ITEMS_ADDED',
    orderId: order.id,
    tableId: order.table_id || undefined,
    status: order.order_status,
    actorName,
  });

  return order;
}

// ============================================================================
// BATCH 03: ITEM-LEVEL PREPARATION & KDS TIMERS
// ============================================================================

export const VALID_ITEM_TRANSITIONS: Record<OrderItemStatus, OrderItemStatus[]> = {
  QUEUED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['PREPARATION_COMPLETED', 'READY', 'CANCELLED'],
  PREPARATION_COMPLETED: ['READY', 'SERVED', 'CANCELLED'],
  READY: ['SERVED', 'CANCELLED'],
  SERVED: [],
  CANCELLED: [],
};

export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  newStatus: OrderItemStatus,
  staffName: string = 'Chef'
): Promise<Order> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const orderIdx = orders.findIndex((o) => o.id === orderId);
  if (orderIdx === -1) throw new Error('Order not found');

  const order = orders[orderIdx];
  const item = order.items?.find((i) => i.id === itemId);
  if (!item) throw new Error('Order item not found');

  const currentItemStatus = item.item_status || item.status || 'QUEUED';
  const allowed = VALID_ITEM_TRANSITIONS[currentItemStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot transition item status from ${currentItemStatus} to ${newStatus}`);
  }

  const now = new Date().toISOString();
  item.item_status = newStatus;
  item.status = newStatus;

  if (newStatus === 'PREPARING' && !item.preparation_started_at) {
    item.preparation_started_at = now;
  } else if (newStatus === 'PREPARATION_COMPLETED') {
    item.preparation_completed_at = now;
  } else if (newStatus === 'READY') {
    item.ready_at = now;
  } else if (newStatus === 'SERVED') {
    item.served_at = now;
  }

  // Parent Order Status Aggregation
  const activeItems = (order.items || []).filter((i) => (i.item_status || i.status) !== 'CANCELLED');
  if (activeItems.length > 0) {
    const allServed = activeItems.every((i) => (i.item_status || i.status) === 'SERVED');
    const allReadyOrServed = activeItems.every((i) => ['READY', 'SERVED'].includes(i.item_status || i.status || ''));
    const allPrepCompleted = activeItems.every((i) => ['PREPARATION_COMPLETED', 'READY', 'SERVED'].includes(i.item_status || i.status || ''));
    const anyPreparing = activeItems.some((i) => (i.item_status || i.status) === 'PREPARING');

    if (allServed && order.order_type === 'DINING') {
      order.order_status = 'SERVED';
      order.status = 'SERVED';
      order.served_at = now;
    } else if (allReadyOrServed) {
      if (order.order_type === 'DINING') {
        order.order_status = 'READY_FOR_SERVICE';
        order.status = 'READY_FOR_SERVICE';
      } else {
        order.order_status = 'READY_FOR_PICKUP';
        order.status = 'READY_FOR_PICKUP';
      }
      order.ready_at = now;
    } else if (allPrepCompleted && order.order_status === 'PREPARING') {
      order.order_status = 'PREPARATION_COMPLETED';
      order.status = 'PREPARATION_COMPLETED';
    } else if (anyPreparing && order.order_status === 'ACCEPTED') {
      order.order_status = 'PREPARING';
      order.status = 'PREPARING';
      order.preparation_started_at = now;
    }
  }

  order.updated_at = now;
  orders[orderIdx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  await logStaffAction('ORDER_ITEM', itemId, staffName, 'UPDATE_ITEM_STATUS', {
    orderId,
    orderNumber: order.order_number,
    newStatus,
    parentOrderStatus: order.order_status,
  });

  publishRealtimeEvent({
    type: 'ITEM_STATUS_CHANGED',
    orderId,
    itemId,
    status: newStatus,
    actorName: staffName,
  });

  return order;
}

export async function startTicketPreparation(orderId: string, staffName: string = 'Chef'): Promise<Order> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const order = orders[idx];
  const now = new Date().toISOString();

  if (order.items) {
    order.items = order.items.map((it) => {
      if ((it.item_status || it.status) === 'QUEUED') {
        return {
          ...it,
          status: 'PREPARING',
          item_status: 'PREPARING',
          preparation_started_at: it.preparation_started_at || now,
        };
      }
      return it;
    });
  }

  order.order_status = 'PREPARING';
  order.status = 'PREPARING';
  order.preparation_started_at = order.preparation_started_at || now;
  order.updated_at = now;

  orders[idx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  publishRealtimeEvent({
    type: 'ORDER_STATUS_CHANGED',
    orderId,
    status: 'PREPARING',
    actorName: staffName,
  });

  return order;
}

export async function markTicketAllReady(orderId: string, staffName: string = 'Chef'): Promise<Order> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const order = orders[idx];
  const now = new Date().toISOString();

  if (order.items) {
    order.items = order.items.map((it) => {
      if ((it.item_status || it.status) !== 'CANCELLED' && (it.item_status || it.status) !== 'SERVED') {
        return {
          ...it,
          status: 'READY',
          item_status: 'READY',
          ready_at: now,
        };
      }
      return it;
    });
  }

  const newStatus = order.order_type === 'DINING' ? 'READY_FOR_SERVICE' : 'READY_FOR_PICKUP';
  order.order_status = newStatus;
  order.status = newStatus;
  order.ready_at = now;
  order.updated_at = now;

  orders[idx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  publishRealtimeEvent({
    type: 'ORDER_STATUS_CHANGED',
    orderId,
    status: newStatus,
    actorName: staffName,
  });

  return order;
}

export async function markOrderServed(orderId: string, staffName: string = 'Waiter'): Promise<Order> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const order = orders[idx];
  const now = new Date().toISOString();

  if (order.items) {
    order.items = order.items.map((it) => {
      if ((it.item_status || it.status) !== 'CANCELLED') {
        return {
          ...it,
          status: 'SERVED',
          item_status: 'SERVED',
          served_at: now,
        };
      }
      return it;
    });
  }

  order.order_status = 'SERVED';
  order.status = 'SERVED';
  order.served_at = now;
  order.updated_at = now;

  orders[idx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  publishRealtimeEvent({
    type: 'ORDER_STATUS_CHANGED',
    orderId,
    status: 'SERVED',
    actorName: staffName,
  });

  return order;
}

// ============================================================================
// BATCH 03: BILL SPLITTING & SETTLEMENT ENGINE
// ============================================================================

export async function fetchBillSplits(orderId: string): Promise<BillSplit[]> {
  const allSplits = getLocalStore<BillSplit[]>(LOCAL_STORAGE_BILL_SPLITS, []);
  return allSplits.filter((s) => s.order_id === orderId);
}

export async function createBillSplits(
  orderId: string,
  splitType: BillSplitType,
  options: {
    splitCount?: number;
    customAmounts?: number[];
    itemAssignments?: Record<number, string[]>;
  }
): Promise<BillSplit[]> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const orderIdx = orders.findIndex((o) => o.id === orderId);
  if (orderIdx === -1) throw new Error('Order not found');

  const order = orders[orderIdx];
  // Reconcile to outstanding balance if partially paid, otherwise total amount
  const total = (order.outstanding_balance != null && order.outstanding_balance > 0 && order.outstanding_balance <= order.total_amount)
    ? order.outstanding_balance
    : order.total_amount;

  const splits: BillSplit[] = [];
  const now = new Date().toISOString();

  if (splitType === 'EQUAL') {
    const N = Math.max(2, options.splitCount || 2);
    const totalPaise = Math.round(total * 100);
    const basePaise = Math.floor(totalPaise / N);
    const remainderPaise = totalPaise % N;

    for (let i = 1; i <= N; i++) {
      const splitPaise = basePaise + (i <= remainderPaise ? 1 : 0);
      splits.push({
        id: 'split_' + Date.now().toString(36) + '_' + i,
        order_id: orderId,
        split_index: i,
        label: `Guest ${i}`,
        split_type: 'EQUAL',
        amount: roundMoney(splitPaise / 100),
        payment_status: 'UNPAID',
        payment_method: null,
        transaction_reference: null,
        paid_at: null,
        created_at: now,
      });
    }
  } else if (splitType === 'CUSTOM') {
    const amounts = options.customAmounts || [];
    if (amounts.length < 2) {
      throw new Error('Custom split requires at least 2 guest amounts');
    }
    const sum = roundMoney(amounts.reduce((a, b) => a + b, 0));
    if (Math.abs(sum - total) > 0.01) {
      throw new Error(
        `Sum of split amounts (₹${sum.toFixed(2)}) does not match total payable bill (₹${total.toFixed(2)}). Difference: ₹${roundMoney(total - sum).toFixed(2)}`
      );
    }

    amounts.forEach((amt, idx) => {
      splits.push({
        id: 'split_' + Date.now().toString(36) + '_' + (idx + 1),
        order_id: orderId,
        split_index: idx + 1,
        label: `Guest ${idx + 1}`,
        split_type: 'CUSTOM',
        amount: roundMoney(amt),
        payment_status: 'UNPAID',
        payment_method: null,
        transaction_reference: null,
        paid_at: null,
        created_at: now,
      });
    });
  } else if (splitType === 'ITEMS') {
    const assignments = options.itemAssignments || {};
    const splitIndices = Object.keys(assignments).map(Number).sort((a, b) => a - b);
    if (splitIndices.length < 2) {
      throw new Error('Item split requires assignments for at least 2 guests');
    }

    const items = order.items || [];
    const itemMap = new Map(items.map((i) => [i.id, i]));
    // Derive effective tax rate directly from original order's snapshot without any hardcoded 5%
    const effectiveTaxRate = order.subtotal > 0 ? (order.tax_amount / order.subtotal) : 0;
    const discountRatio = order.subtotal > 0 ? ((order.discount_amount || 0) / order.subtotal) : 0;

    let allocatedPaise = 0;
    const targetTotalPaise = Math.round(total * 100);

    splitIndices.forEach((idx, arrIdx) => {
      const itemIds = assignments[idx] || [];
      let guestPaise = 0;

      if (arrIdx === splitIndices.length - 1) {
        // Last guest gets exact remaining paise to guarantee exact penny-perfect reconciliation
        guestPaise = targetTotalPaise - allocatedPaise;
      } else {
        const guestSubtotal = itemIds.reduce((sum, id) => {
          const it = itemMap.get(id);
          return sum + (it ? it.total_price : 0);
        }, 0);

        const guestTax = itemIds.reduce((taxSum, id) => {
          const it = itemMap.get(id);
          if (!it) return taxSum;
          const rate = it.tax_rate_snapshot != null ? it.tax_rate_snapshot : (effectiveTaxRate * 100);
          return taxSum + (it.total_price * (rate / 100));
        }, 0);

        const discountedSubtotal = guestSubtotal * (1 - discountRatio);
        const discountedTax = guestTax * (1 - discountRatio);
        const guestTotal = discountedSubtotal + discountedTax;

        guestPaise = Math.round(guestTotal * 100);
        allocatedPaise += guestPaise;
      }

      splits.push({
        id: 'split_' + Date.now().toString(36) + '_' + idx,
        order_id: orderId,
        split_index: idx,
        label: `Guest ${idx}`,
        split_type: 'ITEMS',
        amount: Math.max(0, roundMoney(guestPaise / 100)),
        item_ids: itemIds,
        payment_status: 'UNPAID',
        payment_method: null,
        transaction_reference: null,
        paid_at: null,
        created_at: now,
      });
    });
  }

  const allSplits = getLocalStore<BillSplit[]>(LOCAL_STORAGE_BILL_SPLITS, []);
  const otherSplits = allSplits.filter((s) => s.order_id !== orderId);
  setLocalStore(LOCAL_STORAGE_BILL_SPLITS, [...otherSplits, ...splits]);

  order.is_split_bill = true;
  order.split_count = splits.length;
  order.outstanding_balance = total;
  order.bill_splits = splits;
  orders[orderIdx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  publishRealtimeEvent({
    type: 'BILL_SPLIT_UPDATED',
    orderId,
  });

  return splits;
}

export async function settleBillSplit(
  splitId: string,
  paymentMethod: PaymentMethod,
  actorName: string = 'Staff'
): Promise<{ split: BillSplit; order: Order }> {
  const allSplits = getLocalStore<BillSplit[]>(LOCAL_STORAGE_BILL_SPLITS, []);
  const splitIdx = allSplits.findIndex((s) => s.id === splitId);
  if (splitIdx === -1) throw new Error('Bill split record not found');

  const split = allSplits[splitIdx];
  if (split.payment_status === 'PAID') {
    throw new Error('This split bill has already been settled');
  }

  const txnRef = generateDemoTransactionRef();
  const now = new Date().toISOString();

  split.payment_status = 'PAID';
  split.payment_method = paymentMethod;
  split.transaction_reference = txnRef;
  split.paid_at = now;

  allSplits[splitIdx] = split;
  setLocalStore(LOCAL_STORAGE_BILL_SPLITS, allSplits);

  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const orderIdx = orders.findIndex((o) => o.id === split.order_id);
  if (orderIdx === -1) throw new Error('Parent order not found');

  const order = orders[orderIdx];
  const orderSplits = allSplits.filter((s) => s.order_id === order.id);
  const paidAmount = roundMoney(
    orderSplits.filter((s) => s.payment_status === 'PAID').reduce((sum, s) => sum + s.amount, 0)
  );
  const remaining = roundMoney(Math.max(0, order.total_amount - paidAmount));
  order.outstanding_balance = remaining;
  order.bill_splits = orderSplits;

  if (remaining === 0) {
    order.payment_status = 'PAID';
  }

  orders[orderIdx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  const txns = getLocalStore<PaymentTransaction[]>(LOCAL_STORAGE_TRANSACTIONS, []);
  txns.push({
    id: 'txn_' + Date.now().toString(36),
    payment_id: split.id,
    transaction_reference: txnRef,
    transaction_number: txnRef,
    gateway_provider: 'SIMULATED_SPLIT_GATEWAY',
    status: 'SUCCESS',
    amount: split.amount,
    gateway_response: { method: paymentMethod, is_demo: true, split_index: split.split_index },
    created_at: now,
  });
  setLocalStore(LOCAL_STORAGE_TRANSACTIONS, txns);

  await logStaffAction('BILL', split.id, actorName, 'SETTLE_BILL_SPLIT', {
    orderNumber: order.order_number,
    splitIndex: split.split_index,
    amount: split.amount,
    paymentMethod,
    remainingBalance: remaining,
  });

  publishRealtimeEvent({
    type: 'BILL_SPLIT_PAID',
    splitId: split.id,
    orderId: order.id,
    actorName,
  });

  return { split, order };
}

export async function closeCompletedOrder(orderId: string, actorName: string = 'Staff'): Promise<Order> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const idx = orders.findIndex((o) => o.id === orderId);
  if (idx === -1) throw new Error('Order not found');

  const order = orders[idx];
  if (order.payment_status !== 'PAID') {
    throw new Error(
      `Cannot close order: Bill has outstanding unpaid balance of ₹${(order.outstanding_balance ?? order.total_amount).toFixed(2)}`
    );
  }

  const now = new Date().toISOString();
  order.order_status = 'COMPLETED';
  order.status = 'COMPLETED';
  order.updated_at = now;

  orders[idx] = order;
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  if (order.table_id) {
    const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
    const tIdx = tables.findIndex((t) => t.id === order.table_id);
    if (tIdx >= 0) {
      tables[tIdx].status = 'cleaning';
      tables[tIdx].active_order_id = null;
      tables[tIdx].active_order_number = null;
      tables[tIdx].current_bill_amount = 0;
      tables[tIdx].last_activity_at = now;
      setLocalStore(LOCAL_STORAGE_TABLES, tables);
    }
  }

  await logStaffAction('ORDER', order.id, actorName, 'CLOSE_ORDER', {
    orderNumber: order.order_number,
    total: order.total_amount,
  });

  publishRealtimeEvent({
    type: 'ORDER_STATUS_CHANGED',
    orderId,
    status: 'COMPLETED',
    actorName,
  });

  return order;
}

// ---------------------------------------------------------------------------
// 22. Admin Command Centre & Repository Extensions
// ---------------------------------------------------------------------------

export async function fetchAdminActivityLogs(): Promise<AdminActivityLog[]> {
  return getLocalStore<AdminActivityLog[]>(LOCAL_STORAGE_ADMIN_ACTIVITY, INITIAL_ADMIN_ACTIVITY);
}

export async function recordAdminAction(
  actorOrData: string | { actor: string; action: string; category: AdminActivityLog['category']; details?: string },
  actionArg?: string,
  categoryArg?: AdminActivityLog['category'],
  detailsArg?: string
): Promise<AdminActivityLog> {
  const actor = typeof actorOrData === 'object' ? actorOrData.actor : actorOrData;
  const action = typeof actorOrData === 'object' ? actorOrData.action : actionArg || '';
  const category = typeof actorOrData === 'object' ? actorOrData.category : categoryArg || 'SETTINGS';
  const details = typeof actorOrData === 'object' ? actorOrData.details : detailsArg;

  const logs = getLocalStore<AdminActivityLog[]>(LOCAL_STORAGE_ADMIN_ACTIVITY, INITIAL_ADMIN_ACTIVITY);
  const newLog: AdminActivityLog = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    actor: actor || 'Administrator',
    action,
    category,
    details,
    timestamp: new Date().toISOString(),
  };
  const updatedLogs = [newLog, ...logs].slice(0, 100);
  setLocalStore(LOCAL_STORAGE_ADMIN_ACTIVITY, updatedLogs);
  return newLog;
}

export async function saveCafeTable(table: CafeTable): Promise<CafeTable> {
  const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
  const idx = tables.findIndex((t) => t.id === table.id);

  // Validate duplicate table numbers
  const isDuplicateNumber = tables.some(
    (t) => t.id !== table.id && t.table_number.trim().toUpperCase() === table.table_number.trim().toUpperCase()
  );
  if (isDuplicateNumber) {
    throw new Error(`Table number ${table.table_number} already exists.`);
  }

  if (idx >= 0) {
    tables[idx] = { ...tables[idx], ...table };
  } else {
    tables.push(table);
  }
  setLocalStore(LOCAL_STORAGE_TABLES, tables);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('cafe_tables').upsert(table);
    } catch (e) {
      console.warn('Remote table upsert failed, preserved locally:', e);
    }
  }

  await recordAdminAction('Administrator', `Saved table ${table.table_number}`, 'TABLES', `${table.section} (${table.seating_capacity} seats)`);
  return table;
}

export async function deleteCafeTable(tableId: string): Promise<boolean> {
  const tables = getLocalStore<CafeTable[]>(LOCAL_STORAGE_TABLES, INITIAL_TABLES);
  const target = tables.find((t) => t.id === tableId);
  if (!target) return false;

  // Safe deactivation instead of hard historical delete
  target.is_active = false;
  setLocalStore(LOCAL_STORAGE_TABLES, tables);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('cafe_tables').update({ is_active: false }).eq('id', tableId);
    } catch (e) {
      console.warn('Remote table deactivation failed:', e);
    }
  }

  await recordAdminAction('Administrator', `Deactivated table ${target.table_number}`, 'TABLES');
  return true;
}

export async function saveDiscount(discount: Discount): Promise<Discount> {
  const discounts = getLocalStore<Discount[]>(LOCAL_STORAGE_DISCOUNTS, INITIAL_DISCOUNTS);
  const idx = discounts.findIndex((d) => d.id === discount.id);
  if (idx >= 0) {
    discounts[idx] = { ...discounts[idx], ...discount };
  } else {
    discounts.push(discount);
  }
  setLocalStore(LOCAL_STORAGE_DISCOUNTS, discounts);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('discounts').upsert(discount);
    } catch (e) {
      console.warn('Remote discount upsert failed, preserved locally:', e);
    }
  }

  await recordAdminAction('Administrator', `Saved promotion code ${discount.code}`, 'PROMOTIONS');
  return discount;
}

export async function deleteDiscount(discountId: string): Promise<boolean> {
  const discounts = getLocalStore<Discount[]>(LOCAL_STORAGE_DISCOUNTS, INITIAL_DISCOUNTS);
  const target = discounts.find((d) => d.id === discountId);
  const filtered = discounts.filter((d) => d.id !== discountId);
  setLocalStore(LOCAL_STORAGE_DISCOUNTS, filtered);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('discounts').delete().eq('id', discountId);
    } catch (e) {
      console.warn('Remote discount delete failed:', e);
    }
  }

  if (target) {
    await recordAdminAction('Administrator', `Removed promotion ${target.code}`, 'PROMOTIONS');
  }
  return true;
}

export async function fetchStaffProfiles(): Promise<UserProfile[]> {
  return getLocalStore<UserProfile[]>(LOCAL_STORAGE_STAFF_PROFILES, DEMO_PROFILES);
}

export async function saveStaffProfile(profile: UserProfile): Promise<UserProfile> {
  const staff = getLocalStore<UserProfile[]>(LOCAL_STORAGE_STAFF_PROFILES, DEMO_PROFILES);
  const idx = staff.findIndex((s) => s.id === profile.id);
  if (idx >= 0) {
    staff[idx] = { ...staff[idx], ...profile };
  } else {
    staff.push(profile);
  }
  setLocalStore(LOCAL_STORAGE_STAFF_PROFILES, staff);

  await recordAdminAction('Administrator', `Updated staff member ${profile.full_name} (${profile.role_id})`, 'STAFF');
  return profile;
}

export async function deleteStaffProfile(profileId: string): Promise<boolean> {
  const staff = getLocalStore<UserProfile[]>(LOCAL_STORAGE_STAFF_PROFILES, DEMO_PROFILES);
  const target = staff.find((s) => s.id === profileId);
  if (!target) return false;

  // Protect last active administrator from removal or demotion
  if (target.role_id === 'admin') {
    const activeAdminCount = staff.filter((s) => s.role_id === 'admin' && s.is_active).length;
    if (activeAdminCount <= 1) {
      throw new Error('Cannot remove or demote the last active Administrator account.');
    }
  }

  const filtered = staff.filter((s) => s.id !== profileId);
  setLocalStore(LOCAL_STORAGE_STAFF_PROFILES, filtered);

  await recordAdminAction('Administrator', `Removed staff account ${target.full_name}`, 'STAFF');
  return true;
}
