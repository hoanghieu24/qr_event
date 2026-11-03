/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Brand: indigo-violet, đủ dải 50 → 950 (trước đây thiếu 200/300/400/950)
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        ink: {
          DEFAULT: '#0f172a',
          soft: '#334155',
          muted: '#64748b',
        },
      },
      boxShadow: {
        '2xs': '0 1px 1px 0 rgb(15 23 42 / 0.04)',
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
        card: '0 1px 2px rgb(15 23 42 / 0.04), 0 4px 16px -4px rgb(15 23 42 / 0.08)',
        lift: '0 2px 4px rgb(15 23 42 / 0.04), 0 12px 32px -8px rgb(15 23 42 / 0.16)',
        glow: '0 8px 24px -6px rgb(79 70 229 / 0.45)',
        'glow-emerald': '0 8px 24px -6px rgb(5 150 105 / 0.45)',
        nav: '0 -4px 24px -8px rgb(15 23 42 / 0.12)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'page-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'page-in': 'page-in 0.25s ease-out',
        'fade-up': 'fade-up 0.35s ease-out backwards',
        'scale-in': 'scale-in 0.25s ease-out backwards',
      },
    },
  },
  plugins: [],
};
