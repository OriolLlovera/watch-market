import * as cheerio from "cheerio";
import { politeFetch } from "./http";

/**
 * Descubrimiento de secciones de compraventa + feeds RSS de un foro.
 * Usa la misma capa educada que los conectores: respeta robots.txt, pausa por host, no esquiva 403/CAPTCHA/login.
 */
const SALE = /for ?sale|sales?\b|selling|sell|marketplace|classified|wts|b\/s\/t|trading|vend|venta|compra|verkauf|zu verkaufen|marktplatz|handel|vente|achat|te koop|koop|marktplaats|s[äa]ljes|s[äa]lj|k[öo]p|annunc|mercatino|vendita|angebot|biete/i;
const WANT = /wanted|wtb|suche|busco|cerco|zoek|recherche|s[öo]ker|feedback|reviews?|scam|ayuda|help|rules|normas/i;

export type Platform = "xenforo" | "vbulletin" | "phpbb" | "invision" | "desconocida";
const detect = (html: string): Platform =>
  /xenforo|data-template=|xf-|class="p-body|XF\.config/i.test(html) ? "xenforo"
  : /vbulletin|vb_|vbseo/i.test(html) ? "vbulletin"
  : /phpbb|phpBB|viewforum\.php/i.test(html) ? "phpbb"
  : /invision|ips\.|ipsType|data-ips/i.test(html) ? "invision" : "desconocida";

interface Cand { name: string; href: string; id: string }
function candidates($: cheerio.CheerioAPI, base: URL, p: Platform): Cand[] {
  const out = new Map<string, Cand>();
  $("a[href]").each((_, a) => {
    const raw = $(a).attr("href")!, name = $(a).text().replace(/\s+/g, " ").trim();
    if (!name || name.length > 90) return;
    let href: URL; try { href = new URL(raw, base); } catch { return; }
    if (href.host !== base.host) return;
    const path = href.pathname + href.search;
    const m = p === "xenforo" ? path.match(/^\/(?:[\w-]+\/)*forums\/[^/]+\.(\d+)\/?$/)
      : p === "vbulletin" ? path.match(/forumdisplay\.php(?:\?(?:.*&)?f=|\/)(\d+)|\/forums\/(\d+)-/)
      : p === "phpbb" ? path.match(/viewforum\.php\?(?:.*&)?f=(\d+)/)
      : p === "invision" ? path.match(/\/forum\/(\d+)-/) : null;
    const id = m && (m[1] || m[2]);
    if (!id || !(SALE.test(name) || SALE.test(decodeURIComponent(path))) || WANT.test(name)) return;
    out.set(id, { name, href: href.toString(), id });
  });
  return [...out.values()];
}
const feedFor = (c: Cand, p: Platform, base: URL) =>
  p === "xenforo" ? c.href.replace(/\/?(\?.*)?$/, "/") + "index.rss"
  : p === "vbulletin" ? `${base.origin}/external.php?type=RSS2&forumids=${c.id}`
  : p === "phpbb" ? `${base.origin}/app.php/feed/forum/${c.id}` : null;

export interface Discovery {
  platform: Platform;
  feeds: { name: string; feed: string; items: number }[];
  /** Mensaje si no hay nada utilizable (portada ilegible, sin secciones de venta, sin feeds válidos). */
  problem?: string;
}

export async function discoverForum(base: URL, log: (s: string) => void = () => {}): Promise<Discovery> {
  const home = await politeFetch(base.toString(), { ttl: 0 });
  if (!home) return { platform: "desconocida", feeds: [], problem: "No se pudo leer la portada (¿robots.txt, bloqueo, 403/429?). No se intenta esquivar." };
  const platform = detect(home);
  log(`Plataforma detectada: ${platform}`);

  const pages = [home];
  for (const p of platform === "xenforo" ? ["/forums/"] : platform === "vbulletin" ? ["/forum.php", "/forum/"] : platform === "phpbb" ? ["/index.php"] : ["/forums/"]) {
    const h = await politeFetch(new URL(p, base).toString(), { ttl: 0 }); if (h) pages.push(h);
  }
  const found = new Map<string, Cand>();
  for (const h of pages) for (const c of candidates(cheerio.load(h), base, platform)) found.set(c.id, c);
  if (!found.size) return { platform, feeds: [], problem: "No encontré secciones de compraventa visibles (puede requerir login). Si existen, copia a mano la URL de la sección." };

  const feeds: Discovery["feeds"] = [];
  for (const c of found.values()) {
    const feed = feedFor(c, platform, base);
    if (!feed) { log(`· ${c.name}: ${c.href}  (sin plantilla de RSS para ${platform})`); continue; }
    const xml = await politeFetch(feed, { ttl: 0 });
    const items = xml ? cheerio.load(xml, { xmlMode: true })("item").length : 0;
    log(`${items ? "✔" : "✘"} ${c.name}\n    ${feed}  → ${xml ? items + " items" : "no accesible"}`);
    if (items) feeds.push({ name: c.name, feed, items });
  }
  return { platform, feeds, problem: feeds.length ? undefined : "Ningún feed válido: el RSS puede estar desactivado, requerir login o estar bloqueado por robots.txt." };
}

/** Entrada lista para pegar en lib/connectors/sources.ts */
export const sourceEntry = (name: string, country: string, currency: string, feeds: Discovery["feeds"]) =>
  `  {\n    name: ${JSON.stringify(name)}, country: ${JSON.stringify(country)}, defaultCurrency: ${JSON.stringify(currency)},\n    feedUrls: [\n${feeds.map((o) => `      ${JSON.stringify(o.feed)}, // ${o.name}`).join("\n")}\n    ],\n    maxThreads: 20,\n  },`;
