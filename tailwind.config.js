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
        primary: '#2563EB', // Blue
        secondary: '#64748B', // Slate
        background: '#F1F5F9', // Light Gray
        surface: '#FFFFFF', // White
      }
    },
  },
  plugins: [],
}
