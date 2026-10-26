/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spotify: '#1DB954',
        ytmusic: '#FF0033',
        lossless: '#F59E0B',
      }
    },
  },
  plugins: [],
}
