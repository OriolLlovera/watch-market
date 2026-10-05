import type { Config } from "tailwindcss";
// Colores como variables CSS (RGB): permiten modo oscuro y modificadores de opacidad (bg-ink/40).
const v = (n: string) => `rgb(var(--c-${n}) / <alpha-value>)`;
export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { paper: v("paper"), wash: v("wash"), line: v("line"), ink: v("ink"), mute: v("mute"), accent: v("accent") },
    fontFamily: { serif: ["var(--font-serif)", "Georgia", "serif"], sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
  } },
  plugins: [],
} satisfies Config;
