"use client";
import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Listing } from "@/lib/types";
import { ago, money } from "@/lib/search";
import WatchImage from "./WatchImage";
export default function ListingModal({ l, onClose }: { l: Listing; onClose: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  const rows: [string, string][] = [["Marca", l.brand], ["Modelo", l.model], ["Referencia", l.reference], ["Tamaño de caja", l.caseSize ? `${l.caseSize} mm` : "—"], ["Estilo", l.style], ["Condición", l.condition], ["Vendedor", l.seller], ["Fuente", l.source], ["País", l.country], ["Publicado", ago(l.postedAt)]];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={l.title} onClick={(e) => e.stopPropagation()} className="h-full w-full max-w-4xl overflow-y-auto bg-paper md:grid md:grid-cols-2">
        <div className="bg-wash md:sticky md:top-0 md:h-screen">
          <div className="aspect-[4/5] md:aspect-auto md:h-[calc(100%-5rem)]"><WatchImage l={l} i={n} w={1400} /></div>
          {l.images.length > 1 && <div className="flex gap-2 p-3">{l.images.map((_, k) => (
            <button key={k} onClick={() => setN(k)} aria-label={`Foto ${k + 1}`} className={`h-14 w-14 overflow-hidden border ${k === n ? "border-ink" : "border-line"}`}><WatchImage l={l} i={k} w={160} /></button>))}</div>}
        </div>
        <div className="p-6 md:p-10">
          <button onClick={onClose} aria-label="Cerrar" className="float-right -m-2 p-2 text-mute hover:text-ink"><X size={18} strokeWidth={1.5} /></button>
          <p className="text-sm text-mute">{l.brand}</p>
          <h2 className="mt-1 font-serif text-3xl leading-tight">{l.title}</h2>
          <p className="num mt-4 text-2xl">{money(l)}</p>
          <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
            {rows.map(([k, v]) => <div key={k} className="flex justify-between py-2.5"><dt className="text-mute">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          <p className="mt-6 max-w-prose text-sm leading-relaxed">{l.description}</p>
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 border border-ink px-5 py-3 text-sm hover:bg-ink hover:text-paper">
            Ver anuncio en {l.source} <ExternalLink size={14} strokeWidth={1.5} />
          </a>
        </div>
      </div>
    </div>
  );
}
