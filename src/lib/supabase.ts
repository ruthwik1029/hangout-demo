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
} from './mockData';

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

// Decimal-safe rounding helper
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

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

export async function saveCafeSettings(settings: CafeSettings): Promise<boolean> {
  if (isSupabaseConfigured()) {
    try {
      const { error } = await supabase
        .from('cafe_settings')
        .upsert(settings);
      if (!error) return true;
    } catch (e) {
      console.warn('Supabase saveCafeSettings failed, saving locally:', e);
    }
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
    try {
      const { error } = await supabase
        .from('tax_configurations')
        .upsert(config);
      if (!error) return true;
    } catch (e) {
      console.warn('Supabase saveTaxConfiguration failed, saving locally:', e);
    }
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
    try {
      const { error } = await supabase.from('pickup_settings').upsert(settings);
      if (!error) return true;
    } catch (e) {
      console.warn('Supabase savePickupSettings failed, saving locally:', e);
    }
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
    icon_name: category.icon_name || 'Coffee',
    image_url: category.image_url || 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80',
    is_active: category.is_active ?? true,
  };

  categories.push(newCat);
  setLocalStore(LOCAL_STORAGE_CATEGORIES, categories);
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('menu_categories').insert(newCat);
    } catch {
      // Fallback
    }
  }
  return newCat;
}

export async function deleteOrArchiveCategory(id: string): Promise<boolean> {
  const categories = await fetchMenuCategories();
  const filtered = categories.filter((c) => c.id !== id);
  setLocalStore(LOCAL_STORAGE_CATEGORIES, filtered);
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('menu_categories').update({ is_active: false }).eq('id', id);
    } catch {
      // Fallback
    }
  }
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
      items[idx] = updated;
      setLocalStore(LOCAL_STORAGE_MENU_ITEMS, items);
      if (isSupabaseConfigured()) {
        try {
          await supabase.from('menu_items').upsert(updated);
        } catch {
          // Fallback
        }
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
    image_url: item.image_url || 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80',
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

  items.push(newItem);
  setLocalStore(LOCAL_STORAGE_MENU_ITEMS, items);
  if (isSupabaseConfigured()) {
    try {
      await supabase.from('menu_items').insert(newItem);
    } catch {
      // Fallback
    }
  }
  return newItem;
}

export async function archiveMenuItem(id: string): Promise<boolean> {
  const items = await fetchAllAdminMenuItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx >= 0) {
    items[idx].is_available = false;
    items[idx].is_archived = true;
    setLocalStore(LOCAL_STORAGE_MENU_ITEMS, items);
    if (isSupabaseConfigured()) {
      try {
        await supabase.from('menu_items').update({ is_available: false }).eq('id', id);
      } catch {
        // Fallback
      }
    }
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
// 6. Cafe Tables Repository
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
      }

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
  const newOrderId = 'ord_' + Date.now().toString(36);
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
    orderData = {
      ...paramOrOrderData,
      status: paramOrOrderData.status || paramOrOrderData.order_status || 'PENDING',
      order_status: paramOrOrderData.order_status || paramOrOrderData.status || 'PENDING',
    };
    itemsData = itemsDataArg || [];
  }

  const createdOrder: Order = {
    ...orderData,
    id: newOrderId,
    order_number: orderNumber,
    created_at: timestamp,
    updated_at: timestamp,
    items: itemsData.map((item, idx) => ({
      ...item,
      id: `oi_${Date.now().toString(36)}_${idx}`,
      order_id: newOrderId,
      created_at: timestamp,
    })),
  };

  if (isSupabaseConfigured()) {
    try {
      const { data: dbOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          id: newOrderId,
          order_number: orderNumber,
          customer_id: orderData.customer_id,
          customer_name_snapshot: orderData.customer_name_snapshot,
          customer_mobile_snapshot: orderData.customer_mobile_snapshot,
          customer_email_snapshot: orderData.customer_email_snapshot,
          order_type: orderData.order_type,
          table_id: orderData.table_id,
          table_number_snapshot: orderData.table_number_snapshot,
          pickup_time_slot: orderData.pickup_time_slot,
          pickup_notes: orderData.pickup_notes,
          subtotal: orderData.subtotal,
          discount_amount: orderData.discount_amount,
          discount_code: orderData.discount_code,
          tax_amount: orderData.tax_amount,
          tax_breakdown: orderData.tax_breakdown,
          total_amount: orderData.total_amount,
          payment_method: orderData.payment_method,
          payment_status: orderData.payment_status,
          order_status: orderData.order_status,
          special_instructions: orderData.special_instructions,
        })
        .select()
        .single();

      if (!orderErr && dbOrder) {
        if (createdOrder.items && createdOrder.items.length > 0) {
          await supabase.from('order_items').insert(createdOrder.items);
        }
      }
    } catch (e) {
      console.warn('Supabase createOrder failed, fallback to local:', e);
    }
  }

  // Save to local store
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  orders.unshift(createdOrder);
  setLocalStore(LOCAL_STORAGE_ORDERS, orders);

  // Update customer order count and spending stats
  if (orderData.customer_id || orderData.customer_mobile_snapshot) {
    const customers = getLocalStore<Customer[]>(LOCAL_STORAGE_CUSTOMERS, []);
    const custIdx = customers.findIndex(
      (c) =>
        c.id === orderData.customer_id ||
        c.mobile_number === orderData.customer_mobile_snapshot
    );
    if (custIdx >= 0) {
      customers[custIdx].total_orders += 1;
      customers[custIdx].total_spent = roundMoney(
        customers[custIdx].total_spent + orderData.total_amount
      );
      customers[custIdx].last_visit_at = timestamp;
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

  return createdOrder;
}

export async function fetchOrders(filter?: {
  status?: string;
  orderType?: string;
  paymentStatus?: string;
  search?: string;
}): Promise<Order[]> {
  let orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);

  if (filter?.status && filter.status !== 'ALL') {
    orders = orders.filter((o) => o.order_status === filter.status);
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
        o.customer_name_snapshot.toLowerCase().includes(q) ||
        o.customer_mobile_snapshot.includes(q)
    );
  }

  return orders;
}

export async function fetchOrderById(idOrNumber: string): Promise<Order | null> {
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  return (
    orders.find(
      (o) =>
        o.id === idOrNumber ||
        o.order_number.toLowerCase() === idOrNumber.toLowerCase()
    ) || null
  );
}

export async function fetchCustomerOrders(
  mobileNumberOrId: string
): Promise<Order[]> {
  const clean = mobileNumberOrId.replace(/\D/g, '').slice(-10);
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  return orders.filter(
    (o) =>
      o.customer_id === mobileNumberOrId ||
      o.customer_mobile_snapshot === clean ||
      o.customer_mobile_snapshot.endsWith(clean)
  );
}

// Order State Machine Validation Rule Engine
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
  ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['PREPARATION_COMPLETED', 'READY_FOR_PICKUP', 'CANCELLED'],
  PREPARATION_COMPLETED: ['READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
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
  const idx = orders.findIndex((o) => o.id === orderId);

  if (idx === -1) {
    throw new Error('Order not found');
  }

  const currentOrder = orders[idx];
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
export async function processSimulatedPayment(params: {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  shouldFail?: boolean;
}): Promise<{
  success: boolean;
  payment: Payment;
  transaction: PaymentTransaction;
  error?: string;
}> {
  const timestamp = new Date().toISOString();
  const paymentId = 'pay_' + Date.now().toString(36);
  const txnRef = `TXN-DEMO-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`;

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

  // Update order's payment status in storage
  const orders = getLocalStore<Order[]>(LOCAL_STORAGE_ORDERS, INITIAL_ORDERS);
  const ordIdx = orders.findIndex((o) => o.id === params.orderId);
  if (ordIdx >= 0) {
    orders[ordIdx].payment_status = paymentStatus;
    orders[ordIdx].updated_at = timestamp;
    setLocalStore(LOCAL_STORAGE_ORDERS, orders);
  }

  // Persist payments & transactions
  const payments = getLocalStore<Payment[]>(LOCAL_STORAGE_PAYMENTS, []);
  payments.push(paymentObj);
  setLocalStore(LOCAL_STORAGE_PAYMENTS, payments);

  const txns = getLocalStore<PaymentTransaction[]>(LOCAL_STORAGE_TRANSACTIONS, []);
  txns.push(transactionObj);
  setLocalStore(LOCAL_STORAGE_TRANSACTIONS, txns);

  return {
    success: isSuccess || isPayLater,
    payment: paymentObj,
    transaction: transactionObj,
    error: isSuccess || isPayLater ? undefined : 'Simulated payment processing failed. Please retry.',
  };
}

// ---------------------------------------------------------------------------
// 10. Admin Customer Management & Audit Logs
// ---------------------------------------------------------------------------
export async function fetchAdminCustomers(searchQuery?: string): Promise<Customer[]> {
  let customers = getLocalStore<Customer[]>(LOCAL_STORAGE_CUSTOMERS, [
    {
      id: 'e0000000-0000-0000-0000-000000000001',
      full_name: 'Aarav Sharma',
      mobile_number: '9876543210',
      email: 'aarav.sharma@example.com',
      total_orders: 3,
      total_spent: 1840,
      last_visit_at: new Date().toISOString(),
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: 'cust-demo-sneha',
      full_name: 'Sneha Patel',
      mobile_number: '9822334455',
      email: 'sneha.p@example.com',
      total_orders: 1,
      total_spent: 609,
      last_visit_at: '2026-11-19T11:20:00Z',
      created_at: '2026-11-19T11:20:00Z',
    },
    {
      id: 'cust-demo-kabir',
      full_name: 'Kabir Mehta',
      mobile_number: '9711223344',
      email: null,
      total_orders: 1,
      total_spent: 441,
      last_visit_at: '2026-11-19T11:45:00Z',
      created_at: '2026-11-19T11:45:00Z',
    },
  ]);

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
