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
        primary: {
          50: '#eeeeff',
          100: '#dcdcff',
          200: '#b5b6f6',
          300: '#8a8bf0',
          400: '#6566e5',
          500: '#5657dc',
          600: '#4C4DDC',
          700: '#3c3dbf',
          800: '#3031a3',
          900: '#252687',
          950: '#131461',
        },
        surface: {
          50: '#f8f8ff',
          100: '#f0f0ff',
          200: '#e4e4fa',
        }
      },
      fontFamily: {
        sans: ['var(--font-pretendard)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
        'typing': 'typing 1.2s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
          '40%': { transform: 'scale(1)', opacity: '1' },
        },
        typing: {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(76,77,220,0.15)' },
          '50%': { boxShadow: '0 0 20px rgba(76,77,220,0.3)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0,0,0,0.06)',
        'glass-lg': '0 8px 40px rgba(0,0,0,0.08)',
        'float': '0 8px 30px rgba(76,77,220,0.12)',
        'glow': '0 0 20px rgba(76,77,220,0.15)',
        'card': '0 2px 12px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.08), 0 0 1px rgba(0,0,0,0.06)',
      }
    },
  },
  plugins: [],
}
