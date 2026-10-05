"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { Filters, Listing, SortKey } from "@/lib/types";
import { SIZES, ago, applyFilters } from "@/lib/search";
import ListingCard from "./ListingCard";
import ListingModal from "./ListingModal";
import ThemeToggle from "./ThemeToggle";

const EMPTY: Filters = { q: "", brands: [], model: "", reference: "", min: "", max: "", sizes: [], styles: [], sources: [], countries: [], conditions: [], movements: [], materials: [], contents: [] };
const STYLES = ["Diver", "Dress", "Chronograph", "Sport", "GMT", "Field", "Pilot", "Digital", "Vintage", "Military"];
const PAGE = 48;
const tally = (a: string[]): [string, number][] => {
  const m = new Map<string, number>(); a.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
};
const field = "w-full rounded-md border border-line bg-paper px-3 py-2 text-sm placeholder:text-mute focus:border-ink focus:outline-none";

function Logo() {
  return <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M16 7v9l6 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="16" cy="16" r="1.6" fill="currentColor" /></svg>;
}
function Group({ title, active = 0, children }: { title: string; active?: number; children: React.ReactNode }) {
  return (
    <details open className="group border-t border-line py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>{title}{active > 0 && <span className="num ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[11px] text-paper">{active}</span>}</span>
        <ChevronDown size={16} strokeWidth={1.5} className="text-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
function Checks({ opts, value, on }: { opts: [string, number?][]; value: string[]; on: (v: string[]) => void }) {
  return (
    <div className="max-h-52 space-y-0.5 overflow-y-auto pr-1">{opts.map(([o, n]) => (
      <label key={o} className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1 text-sm hover:bg-wash">
        <input type="checkbox" className="h-4 w-4 accent-accent" checked={value.includes(o)} onChange={() => on(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])} />
        <span className="flex-1 truncate">{o}</span>{n !== undefined && <span className="num text-xs text-mute">{n}</span>}
      </label>))}
    </div>
  );
}

export default function Market({ listings, refreshing = false, updatedAt = 0 }: { listings: Listing[]; refreshing?: boolean; updatedAt?: number }) {
  const [f, setF] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<SortKey>("recent");
  const [open, setOpen] = useState<Listing | null>(null);
  const [show, setShow] = useState(PAGE);
  const [drawer, setDrawer] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setF((p) => ({ ...p, [k]: v })); setShow(PAGE); };
  const rows = useMemo(() => applyFilters(listings, f, sort), [listings, f, sort]);
  const facets = useMemo(() => ({
    brands: tally(listings.map((l) => l.brand).filter((b) => b && b !== "—")), sources: tally(listings.map((l) => l.source)),
    countries: tally(listings.map((l) => l.country)), conditions: tally(listings.map((l) => l.condition)),
    styles: new Map(tally(listings.map((l) => l.style))),
    movements: tally(listings.flatMap((l) => (l.movement ? [l.movement] : []))),
    materials: tally(listings.flatMap((l) => (l.material ? [l.material] : []))),
    contents: tally(listings.flatMap((l) => (l.contents ? [l.contents] : []))),
  }), [listings]);
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY);

  useEffect(() => { // "/" enfoca el buscador
    const k = (e: KeyboardEvent) => { if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName)) { e.preventDefault(); searchRef.current?.focus(); } };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, []);
  useEffect(() => { document.body.style.overflow = drawer ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [drawer]);

  const chip = (key: string, label: string, clear: () => void) => ({ key, label, clear });
  const chips = [
    ...(f.q ? [chip("q", `“${f.q}”`, () => set("q", ""))] : []),
    ...f.brands.map((b) => chip("b" + b, b, () => set("brands", f.brands.filter((x) => x !== b)))),
    ...f.sources.map((b) => chip("s" + b, b, () => set("sources", f.sources.filter((x) => x !== b)))),
    ...f.countries.map((b) => chip("c" + b, b, () => set("countries", f.countries.filter((x) => x !== b)))),
    ...f.conditions.map((b) => chip("o" + b, b, () => set("conditions", f.conditions.filter((x) => x !== b)))),
    ...f.styles.map((b) => chip("y" + b, b, () => set("styles", f.styles.filter((x) => x !== b)))),
    ...f.movements.map((b) => chip("v" + b, b, () => set("movements", f.movements.filter((x) => x !== b)))),
    ...f.materials.map((b) => chip("a" + b, b, () => set("materials", f.materials.filter((x) => x !== b)))),
    ...f.contents.map((b) => chip("t" + b, b, () => set("contents", f.contents.filter((x) => x !== b)))),
    ...f.sizes.map((b) => chip("z" + b, `${b} mm`, () => set("sizes", f.sizes.filter((x) => x !== b)))),
    ...(f.model ? [chip("m", `Modelo: ${f.model}`, () => set("model", ""))] : []),
    ...(f.reference ? [chip("r", `Ref. ${f.reference}`, () => set("reference", ""))] : []),
    ...(f.min || f.max ? [chip("p", `${f.min || "0"} – ${f.max || "∞"} USD`, () => { set("min", ""); set("max", ""); })] : []),
  ];

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-5 py-3 lg:gap-6 lg:px-10">
          <a href="/" className="flex shrink-0 items-center gap-2 text-ink" aria-label="Watch Market, inicio"><Logo /><span className="hidden font-serif text-2xl tracking-tight sm:inline">Watch Market</span></a>
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-md border border-line bg-wash/60 px-3 py-2 transition focus-within:border-ink focus-within:bg-paper">
            <Search size={16} strokeWidth={1.5} className="shrink-0 text-mute" />
            <input ref={searchRef} value={f.q} onChange={(e) => set("q", e.target.value)} placeholder="Buscar relojes…" className="w-full min-w-0 bg-transparent text-[15px] placeholder:text-mute focus:outline-none" aria-label="Buscar anuncios" />
            <kbd className="hidden rounded border border-line px-1.5 text-[11px] text-mute md:block">/</kbd>
          </label>
          <button onClick={() => setDrawer(true)} aria-label="Abrir filtros" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-line px-3 text-sm lg:hidden"><SlidersHorizontal size={15} strokeWidth={1.5} /><span className="hidden sm:inline">Filtros</span>{dirty && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}</button>
          <ThemeToggle />
        </div>
      </header>

      <section className="border-b border-line bg-wash/50">
        <div className="mx-auto max-w-[1500px] px-5 py-8 lg:px-10 lg:py-10">
          <h1 className="max-w-3xl font-serif text-3xl leading-[1.15] tracking-tight md:text-[40px]">Relojes de segunda mano de foros especializados, en un solo buscador.</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mute">
            <span className="num"><b className="font-semibold text-ink">{listings.length}</b> anuncios</span>
            <span className="num"><b className="font-semibold text-ink">{facets.sources.length}</b> fuentes</span>
            {updatedAt > 0 && <span suppressHydrationWarning>Actualizado {ago(new Date(updatedAt).toISOString())}</span>}
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="flex flex-wrap gap-1.5">{facets.sources.map(([s, n]) => <span key={s} className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-ink">{s} <span className="num text-mute">{n}</span></span>)}</span>
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-10 px-5 py-8 lg:flex-row lg:px-10">
        <aside className={`${drawer ? "fixed inset-0 z-50 flex" : "hidden"} lg:static lg:z-auto lg:block lg:w-64 lg:shrink-0`}>
          {drawer && <div className="absolute inset-0 bg-ink/50 lg:hidden" onClick={() => setDrawer(false)} />}
          <div className="relative ml-auto flex h-full w-[88%] max-w-sm flex-col bg-paper lg:sticky lg:top-24 lg:ml-0 lg:block lg:h-auto lg:max-h-[calc(100vh-7rem)] lg:w-full lg:overflow-y-auto lg:bg-transparent lg:pr-2">
            <div className="flex-1 overflow-y-auto p-5 lg:overflow-visible lg:p-0">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Filtros</span>
              <span className="flex items-center gap-4">
                {dirty && <button onClick={() => setF(EMPTY)} className="text-accent underline underline-offset-4">Borrar todo</button>}
                <button onClick={() => setDrawer(false)} aria-label="Cerrar filtros" className="text-mute lg:hidden"><X size={20} strokeWidth={1.5} /></button>
              </span>
            </div>
            <Group title="Marca" active={f.brands.length}><Checks opts={facets.brands} value={f.brands} on={(v) => set("brands", v)} /></Group>
            <Group title="Modelo y referencia">
              <input className={field} placeholder="Modelo" value={f.model} onChange={(e) => set("model", e.target.value)} />
              <input className={`${field} mt-2`} placeholder="Referencia" value={f.reference} onChange={(e) => set("reference", e.target.value)} />
            </Group>
            <Group title="Precio (USD aprox.)" active={f.min || f.max ? 1 : 0}><div className="flex items-center gap-2">
              <input className={field} inputMode="numeric" placeholder="Mín." value={f.min} onChange={(e) => set("min", e.target.value)} aria-label="Precio mínimo" />
              <span className="text-mute">–</span>
              <input className={field} inputMode="numeric" placeholder="Máx." value={f.max} onChange={(e) => set("max", e.target.value)} aria-label="Precio máximo" />
            </div></Group>
            <Group title="Fuente" active={f.sources.length}><Checks opts={facets.sources} value={f.sources} on={(v) => set("sources", v)} /></Group>
            <Group title="Tamaño de caja" active={f.sizes.length}><Checks opts={SIZES.map((s) => [s[0]] as [string])} value={f.sizes} on={(v) => set("sizes", v)} /></Group>
            <Group title="Estilo" active={f.styles.length}><Checks opts={STYLES.filter((s) => (facets.styles.get(s) ?? 0) > 0 || f.styles.includes(s)).map((s) => [s, facets.styles.get(s) ?? 0] as [string, number])} value={f.styles} on={(v) => set("styles", v)} /></Group>
            {facets.movements.length > 0 && <Group title="Movimiento" active={f.movements.length}><Checks opts={facets.movements} value={f.movements} on={(v) => set("movements", v)} /></Group>}
            {facets.materials.length > 0 && <Group title="Material de la caja" active={f.materials.length}><Checks opts={facets.materials} value={f.materials} on={(v) => set("materials", v)} /></Group>}
            {facets.contents.length > 0 && <Group title="Contenido" active={f.contents.length}><Checks opts={facets.contents} value={f.contents} on={(v) => set("contents", v)} /></Group>}
            <Group title="País" active={f.countries.length}><Checks opts={facets.countries} value={f.countries} on={(v) => set("countries", v)} /></Group>
            <Group title="Condición" active={f.conditions.length}><Checks opts={facets.conditions} value={f.conditions} on={(v) => set("conditions", v)} /></Group>
            </div>
            <div className="border-t border-line bg-paper p-4 lg:hidden">
              <button onClick={() => setDrawer(false)} className="w-full rounded-md bg-ink py-2.5 text-sm font-medium text-paper">Ver {rows.length} anuncios</button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="num text-sm text-mute"><b className="font-semibold text-ink">{rows.length}</b> {rows.length === 1 ? "anuncio" : "anuncios"}{refreshing && " · actualizando fuentes…"}</p>
            <label className="flex items-center gap-2 text-sm text-mute">Ordenar por
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-line bg-paper px-2.5 py-1.5 text-ink focus:border-ink focus:outline-none">
                <option value="recent">Más recientes</option><option value="priceAsc">Precio: menor a mayor</option><option value="priceDesc">Precio: mayor a menor</option><option value="relevance">Relevancia</option>
              </select></label>
          </div>
          {chips.length > 0 && (
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {chips.map((c) => <button key={c.key} onClick={c.clear} className="inline-flex items-center gap-1 rounded-full border border-line bg-wash px-3 py-1 text-xs transition hover:border-ink">{c.label}<X size={12} strokeWidth={1.75} /></button>)}
              <button onClick={() => setF(EMPTY)} className="px-1 text-xs text-accent underline underline-offset-4">Borrar todo</button>
            </div>)}
          {rows.length === 0 ? (
            <div className="flex flex-col items-center py-24 text-center">
              <SearchX size={36} strokeWidth={1.25} className="text-mute" />
              <p className="mt-4 max-w-md text-mute">{refreshing ? "Cargando anuncios de las fuentes… aparecerán en unos segundos."
                : listings.length === 0 ? "Todavía no hay anuncios guardados. En Netlify los carga el job de scraping (GitHub Actions); abre /api/status para ver el estado."
                : "Ningún anuncio coincide con tu búsqueda. Quita algún filtro o prueba con otra referencia."}</p>
              {dirty && listings.length > 0 && <button onClick={() => setF(EMPTY)} className="mt-5 rounded-md border border-line px-5 py-2 text-sm hover:border-ink">Borrar filtros</button>}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 md:grid-cols-3 2xl:grid-cols-4">
              {rows.slice(0, show).map((l) => <ListingCard key={l.id} l={l} onOpen={() => setOpen(l)} />)}
            </div>)}
          {rows.length > show && <div className="mt-12 text-center"><button onClick={() => setShow(show + PAGE)} className="rounded-md border border-line px-7 py-2.5 text-sm transition hover:border-ink">Mostrar más <span className="num text-mute">({rows.length - show})</span></button></div>}
        </main>
      </div>

      <footer className="mt-12 border-t border-line">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-4 px-5 py-8 text-xs leading-relaxed text-mute lg:px-10">
          <p className="max-w-xl">Watch Market reúne anuncios públicos de foros de relojes. Cada anuncio enlaza con su fuente original; los precios en EUR o GBP se muestran con su equivalente aproximado en USD.</p>
          <p>Fuentes: {facets.sources.map(([s]) => s).join(" · ") || "—"}</p>
        </div>
      </footer>
      {open && <ListingModal l={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
