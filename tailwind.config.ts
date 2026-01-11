import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        teal: {
          light: '#00BCD4',
          DEFAULT: '#0097A7',
          dark: '#00838F',
        },
        games: {
          DEFAULT: '#4CAF50',
          light: '#81C784',
        },
        hot: {
          DEFAULT: '#FF5722',
          light: '#FF8A65',
        },
        favs: {
          DEFAULT: '#C41E3A',
          light: '#DC143C',
        },
        wins: {
          DEFAULT: '#8B00FF',
          light: '#9D4EDD',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        header: '0 2px 8px rgba(0, 0, 0, 0.15)',
        'nav-circle': '0 4px 12px rgba(0, 0, 0, 0.2)',
        'nav-circle-active': '0 6px 16px rgba(0, 0, 0, 0.3)',
        'game-card': '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'bounce-grow': 'bounceGrow 0.5s ease-out',
      },
      keyframes: {
        bounceGrow: {
          '0%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-10px) scale(1.15)' },
          '100%': { transform: 'translateY(-5px) scale(1.1)' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
