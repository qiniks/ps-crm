import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0070d1", // PlayStation blue
          dark: "#003791",
        },
      },
    },
  },
  plugins: [],
};

export default config;
