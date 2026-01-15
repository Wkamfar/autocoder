/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#8b5cf6',
        good: '#10b981',
        warn: '#f59e0b',
        bad: '#ef4444',
        purple: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c3aed',
          800: '#6d28d9',
          900: '#581c87',
        },
        dark: {
          900: '#000000',
          850: '#0a0a0a',
          800: '#111111',
          700: '#1a1a1a',
          600: '#262626',
        },
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        card: '0 8px 30px rgba(0,0,0,.3)',
        insetGlow: 'inset 0 0 0 2px rgba(139,92,246,.4)',
        purpleGlow: '0 0 20px rgba(139,92,246,.3), 0 0 40px rgba(139,92,246,.2)',
        buttonGlow: '0 0 15px rgba(139,92,246,.4), 0 0 30px rgba(139,92,246,.2)',
        watch: '0 16px 40px rgba(0,0,0,.8)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    }
  },
  plugins: [],
}
