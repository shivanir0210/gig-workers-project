/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: '#0B1220',
        card: '#111827',
        border: '#1F2937',
        neonGreen: '#22C55E',
        neonBlue: '#3B82F6',
        neonPurple: '#8B5CF6',
      },
      boxShadow: {
        neon: '0 0 20px rgba(34,197,94,0.35)',
        neonBlue: '0 0 20px rgba(59,130,246,0.35)',
        neonPurple: '0 0 20px rgba(139,92,246,0.35)',
        card: '0 4px 24px rgba(0,0,0,0.4)',
      },
      backgroundImage: {
        'neon-gradient': 'linear-gradient(135deg, #22C55E, #3B82F6, #8B5CF6)',
        'neon-gradient-h': 'linear-gradient(90deg, #22C55E, #3B82F6, #8B5CF6)',
      }
    }
  },
  plugins: []
}
