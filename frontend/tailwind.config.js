/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:      { DEFAULT: '#080b12', 50: '#0e1220', 100: '#141929', 200: '#1c2236' },
        surface: { DEFAULT: '#1a1f30', 50: '#20273a', 100: '#252d42', 200: '#2d3650' },
        accent:  { DEFAULT: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
        danger:  { DEFAULT: '#f43f5e' },
        success: { DEFAULT: '#10b981' },
        warn:    { DEFAULT: '#f59e0b' },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow:      '0 0 24px rgba(99,102,241,.3)',
        'glow-sm': '0 0 12px rgba(99,102,241,.2)',
        glass:     '0 4px 32px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05)',
      },
      keyframes: {
        float:  { '0%,100%': { transform: 'translateY(0)' },  '50%': { transform: 'translateY(-6px)' } },
        glow:   { '0%,100%': { opacity: '.6' }, '50%': { opacity: '1' } },
      },
      animation: {
        float:  'float 3s ease-in-out infinite',
        glow:   'glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}

