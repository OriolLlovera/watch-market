import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { paper: "#FFFFFF", wash: "#F3F3F1", line: "#E3E3DF", ink: "#1B1B1A", mute: "#6F6F6A", accent: "#2B4A6F" },
    fontFamily: { serif: ["var(--font-serif)", "Georgia", "serif"], sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
  } },
  plugins: [],
} satisfies Config;
