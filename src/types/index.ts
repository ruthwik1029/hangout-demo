// HANGOUT Digital Platform - Core Type Definitions
// Batch 01: Customer Website, Menu Architecture & Role Foundations

export type OrderMode = 'dining' | 'takeaway';

export interface Customer {
  id: string;
  full_name: string;
  mobile_number: string;
  email?: string | null;
  total_orders: number;
  total_spent: number;
  last_visit_at: string;
  created_at: string;
  updated_at?: string;
}

export interface CustomerSession {
  id: string;
  session_token: string;
  customer_id: string;
  table_id?: string | null;
  table_number?: string | null;
  order_mode: OrderMode;
  device_info?: string;
  expires_at: string;
  created_at: string;
}

export interface CafeSettings {
  id: string;
  cafe_name: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  opening_hours: {
    monday_to_friday: string;
    saturday_sunday: string;
  };
  dining_enabled: boolean;
  takeaway_enabled: boolean;
  gst_enabled: boolean;
  gst_percentage: number;
  gst_number: string;
  currency_symbol: string;
  currency_code: string;
  takeaway_notice: string;
}

export type TableStatus = 'available' | 'occupied' | 'reserved';

export interface CafeTable {
  id: string;
  table_number: string;
  qr_code_identifier: string;
  seating_capacity: number;
  section: string;
  status: TableStatus;
  is_active: boolean;
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  display_order: number;
  icon_name?: string;
  image_url?: string;
  is_active: boolean;
}

export interface MenuItemVariant {
  id: string;
  menu_item_id: string;
  variant_group: string;
  name: string;
  price_delta: number;
  is_default: boolean;
  is_available: boolean;
  display_order: number;
}

export interface MenuItemAddon {
  id: string;
  menu_item_id?: string | null;
  category_id?: string | null;
  name: string;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  display_order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  base_price: number;
  image_url: string;
  is_veg: boolean;
  is_available: boolean;
  is_featured: boolean;
  is_today_special: boolean;
  preparation_time_mins: number;
  calories?: number;
  allergens?: string[];
  display_order: number;
  variants?: MenuItemVariant[];
  addons?: MenuItemAddon[];
}

export interface CartItem {
  id: string; // Composite unique key: `${menuItem.id}-${variant?.id || 'none'}-${addonIds.sort().join('_')}`
  menuItem: MenuItem;
  selectedVariant?: MenuItemVariant;
  selectedAddons: MenuItemAddon[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialInstructions?: string;
  orderMode: OrderMode;
}

export type UserRole = 'admin' | 'manager' | 'waiter' | 'kitchen';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role_id: UserRole;
  is_active: boolean;
  avatar_url?: string;
}
