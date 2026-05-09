/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'bp-green':  '#00A650',
        'bp-yellow': '#FFDD00',
        'bp-dark':   '#0D0D0F',
        'bp-gray':   '#1C1C21',
        's0': '#0D0D0F',
        's1': '#141417',
        's2': '#1C1C21',
        's3': '#252529',
        's4': '#2E2E34',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
      boxShadow: {
        'glow-green': '0 0 20px rgba(0,166,80,0.15)',
        'panel': '0 32px 64px rgba(0,0,0,0.5)',
      },
      animation: {
        'fade-up': 'fadeUp 0.2s ease forwards',
        'pulse-glow': 'pulseGlow 2s ease infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(0,166,80,0.2)' },
          '50%':      { boxShadow: '0 0 0 6px transparent' },
        },
      },
    },
  },
  plugins: [],
};