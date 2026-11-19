import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Clock,
  Phone,
  Mail,
  ShoppingBag,
  Sparkles,
  Shield,
  Coffee,
} from 'lucide-react';
import { EXACT_TAKEAWAY_NOTICE } from '../../context/OrderModeContext';

const CURRENT_YEAR = new Date().getFullYear();

export const Footer: React.FC = () => {
  return (
    <footer className="bg-brand-black text-white pt-16 pb-24 sm:pb-12 border-t border-brand-charcoal">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 pb-12 border-b border-brand-charcoal">
          {/* Brand Col */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-brand-yellow flex items-center justify-center font-heading font-black text-2xl text-brand-black">
                H
              </div>
              <span className="font-heading font-black text-2xl tracking-tight text-white">
                HANGOUT
              </span>
            </div>
            <p className="text-xs text-brand-muted leading-relaxed font-sans">
              Specialty Coffee, slow-fermented sourdough, handcrafted smash burgers & modern cafe culture. Designed for real food lovers.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-8 h-8 rounded-xl bg-brand-charcoal hover:bg-brand-yellow hover:text-brand-black text-brand-muted flex items-center justify-center transition-all"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
              </a>
              <div className="flex items-center gap-1.5 text-xs text-brand-yellow font-heading font-semibold bg-brand-charcoal px-3 py-1.5 rounded-xl border border-brand-charcoal">
                <Coffee className="w-3.5 h-3.5" />
                <span>Single Origin Daily</span>
              </div>
            </div>
          </div>

          {/* Opening Hours */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-sm text-brand-yellow uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Opening Hours</span>
            </h4>
            <div className="space-y-2.5 text-xs text-gray-300">
              <div>
                <p className="font-semibold text-white">Monday — Friday</p>
                <p className="text-brand-muted">08:00 AM — 11:00 PM</p>
              </div>
              <div>
                <p className="font-semibold text-white">Saturday — Sunday</p>
                <p className="text-brand-muted">08:00 AM — 12:00 Midnight</p>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Kitchen Open Now
                </span>
              </div>
            </div>
          </div>

          {/* Location & Contact */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-sm text-brand-yellow uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span>Visit HANGOUT</span>
            </h4>
            <div className="space-y-2 text-xs text-gray-300 leading-relaxed">
              <p>Plot 42, 100 Feet Road, Indiranagar</p>
              <p>Bengaluru, Karnataka 560038</p>
              <div className="pt-2 space-y-1 text-brand-muted">
                <p className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-brand-yellow" />
                  <a href="tel:+919876543210" className="hover:text-white">
                    +91 98765 43210
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-brand-yellow" />
                  <a href="mailto:hello@hangoutcafe.com" className="hover:text-white">
                    hello@hangoutcafe.com
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Self-Pickup & Delivery Clarification */}
          <div className="space-y-4">
            <h4 className="font-heading font-bold text-sm text-brand-yellow uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>Order Policy</span>
            </h4>
            <div className="p-3.5 rounded-2xl bg-brand-charcoal border border-brand-charcoal text-xs text-gray-300 space-y-2">
              <div className="flex items-center gap-1.5 text-brand-yellow font-bold text-[11px] uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pickup Only Cafe</span>
              </div>
              <p className="text-[11px] leading-relaxed text-gray-400 font-sans">
                {EXACT_TAKEAWAY_NOTICE}
              </p>
            </div>
            <div className="pt-1">
              <Link
                to="/auth/portal-login"
                className="inline-flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand-yellow font-heading font-semibold transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Staff & Management Portal</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Credits */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-brand-muted">
          <p>© {CURRENT_YEAR} HANGOUT Digital Platform. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>GST Number: 29AAAAA0000A1Z5</span>
            <span>•</span>
            <span>Batch 02: Ordering Engine & Admin Portal</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
