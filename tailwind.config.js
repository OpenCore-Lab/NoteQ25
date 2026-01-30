/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./renderer/index.html",
    "./renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins','sans-serif'],
        serif: ['Merriweather', 'serif'], // Keep serif for editor
      },
      colors: {
        primary: 'rgb(var(--color-primary) / <alpha-value>)', // Dynamic Primary Color
        secondary: '#525252', // Neutral 600
        background: '#F5F5F5', // Neutral 100
        surface: '#FFFFFF', // White
        slate: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      }
    },
  },
  plugins: [],
}
