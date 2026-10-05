"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const d = !dark; setDark(d); document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("wm-theme", d ? "dark" : "light"); } catch {}
  };
  return (
    <button onClick={toggle} aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"} className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-mute transition hover:border-ink hover:text-ink">
      {dark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
    </button>
  );
}
