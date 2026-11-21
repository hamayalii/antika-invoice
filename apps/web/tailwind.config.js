/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#FF5A00",
          "orange-dark": "#E04E00",
          "orange-light": "#FF7A33",
          "orange-soft": "#FFF0E6",
          beige: "#F8DDB8",
          ink: "#111111",
          line: "#9A9A9A",
        },
        surface: "#F3F5F9",
      },
      fontFamily: {
        sans: ["Arkan", "Inter", "Tahoma", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px rgba(224, 78, 0, 0.08)",
        pop: "0 16px 50px rgba(17, 17, 17, 0.18)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
