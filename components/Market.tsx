"use client";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Filters, Listing, SortKey } from "@/lib/types";
import { SIZES, applyFilters } from "@/lib/search";
import ListingCard from "./ListingCard";
import ListingModal from "./ListingModal";
const EMPTY: Filters = { q: "", brands: [], model: "", reference: "", min: "", max: "", sizes: [], styles: [], sources: [], countries: [], conditions: [] };
const STYLES = ["Diver","Dress","Chronograph","Sport","GMT","Field","Pilot","Digital","Vintage","Military"];
const uniq = (a: string[]) => Array.from(new Set(a)).sort();
const inp = "w-full border-b border-line bg-transparent py-1.5 text-sm placeholder:text-mute focus:border-ink focus:outline-none";
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <fieldset className="border-t border-line py-4"><legend className="float-left mb-2 w-full text-sm font-medium">{title}</legend><div className="clear-both">{children}</div></fieldset>;
}
function Checks({ opts, value, on }: { opts: string[]; value: string[]; on: (v: string[]) => void }) {
  return <div className="max-h-44 space-y-1.5 overflow-y-auto pr-1">{opts.map((o) => (
    <label key={o} className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" className="accent-accent" checked={value.includes(o)} onChange={() => on(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])} />{o}
    </label>))}</div>;
}
export default function Market({ listings, refreshing = false }: { listings: Listing[]; refreshing?: boolean }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<SortKey>("recent");
  const [open, setOpen] = useState<Listing | null>(null);
  const [show, setShow] = useState(48);
  const [panel, setPanel] = useState(false);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setF((p) => ({ ...p, [k]: v })); setShow(48); };
  const rows = useMemo(() => applyFilters(listings, f, sort), [listings, f, sort]);
  const facets = useMemo(() => ({ brands: uniq(listings.map((l) => l.brand)), sources: uniq(listings.map((l) => l.source)), countries: uniq(listings.map((l) => l.country)), conditions: uniq(listings.map((l) => l.condition)) }), [listings]);
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY);
  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-[1500px] items-center gap-6 px-5 py-4 lg:px-10">
          <span className="font-serif text-2xl tracking-tight">Watch Market</span>
          <label className="flex flex-1 items-center gap-3 border-b border-ink py-1.5">
            <Search size={16} strokeWidth={1.5} className="text-mute" />
            <input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Rolex Submariner, 18038, Seiko SARB017, Omega Speedmaster" className="w-full bg-transparent text-[15px] placeholder:text-mute focus:outline-none" aria-label="Buscar anuncios" />
          </label>
          <button onClick={() => setPanel(!panel)} className="flex items-center gap-1.5 text-sm lg:hidden"><SlidersHorizontal size={15} strokeWidth={1.5} />Filtros</button>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1500px] flex-col gap-12 px-5 py-8 lg:flex-row lg:px-10">
        <aside className={`${panel ? "block" : "hidden"} shrink-0 lg:block lg:w-60`}>
          <div className="mb-3 flex items-baseline justify-between text-sm"><span className="font-medium">Filtros</span>
            {dirty && <button onClick={() => setF(EMPTY)} className="text-accent underline underline-offset-4">Borrar todo</button>}</div>
          <Group title="Marca"><Checks opts={facets.brands} value={f.brands} on={(v) => set("brands", v)} /></Group>
          <Group title="Modelo y referencia">
            <input className={inp} placeholder="Modelo" value={f.model} onChange={(e) => set("model", e.target.value)} />
            <input className={`${inp} mt-3`} placeholder="Referencia" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
          </Group>
          <Group title="Precio (USD)"><div className="flex gap-4">
            <input className={inp} inputMode="numeric" placeholder="Mín." value={f.min} onChange={(e) => set("min", e.target.value)} />
            <input className={inp} inputMode="numeric" placeholder="Máx." value={f.max} onChange={(e) => set("max", e.target.value)} /></div></Group>
          <Group title="Tamaño de caja"><Checks opts={SIZES.map((s) => s[0])} value={f.sizes} on={(v) => set("sizes", v)} /></Group>
          <Group title="Estilo"><Checks opts={STYLES} value={f.styles} on={(v) => set("styles", v)} /></Group>
          <Group title="Fuente"><Checks opts={facets.sources} value={f.sources} on={(v) => set("sources", v)} /></Group>
          <Group title="País"><Checks opts={facets.countries} value={f.countries} on={(v) => set("countries", v)} /></Group>
          <Group title="Condición"><Checks opts={facets.conditions} value={f.conditions} on={(v) => set("conditions", v)} /></Group>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mb-6 flex items-baseline justify-between border-b border-line pb-3 text-sm">
            <span className="num text-mute">{rows.length} anuncios{refreshing && " · actualizando fuentes…"}</span>
            <label className="flex items-center gap-2 text-mute">Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="bg-transparent text-ink focus:outline-none">
                <option value="recent">Más recientes</option><option value="priceAsc">Precio menor</option><option value="priceDesc">Precio mayor</option><option value="relevance">Relevancia</option>
              </select></label>
          </div>
          {rows.length === 0 ? <p className="py-24 text-center text-mute">{refreshing ? "Cargando anuncios de las fuentes… aparecerán en unos segundos." : "Ningún anuncio coincide. Quita algún filtro o prueba con otra referencia."}</p> : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 2xl:grid-cols-4">
              {rows.slice(0, show).map((l) => <ListingCard key={l.id} l={l} onOpen={() => setOpen(l)} />)}
            </div>)}
          {rows.length > show && <div className="mt-12 text-center"><button onClick={() => setShow(show + 48)} className="border border-line px-6 py-2.5 text-sm hover:border-ink">Mostrar más</button></div>}
        </main>
      </div>
      {open && <ListingModal l={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
