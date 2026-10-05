"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { Listing } from "@/lib/types";
import { ago, money, toUsd } from "@/lib/search";
import WatchImage from "./WatchImage";

export default function ListingModal({ l, onClose }: { l: Listing; onClose: () => void }) {
  const [n, setN] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = Math.max(1, l.images.length);
  const go = (d: number) => setN((x) => (x + d + count) % count);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); else if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); };
    addEventListener("keydown", k);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; // sin scroll de fondo
    closeRef.current?.focus();
    return () => { removeEventListener("keydown", k); document.body.style.overflow = prev; };
  }, [onClose, count]);
  const base: [string, string][] = [["Modelo", l.model], ["Referencia", l.reference], ["Condición", l.condition], ["Tamaño de caja", l.caseSize ? `${l.caseSize} mm` : "—"], ["Estilo", l.style], ["País", l.country], ["Vendedor", l.seller], ["Publicado", ago(l.postedAt)]];
  // Datos deducidos del texto del anuncio: solo se muestran si el anuncio los dice.
  const extra = ([["Movimiento", l.movement], ["Material de la caja", l.material], ["Año", l.year ? String(l.year) : undefined], ["Esfera", l.dialName], ["Resistencia al agua", l.waterResistance], ["Contenido", l.contents], ["Envío", l.freeShipping ? "Incluido" : undefined], ["Negociable", l.negotiable ? "Sí" : undefined]] as [string, string | undefined][]).filter((x): x is [string, string] => !!x[1]);
  const specs = [...base, ...extra];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 backdrop-blur-sm md:p-8" onClick={onClose}>
      <div className="mx-auto flex min-h-full items-center justify-center">
        <div role="dialog" aria-modal="true" aria-label={l.title} onClick={(e) => e.stopPropagation()} className="w-full max-w-5xl overflow-hidden bg-paper shadow-2xl md:grid md:grid-cols-[1.15fr_1fr] md:rounded-xl">
          <div className="bg-wash">
            <div className="relative aspect-[4/5] md:aspect-auto md:h-[min(78vh,760px)]">
              <WatchImage l={l} i={n} w={1400} fit="contain" />
              <button onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-paper/90 shadow md:hidden"><X size={20} strokeWidth={1.5} /></button>
              {count > 1 && <>
                <button onClick={() => go(-1)} aria-label="Foto anterior" className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 shadow hover:bg-paper"><ChevronLeft size={20} strokeWidth={1.5} /></button>
                <button onClick={() => go(1)} aria-label="Foto siguiente" className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-paper/90 shadow hover:bg-paper"><ChevronRight size={20} strokeWidth={1.5} /></button>
                <span className="num absolute bottom-3 left-3 rounded-md bg-ink/70 px-2 py-0.5 text-xs text-paper">{n + 1} / {count}</span>
              </>}
            </div>
            {count > 1 && <div className="flex gap-2 overflow-x-auto p-3">{l.images.map((_, k) => (
              <button key={k} onClick={() => setN(k)} aria-label={`Foto ${k + 1}`} aria-current={k === n} className={`h-14 w-14 shrink-0 overflow-hidden rounded border transition ${k === n ? "border-ink" : "border-line opacity-60 hover:opacity-100"}`}><WatchImage l={l} i={k} w={160} /></button>))}</div>}
          </div>
          <div className="p-6 md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-xs"><span className="rounded-md bg-wash px-2 py-0.5 font-medium">{l.source}</span><span className="font-medium uppercase tracking-wider text-mute">{l.brand}</span></div>
              <button ref={closeRef} onClick={onClose} aria-label="Cerrar" className="-m-2 hidden rounded-md p-2 text-mute hover:text-ink md:block"><X size={20} strokeWidth={1.5} /></button>
            </div>
            <h2 className="mt-3 font-serif text-3xl leading-tight">{l.title}</h2>
            <p className="num mt-4 flex items-baseline gap-3 text-3xl font-semibold">{money(l)}{l.currency !== "USD" && <span className="text-base font-normal text-mute">≈ ${Math.round(toUsd(l)).toLocaleString("es-ES")}</span>}</p>
            <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-5 text-sm">
              {specs.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[11px] font-medium uppercase tracking-wider text-mute">{k}</dt><dd suppressHydrationWarning className="mt-0.5 truncate">{v}</dd></div>)}
            </dl>
            {extra.length > 0 && <p className="mt-3 text-[11px] leading-relaxed text-mute">Movimiento, material, año, esfera y contenido se deducen del texto del anuncio y pueden ser inexactos: compruébalo con el vendedor.</p>}
            {l.description && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-ink/90">{l.description}</p>}
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="mt-8 flex w-full items-center justify-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper transition hover:bg-accent">
              Ver anuncio en {l.source} <ExternalLink size={15} strokeWidth={1.75} />
            </a>
            <p className="mt-3 text-xs leading-relaxed text-mute">Se abre el anuncio original. Watch Market no vende ni gestiona pagos: las condiciones y la compra son entre tú y el vendedor.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
