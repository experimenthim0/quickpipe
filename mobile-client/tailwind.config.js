/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.js",
    "./screens/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        darkspace: '#090D16',
        frostglass: 'rgba(19, 27, 46, 0.4)',
        cardglass: 'rgba(25, 34, 56, 0.6)',
        cyanaccent: '#00F2FE',
        slatemuted: '#64748B'
      }
    },
  },
  plugins: [],
};
