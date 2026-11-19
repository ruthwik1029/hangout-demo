import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { OrderModeProvider } from '../context/OrderModeContext';
import { CustomerProvider } from '../context/CustomerContext';
import { CartProvider } from '../context/CartContext';
import { AuthProvider } from '../context/AuthContext';
import { HomePage } from '../pages/HomePage';
import { MenuPage } from '../pages/MenuPage';
import { TableEntryPage } from '../pages/TableEntryPage';
import { CartPage } from '../pages/CartPage';
import { PortalLogin } from '../pages/auth/PortalLogin';
import { StaffPortal } from '../pages/staff/StaffPortal';
import { KitchenPortal } from '../pages/kitchen/KitchenPortal';
import { INITIAL_CATEGORIES, INITIAL_MENU_ITEMS } from '../lib/mockData';

const renderWithProviders = (initialRoute: string, element: React.ReactNode) => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ToastProvider>
        <OrderModeProvider>
          <CustomerProvider>
            <CartProvider>
              <AuthProvider>{element}</AuthProvider>
            </CartProvider>
          </CustomerProvider>
        </OrderModeProvider>
      </ToastProvider>
    </MemoryRouter>
  );
};

describe('Route Verification and Rendering', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders Customer Homepage cleanly with branding and mode selection', () => {
    renderWithProviders(
      '/',
      <HomePage
        categories={INITIAL_CATEGORIES}
        menuItems={INITIAL_MENU_ITEMS}
        onSelectItem={() => {}}
        onOpenTableSelector={() => {}}
      />
    );

    expect(screen.getByText(/Where specialty brews meet/i)).toBeInTheDocument();
    expect(screen.getByText(/Explore Full Menu/i)).toBeInTheDocument();
    expect(screen.getByText(/Today's Specials/i)).toBeInTheDocument();
    expect(screen.getByText(/Popular at HANGOUT/i)).toBeInTheDocument();
  });

  it('renders Full Menu Page with category navigation and items', () => {
    renderWithProviders(
      '/menu',
      <MenuPage
        categories={INITIAL_CATEGORIES}
        menuItems={INITIAL_MENU_ITEMS}
        onSelectItem={() => {}}
        onOpenTableSelector={() => {}}
      />
    );

    expect(screen.getByText(/HANGOUT Cafe Menu/i)).toBeInTheDocument();
    expect(screen.getByText(/Artisanal Coffee/i)).toBeInTheDocument();
    expect(screen.getByText(/Refreshers & Matcha/i)).toBeInTheDocument();
  });

  it('renders Table Entry Page recognizing table identifier T-04', async () => {
    renderWithProviders(
      '/table/T-04',
      <Routes>
        <Route path="/table/:tableNumber" element={<TableEntryPage />} />
      </Routes>
    );

    const headings = await screen.findAllByText(/Table T-04/i);
    expect(headings.length).toBeGreaterThan(0);
    const patio = await screen.findAllByText(/Sunny Patio/i);
    expect(patio.length).toBeGreaterThan(0);
  });

  it('renders Dedicated Cart and Order Summary Foundation', () => {
    renderWithProviders('/cart', <CartPage onOpenTableSelector={() => {}} />);
    expect(screen.getByText(/Order Summary Foundation/i)).toBeInTheDocument();
    expect(screen.getByText(/Dining Cart/i)).toBeInTheDocument();
    const takeawayMatches = screen.getAllByText(/Takeaway Cart/i);
    expect(takeawayMatches.length).toBeGreaterThan(0);
  });

  it('renders Internal Portal Login with Staff, Waiter and Kitchen roles', () => {
    renderWithProviders('/auth/portal-login', <PortalLogin />);
    expect(screen.getByText(/Internal Portals & Roles/i)).toBeInTheDocument();
    expect(screen.getByText(/Ananya Deshmukh/i)).toBeInTheDocument();
    expect(screen.getByText(/Chef Maria Santos/i)).toBeInTheDocument();
  });

  it('renders Staff Portal Foundation with table layout', () => {
    renderWithProviders('/staff', <StaffPortal />);
    expect(screen.getByText(/Floor & Waiter Service Station/i)).toBeInTheDocument();
    expect(screen.getByText(/Cafe Tables & QR Code Floor Map/i)).toBeInTheDocument();
  });

  it('renders Kitchen Display System (KDS) Portal Foundation', () => {
    renderWithProviders('/kitchen', <KitchenPortal />);
    expect(screen.getByText(/Live Cooking Queue/i)).toBeInTheDocument();
    expect(screen.getByText(/#HG-8041/i)).toBeInTheDocument();
  });
});
