/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      zIndex: {
        '100': '100',
        '200': '200',
        '999': '999',
        'max': '2147483647' 
      },
      colors: {
        background: '#E6ECE6',
        navBackground: '#0A2C0A',
      },
      keyframes: {
        popup: {
          '0%': { transform: 'scale(0.7)', opacity: '0' },
          '40%': { transform: 'scale(1.1)', opacity: '1' },
          '70%': { transform: 'scale(0.95)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        popup: 'popup 0.45s ease-out',
      },
    },
  },
  plugins: [],
}