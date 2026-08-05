/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0a0f',
          card: '#12121e',
          border: '#1f1f2e',
          neonCyan: '#00f0ff',
          neonMagenta: '#ff007f',
          neonYellow: '#ffea00',
          neonGreen: '#39ff14',
          accent: '#7b2cbf',
          text: '#e2e2e9',
          muted: '#8e8e9f'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'monospace']
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(0, 240, 255, 0.4), 0 0 20px rgba(0, 240, 255, 0.2)',
        'neon-magenta': '0 0 10px rgba(255, 0, 127, 0.4), 0 0 20px rgba(255, 0, 127, 0.2)',
        'neon-yellow': '0 0 10px rgba(255, 234, 0, 0.4), 0 0 20px rgba(255, 234, 0, 0.2)',
        'neon-green': '0 0 10px rgba(57, 255, 20, 0.4), 0 0 20px rgba(57, 255, 20, 0.2)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-cyan': 'glowCyan 2s infinite alternate',
        'glow-magenta': 'glowMagenta 2s infinite alternate',
        'border-flow': 'borderFlow 4s linear infinite',
      },
      keyframes: {
        glowCyan: {
          '0%': { boxShadow: '0 0 5px rgba(0, 240, 255, 0.3)' },
          '100%': { boxShadow: '0 0 15px rgba(0, 240, 255, 0.6)' }
        },
        glowMagenta: {
          '0%': { boxShadow: '0 0 5px rgba(255, 0, 127, 0.3)' },
          '100%': { boxShadow: '0 0 15px rgba(255, 0, 127, 0.6)' }
        }
      }
    },
  },
  plugins: [],
}
