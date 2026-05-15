/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        board: {
          bg: '#0f0f1a',
          surface: '#1a1a2e',
          border: 'rgba(255,255,255,0.08)',
          brown: '#8B4513',
          light_blue: '#87CEEB',
          pink: '#FF69B4',
          orange: '#FFA500',
          red: '#DC143C',
          yellow: '#FFD700',
          green: '#228B22',
          dark_blue: '#00008B',
          airport: '#666',
          utility: '#555',
        },
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-fast': 'pulse 0.5s infinite',
        'dice-roll': 'spin 0.3s ease-out',
      },
      fontFamily: {
        game: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
