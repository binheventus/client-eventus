/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Be Vietnam Pro', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          900: '#431407',
        },
        ink: {
          DEFAULT: '#0f0e0d',
          soft: '#3d3a36',
          muted: '#78746e',
          faint: '#c8c4be',
        },
        surface: {
          DEFAULT: '#faf9f7',
          card: '#ffffff',
          warm: '#f5f2ee',
        }
      }
    },
  },
  plugins: [],
}
