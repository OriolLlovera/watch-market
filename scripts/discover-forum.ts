/**
 * Descubre las secciones de compraventa de un foro y comprueba sus feeds RSS.
 *   npm run discover -- https://www.ejemplo-foro.com
 * Respeta robots.txt (usa la misma capa que los conectores). Imprime la entrada lista para sources.ts.
 */
import * as cheerio from "cheerio";
import { politeFetch } from "../lib/connectors/http";

const SALE = /for ?sale|sales?\b|selling|sell|marketplace|classified|wts|b\/s\/t|trading|vend|venta|compra|verkauf|zu verkaufen|marktplatz|handel|vente|achat|te koop|koop|marktplaats|s[äa]ljes|s[äa]lj|k[öo]p|annunc|mercatino|vendita|angebot/i;
const WANT = /wanted|wtb|suche|busco|cerco|zoek|recherche|s[öo]ker|feedback|reviews?|scam|ayuda|help|rules|normas/i;

type Platform = "xenforo" | "vbulletin" | "phpbb" | "invision" | "desconocida";
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

(async () => {
  const arg = process.argv[2];
  if (!arg) return console.log("Uso: npm run discover -- https://url-del-foro.com");
  const base = new URL(/^https?:/.test(arg) ? arg : `https://${arg}`);
  const home = await politeFetch(base.toString(), { ttl: 0 });
  if (!home) return console.log("No se pudo leer la portada (¿robots.txt, bloqueo, 403/429?). No se intenta esquivar.");
  const platform = detect(home);
  console.log(`\nPlataforma detectada: ${platform}`);

  // Portada + índice de foros (rutas habituales por plataforma).
  const pages = [home];
  for (const p of platform === "xenforo" ? ["/forums/"] : platform === "vbulletin" ? ["/forum.php", "/forum/"] : platform === "phpbb" ? ["/index.php"] : ["/forums/"]) {
    const h = await politeFetch(new URL(p, base).toString(), { ttl: 0 }); if (h) pages.push(h);
  }
  const found = new Map<string, Cand>();
  for (const h of pages) for (const c of candidates(cheerio.load(h), base, platform)) found.set(c.id, c);
  if (!found.size) return console.log("No encontré secciones de compraventa. Abre el foro, copia a mano la URL de la sección y adapta el feed.");

  const ok: { name: string; feed: string; items: number }[] = [];
  for (const c of found.values()) {
    const feed = feedFor(c, platform, base);
    if (!feed) { console.log(`· ${c.name}: ${c.href}  (sin plantilla de RSS para ${platform})`); continue; }
    const xml = await politeFetch(feed, { ttl: 0 });
    const items = xml ? cheerio.load(xml, { xmlMode: true })("item").length : 0;
    console.log(`${items ? "✔" : "✘"} ${c.name}\n    ${feed}  → ${xml ? items + " items" : "no accesible"}`);
    if (items) ok.push({ name: c.name, feed, items });
  }
  if (!ok.length) return console.log("\nNingún feed válido. Puede que el RSS esté desactivado o bloqueado por robots.txt.");
  console.log(`\nRevisa que las secciones sean de VENTA (no de compra/ayuda) y pega en lib/connectors/sources.ts:\n`);
  console.log(`  {\n    name: "${base.hostname.replace(/^www\./, "")}", country: "??", defaultCurrency: "EUR",\n    feedUrls: [\n${ok.map((o) => `      "${o.feed}", // ${o.name}`).join("\n")}\n    ],\n    maxThreads: 20,\n  },`);
  console.log(`\nSi el título no lleva el precio (como en Relojes Especiales), el conector lo busca en el primer mensaje del hilo.`);
})();
