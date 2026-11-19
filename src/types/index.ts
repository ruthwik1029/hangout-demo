// HANGOUT Digital Platform - Core Type Definitions
// Batch 01 & Batch 02: Ordering Engine, Order Lifecycle, Payments, GST & Tax, Admin Portal

export type OrderMode = 'dining' | 'takeaway';
export type OrderType = 'DINING' | 'TAKEAWAY';

export type OrderStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'PREPARING'
  | 'PREPARATION_COMPLETED'
  | 'READY_FOR_PICKUP'
  | 'READY_FOR_SERVICE'
  | 'SERVED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'UNPAID' | 'REFUNDED';

export type PaymentMethod = 'UPI' | 'CARD' | 'CASH' | 'CASH_AT_COUNTER' | 'PAY_AFTER_MEAL';

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
  contact_phone?: string;
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

export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning';

export interface CafeTable {
  id: string;
  table_number: string;
  qr_code_identifier: string;
  seating_capacity: number;
  capacity?: number;
  section: string;
  status: TableStatus;
  is_active: boolean;
  guest_count?: number;
  assigned_waiter_id?: string | null;
  assigned_waiter_name?: string | null;
  active_order_id?: string | null;
  active_order_number?: string | null;
  current_bill_amount?: number;
  last_activity_at?: string;
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
  price?: number;
  image_url: string;
  is_veg: boolean;
  is_available: boolean;
  is_featured: boolean;
  is_today_special: boolean;
  preparation_time_mins: number;
  prep_time_minutes?: number;
  calories?: number;
  allergens?: string[];
  display_order: number;
  variants?: MenuItemVariant[];
  addons?: MenuItemAddon[];
  tax_category_id?: string;
  is_archived?: boolean;
  kitchen_station_id?: string;
  station_code?: string;
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

export type UserRole = 'admin' | 'manager' | 'waiter' | 'kitchen' | 'cashier';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role_id: UserRole;
  is_active: boolean;
  avatar_url?: string;
}

// ============================================================================
// BATCH 02: TAX, DISCOUNTS, ORDERS & PAYMENTS
// ============================================================================

export interface TaxBreakdown {
  is_gst_enabled: boolean;
  is_tax_inclusive: boolean;
  tax_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
}

export interface TaxConfiguration {
  id: string;
  is_gst_enabled: boolean;
  default_tax_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  is_tax_inclusive: boolean;
  gst_number: string;
  legal_business_name: string;
  tax_rate_percentage?: number;
  cgst_percentage?: number;
  sgst_percentage?: number;
}

export interface TaxCategory {
  id: string;
  name: string;
  rate: number;
  description?: string;
  is_active: boolean;
}

export interface Discount {
  id: string;
  code: string;
  description?: string;
  discount_type: 'PERCENTAGE' | 'FLAT';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number;
  is_active: boolean;
  valid_from?: string;
  valid_until?: string;
}

export type OrderItemStatus =
  | 'QUEUED'
  | 'PREPARING'
  | 'PREPARATION_COMPLETED'
  | 'READY'
  | 'SERVED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id?: string | null;
  item_name_snapshot: string;
  is_veg: boolean;
  unit_price_snapshot: number;
  quantity: number;
  total_price: number;
  variant_snapshot?: {
    name: string;
    price_delta: number;
  } | null;
  variant_name_snapshot?: string | null;
  addons_snapshot?: {
    name: string;
    price: number;
  }[];
  addon_names_snapshot?: string[];
  special_instructions?: string;
  tax_rate_snapshot: number;
  status?: OrderItemStatus;
  item_status?: OrderItemStatus;
  kitchen_station_id?: string;
  station_code?: string;
  preparation_started_at?: string | null;
  preparation_completed_at?: string | null;
  ready_at?: string | null;
  served_at?: string | null;
  estimated_prep_mins?: number;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string | null;
  customer_name_snapshot: string;
  customer_mobile_snapshot: string;
  customer_email_snapshot?: string | null;
  order_type: OrderType;
  table_id?: string | null;
  table_number_snapshot?: string | null;
  pickup_time_slot?: string | null;
  pickup_slot_snapshot?: string | null;
  pickup_notes?: string | null;
  subtotal: number;
  discount_amount: number;
  discount_code?: string | null;
  tax_amount: number;
  tax_breakdown: TaxBreakdown;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  status: OrderStatus;
  rejection_reason?: string | null;
  cancellation_reason?: string | null;
  special_instructions?: string | null;
  notes?: string | null;
  items?: OrderItem[];
  waiter_id?: string | null;
  waiter_name?: string | null;
  guest_count?: number | null;
  approved_by_waiter_id?: string | null;
  approved_at?: string | null;
  preparation_started_at?: string | null;
  ready_at?: string | null;
  served_at?: string | null;
  is_split_bill?: boolean;
  split_count?: number;
  outstanding_balance?: number;
  bill_splits?: BillSplit[];
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  is_demo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PaymentTransaction {
  id: string;
  payment_id: string;
  transaction_reference: string;
  transaction_number?: string;
  gateway_provider: string;
  status: 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'INITIATED';
  amount: number;
  gateway_response?: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  previous_status?: OrderStatus | null;
  new_status: OrderStatus;
  changed_by_role: string;
  changed_by_user_id?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  actor_role: string;
  actor_name: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface PickupSettings {
  id: string;
  is_online_ordering_paused: boolean;
  pause_reason?: string | null;
  is_asap_enabled: boolean;
  asap_estimated_minutes: number;
  slot_interval_minutes: number;
  advance_order_hours_limit: number;
  minimum_order_amount: number;
  pickup_policy_notice: string;
}

// ============================================================================
// BATCH 03: STAFF OPERATIONS, KITCHEN DISPLAY (KDS) & BILL SPLITTING
// ============================================================================

export type KitchenStationCode = 'MAIN_KITCHEN' | 'BEVERAGE' | 'BAKERY' | 'DESSERT' | string;

export interface KitchenStation {
  id: string;
  name: string;
  code: KitchenStationCode;
  description?: string;
  display_order: number;
  is_active: boolean;
}

export type BillSplitType = 'EQUAL' | 'ITEMS' | 'CUSTOM';

export interface BillSplit {
  id: string;
  order_id: string;
  split_index: number;
  label: string;
  split_type: BillSplitType;
  amount: number;
  item_ids?: string[];
  payment_status: 'UNPAID' | 'PAID';
  payment_method?: PaymentMethod | null;
  transaction_reference?: string | null;
  paid_at?: string | null;
  created_at: string;
}

export interface StaffAuditLog {
  id: string;
  staff_id?: string | null;
  staff_name: string;
  role: string;
  action: string;
  entity_type: 'TABLE' | 'ORDER' | 'ORDER_ITEM' | 'BILL' | 'STATION' | string;
  entity_id: string;
  details?: Record<string, unknown>;
  created_at: string;
}

