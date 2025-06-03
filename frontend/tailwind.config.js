/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#E6ECE6',
        navBackground: '#0A2C0A',
      },
    },
  },
  plugins: [],
}