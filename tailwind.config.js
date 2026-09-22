/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        united: {
          yellow: '#FFD700',
          yellowHover: '#FFDE33',
          blue: '#0057B7',
          ink: '#0A0A0B',
          panel: '#131316',
        },
      },
      fontFamily: {
        display: ['Oswald', 'Archivo Black', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'neon-yellow': '0 0 24px rgba(255, 215, 0, 0.35)',
        'neon-blue': '0 0 24px rgba(0, 87, 183, 0.45)',
        card: '0 12px 24px -8px rgba(0, 0, 0, 0.6)',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'float-up': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-100px)', opacity: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        ticker: 'ticker 30s linear infinite',
        'float-up': 'float-up 2.2s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
