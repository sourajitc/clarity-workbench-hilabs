/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#1F3A5F', 50: '#F2F6FB', 100: '#E3ECF6', 200: '#C5D6EA', 300: '#9AB6D6', 600: '#2C5282', 700: '#1F3A5F', 800: '#172C48', 900: '#0F1E33' },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', '-apple-system', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      fontSize: { meta: ['12px', '16px'], body: ['14px', '20px'] },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
        fadeUp: { '0%': { opacity: 0, transform: 'translateY(4px)' }, '100%': { opacity: 1, transform: 'none' } },
        flash: { '0%': { backgroundColor: 'rgb(219 234 254)' }, '100%': { backgroundColor: 'transparent' } },
        slideIn: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'none' } },
        pulseRing: { '0%,100%': { boxShadow: '0 0 0 0 rgba(37,99,235,.45)' }, '50%': { boxShadow: '0 0 0 10px rgba(37,99,235,0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.2s linear infinite',
        fadeUp: 'fadeUp .35s ease-out both',
        flash: 'flash 1.6s ease-out',
        slideIn: 'slideIn .25s ease-out',
        pulseRing: 'pulseRing 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
