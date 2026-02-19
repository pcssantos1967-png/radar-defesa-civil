import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Command Center Theme
        background: {
          DEFAULT: '#0B1120',
          secondary: '#111B2E',
          tertiary: '#1A2744',
          elevated: '#1E3050',
        },
        border: {
          DEFAULT: '#1E3050',
          hover: '#2A4060',
          active: '#00E5FF',
        },
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#94A3B8',
          muted: '#64748B',
        },
        accent: {
          DEFAULT: '#00E5FF',
          secondary: '#0EA5E9',
          success: '#4CAF50',
          warning: '#FFA726',
          error: '#FF4444',
        },
        severity: {
          observation: '#4CAF50',
          attention: '#FFD600',
          alert: '#FF9800',
          'max-alert': '#FF1744',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radar-sweep 4s linear infinite',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
      },
      keyframes: {
        'radar-sweep': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 229, 255, 0.3)',
        'glow-strong': '0 0 30px rgba(0, 229, 255, 0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
