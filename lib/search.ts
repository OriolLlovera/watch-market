import { Currency, Filters, Listing, SortKey } from "./types";
export const SIZES = [["<36", 0, 36], ["36–38", 36, 38], ["38–40", 38, 40], ["40–42", 40, 42], ["42–44", 42, 44], ["44+", 44, 999]] as const;
// Cambio aproximado a USD (solo para ordenar/filtrar y mostrar "≈"). Estáticos: ajústalos aquí si se desvían.
const FX: Record<Currency, number> = { USD: 1, EUR: 1.08, GBP: 1.27, CHF: 1.15, NOK: 0.095, SEK: 0.098, DKK: 0.145, AUD: 0.65, CAD: 0.73 };
export const toUsd = (l: Listing) => l.price * FX[l.currency];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function score(l: Listing, q: string) {
  const t = norm(q).split(/\s+/).filter(Boolean);
  if (!t.length) return 0;
  let s = 0;
  for (const w of t) {
    const hit = (f: string, p: number) => (norm(f).includes(w) ? p : 0);
    const w1 = hit(l.reference, 5) + hit(l.model, 3) + hit(l.brand, 3) + hit(l.title, 2) + hit(l.description, 1);
    if (!w1) return -1;
    s += w1;
  }
  return s;
}
export function applyFilters(all: Listing[], f: Filters, sort: SortKey) {
  const min = parseFloat(f.min), max = parseFloat(f.max);
  const inSize = (n: number) => n > 0 && f.sizes.some((id) => { const r = SIZES.find((x) => x[0] === id)!; return n >= r[1] && n < r[2]; });
  const rows = all
    .map((l) => ({ l, s: score(l, f.q) }))
    .filter(({ l, s }) =>
      s >= 0 &&
      (!f.brands.length || f.brands.includes(l.brand)) &&
      (!f.model || norm(l.model).includes(norm(f.model))) &&
      (!f.reference || norm(l.reference).includes(norm(f.reference))) &&
      (isNaN(min) || toUsd(l) >= min) && (isNaN(max) || toUsd(l) <= max) &&
      (!f.sizes.length || inSize(l.caseSize)) &&
      (!f.styles.length || f.styles.includes(l.style)) &&
      (!f.sources.length || f.sources.includes(l.source)) &&
      (!f.countries.length || f.countries.includes(l.country)) &&
      (!f.conditions.length || f.conditions.includes(l.condition)) &&
      (!f.movements.length || (!!l.movement && f.movements.includes(l.movement))) &&
      (!f.materials.length || (!!l.material && f.materials.includes(l.material))) &&
      (!f.contents.length || (!!l.contents && f.contents.includes(l.contents))));
  rows.sort((a, b) =>
    sort === "priceAsc" ? toUsd(a.l) - toUsd(b.l) :
    sort === "priceDesc" ? toUsd(b.l) - toUsd(a.l) :
    sort === "relevance" && f.q ? b.s - a.s || +new Date(b.l.postedAt) - +new Date(a.l.postedAt) :
    +new Date(b.l.postedAt) - +new Date(a.l.postedAt));
  return rows.map((r) => r.l);
}
// Cada divisa en su formato natural: $1,150 · £960 · 1.150 €  (con "es-ES" salían "960 GBP" y "220 US$").
const LOCALE: Record<Currency, string> = { USD: "en-US", GBP: "en-GB", EUR: "es-ES", CHF: "de-CH", NOK: "nb-NO", SEK: "sv-SE", DKK: "da-DK", AUD: "en-AU", CAD: "en-CA" };
export const money = (l: Listing) => new Intl.NumberFormat(LOCALE[l.currency], { style: "currency", currency: l.currency, maximumFractionDigits: 0 }).format(l.price);
export function ago(iso: string) {
  const m = Math.max(1, Math.round((Date.now() - +new Date(iso)) / 60000));
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24); return `hace ${d} ${d === 1 ? "día" : "días"}`;
}
