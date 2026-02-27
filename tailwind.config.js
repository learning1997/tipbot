/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bitcoin: {
          orange: "#F7931A",
          black: "#0b0e11",
          gray: "#1e2329",
          hover: "#e88300",
        },
      },
    },
  },
  plugins: [],
}