"use client";
import { useState } from "react";
import { Listing } from "@/lib/types";
/** Muestra la foto i del anuncio; si no existe o falla la carga, dibuja un respaldo SVG. */
/** w = ancho en px de la miniatura que pide al proxy /api/img (las fotos originales pesan MB). */
export default function WatchImage({ l, i = 0, w = 640, fit = "cover", className = "" }: { l: Listing; i?: number; w?: number; fit?: "cover" | "contain"; className?: string }) {
  const [bad, setBad] = useState(false);
  const src = l.images[i];
  if (src && !bad) return <img src={/^https?:/.test(src) ? `/api/img?w=${w}&v=2&u=${encodeURIComponent(src)}` : src} alt={l.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"} ${className}`} />;
  const light = ["#d8d2c0","#c9c3b3","#e4e6e8","#e8e4d8","#cfcab8","#c7a63a"].includes(l.dial);
  const ink = light ? "#1B1B1A" : "#EDEDEA";
  return (
    <svg viewBox="0 0 200 250" className="h-full w-full" role="img" aria-label={l.title} preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="250" fill="#ECECE8" />
      <rect x="82" y="8" width="36" height="234" fill="#C9C9C3" />
      <circle cx="100" cy="125" r="62" fill="#B9B9B2" />
      <circle cx="100" cy="125" r="55" fill={l.dial} />
      {Array.from({ length: 12 }, (_, k) => <rect key={k} x="98.5" y="74" width="3" height={k % 3 ? 6 : 10} fill={ink} transform={`rotate(${k * 30} 100 125)`} />)}
      <line x1="100" y1="125" x2="100" y2="92" stroke={ink} strokeWidth="2.5" />
      <line x1="100" y1="125" x2="122" y2="135" stroke={ink} strokeWidth="2" />
    </svg>
  );
}
