import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        archivo: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        'archivo-narrow': ['var(--font-archivo-narrow)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Dress Collection palette — blush rose
        rose: {
          50:  '#ffe9f3',
          100: '#ffc5e0',
          200: '#fc8ec1',
          300: '#f04f9a',
          400: '#e63387',
          500: '#db5795', // PRIMARY
          600: '#8a1d50',
          700: '#600a32',
          800: '#36021a',
          900: '#200c15',
          950: '#14070d',
        },
        charcoal: {
          50:  '#f9f6f7',
          100: '#f1e9ec',
          200: '#dfc9d1',
          300: '#c2a1ae',
          400: '#a17787',
          500: '#83596a',
          600: '#5c3c48',
          700: '#402a33',
          800: '#291a20',
          900: '#180f13',
          950: '#0e0a0b',
        },
        coral: {
          400: '#ff6370',
          500: '#ff3d4d',
          600: '#e81a2b',
        },
        // Semantic shorthands
        page:    '#ffffff',
        surface: '#f9f6f7',
        card:    '#f5f1f3',
        well:    '#f9e8f0',
        border:  'rgba(0,0,0,0.10)',
        body:    '#150d11',
        sub:     '#705260',
        muted:   '#907481',
        primary: '#db5795',
        onPrimary: '#200612', // dark text on solid rose-500 CTAs — do not reuse rose.950 (#14070d), a different, already-used dark
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'rose-gradient': 'linear-gradient(150deg,#8a1d50,#36021a)',
      },
      boxShadow: {
        'rose-glow': '0 0 0 1px rgba(219,87,149,.5),0 10px 30px rgba(138,29,80,.28)',
        'rose-sm': '0 4px 18px rgba(138,29,80,.30)',
        'rose-lg': '0 6px 26px rgba(138,29,80,.32)',
      },
      animation: {
        'toast-in': 'toastIn .3s cubic-bezier(.16,1,.3,1)',
        'fade-up': 'fadeUp .35s ease both',
        shimmer: 'shimmer 1.4s linear infinite',
        glow: 'glow 3.2s ease-in-out infinite',
        pop: 'pop .4s cubic-bezier(.16,1,.3,1)',
        streak: 'streak 5s ease-in-out infinite',
        'slide-right': 'slideRight .28s cubic-bezier(.16,1,.3,1)',
        'fade-in': 'fadeIn .2s ease',
        'tick-pop': 'tickPop .25s cubic-bezier(.16,1,.3,1)',
      },
      keyframes: {
        toastIn: {
          '0%':   { opacity: '0', transform: 'translate(-50%,14px) scale(.96)' },
          '100%': { opacity: '1', transform: 'translate(-50%,0) scale(1)' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        glow: {
          '0%,100%': { boxShadow: '0 0 0 1px rgba(219,87,149,.35),0 0 22px rgba(219,87,149,.12)' },
          '50%':     { boxShadow: '0 0 0 1px rgba(219,87,149,.6),0 0 34px rgba(219,87,149,.28)' },
        },
        pop: {
          '0%':   { transform: 'scale(.8)', opacity: '0' },
          '60%':  { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        streak: {
          '0%':   { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideRight: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        tickPop: {
          '0%':   { transform: 'scale(1.3)' },
          '100%': { transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
