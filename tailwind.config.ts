import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bcd6ff",
          300: "#8ebaff",
          400: "#5993ff",
          500: "#336fff",
          600: "#1d4ed8",
          700: "#1e40af",
          800: "#1e3a8a",
          900: "#172554",
          950: "#0b1535",
        },
        ink: {
          50: "#f6f8fb",
          100: "#eaeef5",
          200: "#d4dbe7",
          300: "#aab4c6",
          400: "#7b88a1",
          500: "#566279",
          600: "#3e485c",
          700: "#2b3345",
          800: "#1a1f2d",
          900: "#0c101a",
        },
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
        premium:
          "0 10px 30px -12px rgba(17,24,39,.15), 0 4px 10px -4px rgba(17,24,39,.08)",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      keyframes: {
        pulseDot: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(29,78,216,.55)" },
          "50%": { boxShadow: "0 0 0 10px rgba(29,78,216,0)" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.6s ease-out infinite",
        fadeIn: "fadeIn .25s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
