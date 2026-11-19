/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#FFD600',       // Primary Yellow
          'soft-yellow': '#FFF3A6', // Soft Yellow
          black: '#111111',        // Primary Black
          charcoal: '#202020',     // Charcoal
          'charcoal-light': '#2a2a2a',
          'warm-white': '#FAFAF6', // Warm White
          cream: '#F4F4EE',
          muted: '#8E8E93',
          border: '#E8E8E0',
          'border-dark': '#2E2E2E'
        }
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-yellow': '0 0 25px -5px rgba(255, 214, 0, 0.35)',
        'card-subtle': '0 4px 20px -2px rgba(17, 17, 17, 0.05)',
        'premium': '0 12px 35px -8px rgba(0, 0, 0, 0.12)',
        'dark-float': '0 20px 40px -15px rgba(0, 0, 0, 0.7)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
