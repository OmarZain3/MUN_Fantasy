/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pitch: {
          950: "#052e16",
          900: "#064e3b",
          800: "#065f46",
        },
        "primary-blue": "#083F5E",
        "primary-gold": "#EECC4E",
        "accent-sky": "#7dd3fc",
      },
    },
  },
  plugins: [],
};
