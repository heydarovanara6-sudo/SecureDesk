/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bp-green': '#009900',
        'bp-yellow': '#FFDD00',
        'bp-dark': '#1a1a1a',
        'bp-gray': '#2d2d2d',
      }
    },
  },
  plugins: [],
}