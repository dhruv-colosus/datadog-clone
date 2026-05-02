import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-noto-sans)", "sans-serif"],
      },
      colors: {
        sidebar: {
          bg: "#292E39",
          muted: "#B4B7B5",
        },
      },
    },
  },
  plugins: [],
};

export default config;
