/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0edff',
          100: '#ddd6fe',
          200: '#c4b5fd',
          300: '#a78bfa',
          400: '#8b5cf6',
          500: '#6C5CE7',
          600: '#5b4cdb',
          700: '#4c3dc7',
          800: '#3d2fa3',
          900: '#2e2280',
        }
      }
    },
  },
  plugins: [],
}
