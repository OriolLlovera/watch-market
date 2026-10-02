import type { Condition, Listing, Style } from "../types";

export type Currency = Listing["currency"];
export type Parsed = Pick<Listing, "title" | "description" | "brand" | "model" | "reference" | "price" | "currency" | "condition" | "caseSize" | "style" | "dial">;

// Orden importa: los nombres largos primero ("Grand Seiko" antes que "Seiko").
const BRANDS = ["Grand Seiko", "Jaeger-LeCoultre", "Jaeger LeCoultre", "TAG Heuer", "Audemars Piguet", "Patek Philippe", "Vacheron Constantin", "Universal Geneve", "Christopher Ward", "Raymond Weil",
  "Rolex", "Omega", "Tudor", "Seiko", "Citizen", "Breitling", "IWC", "Cartier", "Heuer", "Casio", "Hamilton", "Panerai", "Longines", "Zenith", "Nomos", "Sinn", "Oris", "Tissot", "Bulova", "Orient",
  "Hublot", "Blancpain", "Baltic", "Squale", "Doxa", "Timex", "Marathon", "Glycine", "Certina", "Rado", "Montblanc", "Junghans", "Laco", "Stowa", "Farer", "Zodiac", "Vostok", "Enicar", "Eterna"];
const ALIAS: Record<string, string> = { "jaeger lecoultre": "Jaeger-LeCoultre", jlc: "Jaeger-LeCoultre", "tag heuer": "Heuer" };
const SYMBOL: Record<string, Currency> = { $: "USD", "us$": "USD", usd: "USD", "€": "EUR", eur: "EUR", "£": "GBP", gbp: "GBP" };

export const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
export const stripHtml = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&quot;/g, "'").replace(/\s+/g, " ").trim();

const num = (s: string) => parseFloat(/^\d{1,3}([.,]\d{3})+$/.test(s) ? s.replace(/[.,]/g, "") : s.replace(",", "."));

export function findPrice(text: string, fallback: Currency): { price: number; currency: Currency } | null {
  const m = text.match(/(us\$|\$|€|£)\s?(\d[\d.,]*)\s?(k\b)?|(\d[\d.,]*)\s?(k\b)?\s?(usd|eur|gbp|€|£|\$)/i);
  if (!m) return null;
  const sym = (m[1] ?? m[6]).toLowerCase(), raw = m[2] ?? m[4], k = m[3] ?? m[5];
  let price = num(raw) * (k ? 1000 : 1);
  if (!isFinite(price) || price < 20 || price > 2_000_000) return null;
  return { price: Math.round(price), currency: SYMBOL[sym] ?? fallback };
}

const STYLES: [Style, RegExp][] = [
  ["Diver", /diver|submariner|seamaster 300|sea-?dweller|skx|turtle|black bay|pelagos|superocean|planet ocean|aquaracer|prospex|hydroconquest|promaster/i],
  ["GMT", /gmt|world ?timer/i], ["Chronograph", /chrono|speedmaster|daytona|carrera|navitimer|moonwatch/i],
  ["Pilot", /pilot|flieger|aviator|navitimer|big crown/i], ["Field", /field|explorer|khaki|mil-?spec/i],
  ["Military", /military|luminor|\bw10\b|\bdirty dozen\b/i], ["Digital", /g-?shock|digital|f-91w/i],
  ["Dress", /dress|datejust|day-date|reverso|tank|calatrava|snowflake|constellation|pie-?pan/i],
];
const DIALS: [RegExp, string][] = [[/\bblack\b/i, "#141414"], [/\bblue\b/i, "#2f5d8a"], [/\bgreen\b/i, "#1f4d3a"], [/\b(white|panda|cream)\b/i, "#e8e4d8"], [/\b(silver|snowflake)\b/i, "#e4e6e8"], [/\b(champagne|gold)\b/i, "#c7a63a"], [/\b(grey|gray)\b/i, "#6b6f73"], [/\bred\b/i, "#8a2a2a"]];

function condition(t: string, year?: number): Condition {
  if (/parts|for repair|not working|spares|non[- ]?running/i.test(t)) return "Para piezas";
  if (/\b(bnib|brand new|unworn|nos|new in box)\b/i.test(t)) return "Nuevo";
  if (/\b(like new|mint|lnib|nearly new|excellent|as new)\b/i.test(t)) return "Como nuevo";
  if (/vintage/i.test(t) || (year && year < 1985)) return "Vintage";
  return "Usado";
}

/**
 * Convierte título (+ texto del anuncio) en campos de Listing.
 * Devuelve null si no parece una venta con marca y precio (WTB, intercambios, ruido...).
 */
/** Marca reconocida en un texto (o undefined). Sirve para descartar hilos antes de pedir su página. */
export function detectBrand(text: string): string | undefined {
  const lower = text.toLowerCase();
  const b = BRANDS.find((x) => new RegExp(`(^|[^a-z])${x.replace(/[-]/g, "[- ]?")}([^a-z]|$)`, "i").test(text));
  const alias = Object.keys(ALIAS).find((a) => new RegExp(`(^|[^a-z])${a}([^a-z]|$)`).test(lower));
  return b ? (ALIAS[b.toLowerCase()] ?? b) : alias ? ALIAS[alias] : undefined;
}

/** Compras, intercambios y meta-hilos: no son ventas. */
export const isWanted = (t: string) => /\b(wtb|wanted|looking for|iso|wtt|trade only|busco|compro|suche|zoek|cerco)\b|\[(wtb|wtt|meta|discussion)\]/i.test(t);
const dbg = (...a: unknown[]) => process.env.DEBUG_PARSE === "1" && console.log("[parse]", ...a);
export function parseListing(title: string, body = "", fallbackCurrency: Currency = "USD", known?: { price: number; currency: Currency }): Parsed | null {
  const clean = title.replace(/\s+/g, " ").trim();
  if (isWanted(clean)) return null;
  const brand = detectBrand(clean);
  if (!brand) { dbg("sin marca:", clean); return null; }
  // `known`: precio ya fiable (p. ej. campo de una API); si no, se busca en título y texto.
  const pr = known ?? findPrice(clean, fallbackCurrency) ?? findPrice(body.slice(0, 800), fallbackCurrency);
  if (!pr) { dbg("sin precio:", clean); return null; }

  const year = clean.match(/\b(19[4-9]\d|20[0-2]\d)\b/)?.[1];
  const sizeM = (clean + " " + body).match(/\b(\d{2}(?:\.\d)?)\s?mm\b/i);
  const caseSize = sizeM && +sizeM[1] >= 20 && +sizeM[1] <= 60 ? +sizeM[1] : 0;

  // Quita etiquetas [WTS], el precio y la marca para quedarnos con modelo + referencia.
  const rest = clean.replace(/\[[^\]]*\]|\([^)]*\)/g, " ").replace(/(us\$|\$|€|£)\s?\d[\d.,]*k?|\d[\d.,]*k?\s?(usd|eur|gbp|€|£|\$)/gi, " ")
    .replace(new RegExp(brand.replace(/[-]/g, "[- ]?"), "i"), " ").replace(/\b\d{2}(\.\d)?\s?mm\b/gi, " ");
  const ref = (rest.match(/\b(?=[A-Za-z0-9.\-]*\d)[A-Za-z]{0,4}\d[A-Za-z0-9.\-]{2,11}\b/g) ?? []).find((t) => !/^(19|20)\d{2}$/.test(t) && t.length >= 4) ?? "";
  const NOISE = /\b(full (kit|set)|box (and|&) papers|b&p|like new|mint|serviced|unpolished|unworn|bnib|hand wound|\d{4})\b/gi;
  const head = rest.split(/,|\s[-–|—/+]\s|\bw\/|\bshipped\b|\bobo\b/i)[0].replace(NOISE, " ");
  const model = head.replace(ref, " ").replace(/[^\p{L}\p{N}.\- ]/gu, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 4).join(" ") || ref || brand;

  const ctx = `${clean} ${body.slice(0, 600)}`;
  return {
    title: clean, description: body.slice(0, 600) || clean, brand, model, reference: ref || "—", price: pr.price, currency: pr.currency,
    condition: condition(ctx, year ? +year : undefined), caseSize, style: STYLES.find(([, re]) => re.test(clean))?.[0] ?? "Sport",
    dial: DIALS.find(([re]) => re.test(clean))?.[1] ?? "#1c1c1c",
  };
}

const IMG = /\.(jpe?g|png|webp|gif)(\?|$)/i;
/** URLs de imagen directas en un texto (no resuelve álbumes tipo imgur.com/a/xxx). */
export const imageUrls = (text: string) => Array.from(new Set((text.match(/https?:\/\/[^\s"'<>)\]]+/g) ?? []).filter((u) => IMG.test(u) || /^https?:\/\/(i\.redd\.it|i\.imgur\.com)\//.test(u))));
