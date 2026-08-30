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
        // Editorial-serif garnish — italic accent moments only (see app/layout.tsx).
        fraunces: ['var(--font-fraunces)', 'Georgia', 'serif'],
        // Headline/logo serif — tall, thin, high-contrast (see app/layout.tsx).
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      colors: {
        // Dress Collection palette — warm neutral / muted tan (Saraia-aligned).
        // Key stays "rose" so every existing rose-50..950 utility class keeps
        // working — only the hex values changed, not the token names.
        rose: {
          50:  '#faf4ec',
          100: '#f2e2cd',
          200: '#e3c39a',
          300: '#cfa06c',
          400: '#b8874f',
          500: '#a3713e', // PRIMARY — muted terracotta/tan
          600: '#7c5730',
          700: '#5c4025',
          800: '#3c2a18',
          900: '#24180e',
          950: '#160e08',
        },
        charcoal: {
          50:  '#f8f6f3',
          100: '#eee8e0',
          200: '#dbcfc0',
          300: '#c0af99',
          400: '#a08d76',
          500: '#7f6c57',
          600: '#5f5041',
          700: '#443a2f',
          800: '#2c251d',
          900: '#19140f',
          950: '#0f0c09',
        },
        coral: {
          400: '#ff6370',
          500: '#ff3d4d',
          600: '#e81a2b',
        },
        // Semantic shorthands
        page:    '#fdfbf6', // warm cream, not stark white — boutique warmth
        surface: '#f8f3ea',
        card:    '#f5efe1',
        well:    '#f6f1e5',
        border:  'rgba(43,28,18,0.10)',
        body:    '#241a10',
        sub:     '#5c4c3c',
        muted:   '#8a7a65',
        primary: '#a3713e',
        onPrimary: '#241608', // dark text on solid rose-500 CTAs — do not reuse rose.950 (#160e08), a different, already-used dark
      },
      borderRadius: {
        '4xl': '2rem',
      },
      backgroundImage: {
        'rose-gradient': 'linear-gradient(150deg,#7c5730,#3c2a18)',
      },
      boxShadow: {
        'rose-glow': '0 0 0 1px rgba(163,113,62,.5),0 10px 30px rgba(124,87,48,.28)',
        'rose-sm': '0 4px 18px rgba(124,87,48,.30)',
        'rose-lg': '0 6px 26px rgba(124,87,48,.32)',
        // Borderless editorial card language — no resting shadow, a soft
        // ambient lift on hover instead of the old hard-border boxes.
        'card-hover': '0 18px 40px rgba(36,26,16,.10)',
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
          '0%,100%': { boxShadow: '0 0 0 1px rgba(163,113,62,.35),0 0 22px rgba(163,113,62,.12)' },
          '50%':     { boxShadow: '0 0 0 1px rgba(163,113,62,.6),0 0 34px rgba(163,113,62,.28)' },
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
