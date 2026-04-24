/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#0B0D17',
          900: '#111320',
          800: '#1A1D2E',
          700: '#252A3D',
        },
        primary: '#6366F1',
        accent: {
          emerald: '#10B981',
          amber: '#F59E0B',
          rose: '#F43F5E',
          cyan: '#22D3EE',
        }
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.25)',
        'card-hover': '0 2px 6px rgba(0,0,0,0.3), 0 12px 32px rgba(0,0,0,0.3)',
        'glow': '0 0 20px rgba(99, 102, 241, 0.15)',
      }
    },
  },
  plugins: [],
}

