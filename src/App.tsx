import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { OrderModeProvider } from './context/OrderModeContext';
import { CustomerProvider } from './context/CustomerContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { fetchMenuCategories, fetchMenuItems } from './lib/supabase';
import { MenuCategory, MenuItem } from './types';

// Layout & Modals
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { CartDrawer } from './components/cart/CartDrawer';
import { ItemDetailModal } from './components/menu/ItemDetailModal';
import { CustomerRegisterModal } from './components/customer/CustomerRegisterModal';
import { CustomerProfileModal } from './components/customer/CustomerProfileModal';
import { TableSelectorModal } from './components/dining/TableSelectorModal';

// Pages
import { HomePage } from './pages/HomePage';
import { MenuPage } from './pages/MenuPage';
import { TableEntryPage } from './pages/TableEntryPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { OrderTrackingPage } from './pages/OrderTrackingPage';
import { ProfilePage } from './pages/ProfilePage';
import { PortalLogin } from './pages/auth/PortalLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminMenuPage } from './pages/admin/AdminMenuPage';
import { AdminOrdersPage } from './pages/admin/AdminOrdersPage';
import { AdminCustomersPage } from './pages/admin/AdminCustomersPage';
import { AdminWebsitePage } from './pages/admin/AdminWebsitePage';
import { AdminPromotionsPage } from './pages/admin/AdminPromotionsPage';
import { AdminQRPage } from './pages/admin/AdminQRPage';
import { AdminStaffPage } from './pages/admin/AdminStaffPage';
import { AdminBillingPage } from './pages/admin/AdminBillingPage';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminActivityPage } from './pages/admin/AdminActivityPage';
import { StaffPortal } from './pages/staff/StaffPortal';
import { KitchenPortal } from './pages/kitchen/KitchenPortal';
import { ProtectedRoute } from './routes/ProtectedRoute';

// Scroll to top helper
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Main App Layout Wrapper
const AppLayout: React.FC = () => {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItemForModal, setSelectedItemForModal] = useState<MenuItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Load menu categories and items on mount
  useEffect(() => {
    fetchMenuCategories().then(setCategories);
    fetchMenuItems().then(setMenuItems);
  }, []);

  const handleSelectItem = (item: MenuItem) => {
    setSelectedItemForModal(item);
    setIsItemModalOpen(true);
  };

  const handleCloseItemModal = () => {
    setIsItemModalOpen(false);
    setSelectedItemForModal(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-warm-white text-brand-black selection:bg-brand-yellow selection:text-brand-black font-sans">
      <ScrollToTop />

      {/* Global Navigation */}
      <Navbar
        onOpenTableSelector={() => setIsTableModalOpen(true)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
      />

      {/* Route Views */}
      <main className="flex-1">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                categories={categories}
                menuItems={menuItems}
                onSelectItem={handleSelectItem}
                onOpenTableSelector={() => setIsTableModalOpen(true)}
              />
            }
          />
          <Route
            path="/menu"
            element={
              <MenuPage
                categories={categories}
                menuItems={menuItems}
                onSelectItem={handleSelectItem}
                onOpenTableSelector={() => setIsTableModalOpen(true)}
              />
            }
          />
          <Route path="/table/:tableNumber" element={<TableEntryPage />} />
          <Route
            path="/cart"
            element={
              <CartPage onOpenTableSelector={() => setIsTableModalOpen(true)} />
            }
          />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
          <Route path="/track/:orderId" element={<OrderTrackingPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Internal Portals & Auth */}
          <Route path="/auth/portal-login" element={<PortalLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/menu"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminMenuPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminOrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/customers"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminCustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/website"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminWebsitePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/promotions"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminPromotionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/qr"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminQRPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminStaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/billing"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminBillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/activity"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminActivityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute allowedRoles={['waiter', 'manager', 'cashier', 'admin']}>
                <StaffPortal />
              </ProtectedRoute>
            }
          />
          <Route
            path="/kitchen"
            element={
              <ProtectedRoute allowedRoles={['waiter', 'manager', 'admin', 'kitchen']}>
                <KitchenPortal />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>

      {/* Footer */}
      <Footer />

      {/* Mobile Sticky Bottom Navigation */}
      <MobileBottomNav onOpenProfile={() => setIsProfileModalOpen(true)} />

      {/* Global Slide-Over Cart Drawer */}
      <CartDrawer onOpenTableSelector={() => setIsTableModalOpen(true)} />

      {/* Food Item Customization Modal */}
      <ItemDetailModal
        item={selectedItemForModal}
        isOpen={isItemModalOpen}
        onClose={handleCloseItemModal}
      />

      {/* Customer Registration Modal */}
      <CustomerRegisterModal />

      {/* Customer Profile Modal */}
      <CustomerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Dining Table Selector Modal */}
      <TableSelectorModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <OrderModeProvider>
          <CustomerProvider>
            <CartProvider>
              <AuthProvider>
                <AppLayout />
              </AuthProvider>
            </CartProvider>
          </CustomerProvider>
        </OrderModeProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
