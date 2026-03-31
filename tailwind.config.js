/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        teddy: {
          light: '#C4A484',
          base: '#A67B5B',
          dark: '#8B5E3C',
          cream: '#FFF5E1',
          blush: '#F6D1D1',
        },
      },
      boxShadow: {
        teddy: '0 12px 30px rgba(139, 94, 60, 0.22)',
      },
      borderRadius: {
        teddy: '20px',
      },
    },
  },
  plugins: [],
}

