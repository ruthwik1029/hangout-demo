import React, { createContext, useContext, useState, useCallback } from 'react';
import { Customer, CustomerSession } from '../types';
import { registerOrFindCustomer, createCustomerSession } from '../lib/supabase';
import { useOrderMode } from './OrderModeContext';
import { useToast } from './ToastContext';

interface CustomerContextType {
  currentCustomer: Customer | null;
  currentSession: CustomerSession | null;
  isAuthenticated: boolean;
  isRegisterModalOpen: boolean;
  openRegisterModal: () => void;
  closeRegisterModal: () => void;
  registerCustomer: (fullName: string, mobileNumber: string, email?: string) => Promise<boolean>;
  registerGuest: (fullName: string, mobileNumber: string, email?: string) => Promise<Customer | null>;
  setCustomer: (customer: Customer | null) => void;
  logoutCustomer: () => void;
  validateMobile: (mobile: string) => { isValid: boolean; error?: string };
}

const STORAGE_ACTIVE_CUSTOMER = 'hangout_active_customer';
const STORAGE_ACTIVE_SESSION = 'hangout_active_session';

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export const CustomerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode, currentTable } = useOrderMode();
  const { showToast } = useToast();

  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(() => {
    try {
      const savedSession = localStorage.getItem(STORAGE_ACTIVE_SESSION);
      if (!savedSession) return null;
      const parsedSession: CustomerSession = JSON.parse(savedSession);
      if (new Date(parsedSession.expires_at) < new Date()) {
        localStorage.removeItem(STORAGE_ACTIVE_SESSION);
        localStorage.removeItem(STORAGE_ACTIVE_CUSTOMER);
        return null;
      }
      const savedCustomer = localStorage.getItem(STORAGE_ACTIVE_CUSTOMER);
      return savedCustomer ? JSON.parse(savedCustomer) : null;
    } catch {
      return null;
    }
  });

  const [currentSession, setCurrentSession] = useState<CustomerSession | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_SESSION);
      if (!saved) return null;
      const parsed: CustomerSession = JSON.parse(saved);
      if (new Date(parsed.expires_at) < new Date()) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  const validateMobile = (mobile: string): { isValid: boolean; error?: string } => {
    const digitsOnly = mobile.replace(/\D/g, '');
    if (!digitsOnly) {
      return { isValid: false, error: 'Mobile number is required' };
    }
    // Indian standard 10-digit mobile check (starts with 6, 7, 8, or 9)
    if (digitsOnly.length === 10) {
      if (/^[6-9]\d{9}$/.test(digitsOnly)) {
        return { isValid: true };
      }
      return { isValid: false, error: 'Mobile number should start with 6, 7, 8, or 9' };
    }
    if (digitsOnly.length < 10) {
      return { isValid: false, error: `Enter a valid 10-digit mobile number (${digitsOnly.length}/10 digits)` };
    }
    return { isValid: false, error: 'Mobile number exceeds 10 digits' };
  };

  const registerCustomer = useCallback(
    async (fullName: string, mobileNumber: string, email?: string): Promise<boolean> => {
      const validation = validateMobile(mobileNumber);
      if (!validation.isValid) {
        showToast({
          type: 'error',
          title: 'Invalid Mobile Number',
          message: validation.error,
        });
        return false;
      }

      if (!fullName.trim() || fullName.trim().length < 2) {
        showToast({
          type: 'error',
          title: 'Name Required',
          message: 'Please enter your full name (at least 2 characters).',
        });
        return false;
      }

      try {
        const customer = await registerOrFindCustomer(fullName, mobileNumber, email);
        const session = await createCustomerSession(customer, mode, currentTable);

        setCurrentCustomer(customer);
        setCurrentSession(session);

        localStorage.setItem(STORAGE_ACTIVE_CUSTOMER, JSON.stringify(customer));
        localStorage.setItem(STORAGE_ACTIVE_SESSION, JSON.stringify(session));

        showToast({
          type: 'success',
          title: `Welcome, ${customer.full_name}!`,
          message: 'Your customer profile is active for this session.',
        });

        setIsRegisterModalOpen(false);
        return true;
      } catch (e) {
        console.error('Registration failed:', e);
        showToast({
          type: 'error',
          title: 'Registration Error',
          message: 'Could not complete registration. Please try again.',
        });
        return false;
      }
    },
    [mode, currentTable, showToast]
  );

  const registerGuest = useCallback(
    async (fullName: string, mobileNumber: string, email?: string): Promise<Customer | null> => {
      try {
        const customer = await registerOrFindCustomer(fullName, mobileNumber, email);
        const session = await createCustomerSession(customer, mode, currentTable);

        setCurrentCustomer(customer);
        setCurrentSession(session);

        localStorage.setItem(STORAGE_ACTIVE_CUSTOMER, JSON.stringify(customer));
        localStorage.setItem(STORAGE_ACTIVE_SESSION, JSON.stringify(session));

        return customer;
      } catch (e) {
        console.error('Guest registration failed:', e);
        return null;
      }
    },
    [mode, currentTable]
  );

  const setCustomer = useCallback((customer: Customer | null) => {
    setCurrentCustomer(customer);
    if (customer) {
      localStorage.setItem(STORAGE_ACTIVE_CUSTOMER, JSON.stringify(customer));
    } else {
      localStorage.removeItem(STORAGE_ACTIVE_CUSTOMER);
    }
  }, []);

  const logoutCustomer = useCallback(() => {
    setCurrentCustomer(null);
    setCurrentSession(null);
    localStorage.removeItem(STORAGE_ACTIVE_CUSTOMER);
    localStorage.removeItem(STORAGE_ACTIVE_SESSION);
    showToast({
      type: 'info',
      title: 'Signed Out',
      message: 'Your customer session has ended.',
    });
  }, [showToast]);

  return (
    <CustomerContext.Provider
      value={{
        currentCustomer,
        currentSession,
        isAuthenticated: Boolean(currentCustomer && currentSession),
        isRegisterModalOpen,
        openRegisterModal: () => setIsRegisterModalOpen(true),
        closeRegisterModal: () => setIsRegisterModalOpen(false),
        registerCustomer,
        registerGuest,
        setCustomer,
        logoutCustomer,
        validateMobile,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
};

export const useCustomer = (): CustomerContextType => {
  const context = useContext(CustomerContext);
  if (!context) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
};
