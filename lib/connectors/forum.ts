import * as cheerio from "cheerio";
import { Listing } from "../types";
import { Connector } from "./types";
import { politeFetch } from "./http";
import { diagnostics, readJson, writeJson } from "./store";
import { extractSpecs } from "./specs";
import { Currency, detectBrand, hash, isWanted, parseListing, stripHtml } from "./parse";

type Price = { price: number; currency: Currency };
type Parsed = Omit<Listing, "id" | "seller" | "source" | "country" | "postedAt" | "url" | "images">;

/** Foro con feed RSS por sección de compraventa (XenForo, vBulletin, phpBB, Invision...). */
export interface ForumSource {
  name: string; country: string;
  feedUrls: string[];
  /** Divisa cuando el texto no lleva símbolo. */
  defaultCurrency?: Currency;
  /** Máx. hilos por feed (cada uno nuevo = 1 petición extra). Por defecto 20. */
  maxThreads?: number;
  /** Items iniciales del feed a ignorar (p. ej. hilo fijado de normas). */
  skipItems?: number;
  /** Sitios donde el precio NO va en el título: se extrae del primer mensaje. Requiere `parse`. */
  priceFromThread?: (firstPostText: string) => Price | null;
  parse?: (title: string, body: string, price: Price) => Parsed;
  /** "xenforo-market": páginas de lista de una sección XenForo cuyas filas traen precio/estado/país ("Location: US FS  $4999USD"), no RSS. */
  /** "discourse": `feedUrls` son páginas de categoría en HTML (p. ej. https://foro/c/mercado/12), no RSS: Discourse veta el RSS en su robots.txt por defecto. */
  kind?: "rss" | "discourse" | "xenforo-market";
  /** Hilos cuyo título coincida se descartan (vendidos, reservados...). */
  skipTitle?: RegExp;
}

interface Row { title: string; link: string; rssBody: string; date: string; creator: string; price?: Price; status?: string; country?: string; badCurrency?: string }

interface Detail { at: number; text: string; images: string[]; author?: string; postedAt?: string }
const DETAIL_TTL = Number(process.env.THREAD_TTL_HOURS || 48) * 3600e3;
const MAX_FAILS = 3; // fallos seguidos antes de dejar de pedir hilos en este refresco (403/429/robots)

// Contenedor del primer mensaje según plataforma; se usa el primero que exista en la página.
const POST_SEL = ["article.message--post .bbWrapper", ".postbody .content", "[id^='post_message_']", ".post .content", "[data-role='commentContent']",
  // Discourse (vista sin JavaScript): el primer mensaje es #post_1
  "#post_1 [itemprop='text']", "#post_1 .post", "[itemprop='articleBody']", ".crawler-post .post", ".cooked"];
// Discourse sirve el contenido dentro de <noscript>: con scripting activado, parse5 lo trata como texto y no se ve.
const loadHtml = (h: string) => cheerio.load(h, { scriptingEnabled: false });
const BAD_IMG = /smilies?|emoji|emoticon|avatar|\/styles\/|\/images\/(icons|misc|buttons|statusicon)|spacer|pixel|logo|\/reactions?\//i;
const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "");

function extract(html: string, url: string): Detail {
  const $ = loadHtml(html);
  const sel = POST_SEL.find((s) => $(s).length > 0);
  const root = sel ? $(sel).first() : null;
  const images: string[] = [];
  const add = (raw?: string) => {
    if (!raw || raw.startsWith("data:")) return;
    try { const u = new URL(raw, url).toString(); if (!BAD_IMG.test(u)) images.push(u); } catch { /* url inválida */ }
  };
  if (root) {
    const scope = sel!.startsWith("article") ? $("article.message--post, article.message").first() : root;
    scope.find("a.js-lbImage").each((_, a) => add($(a).attr("href"))); // XenForo: versión grande
    root.find("a[href]").each((_, a) => { const h = $(a).attr("href"); if (h && /\.(jpe?g|png|webp)(\?|$)/i.test(h) && $(a).find("img").length) add(h); });
    root.find("img").each((_, i) => {
      const a = $(i).closest("a[href]"), href = a.attr("href") || "";
      if (a.length && (a.hasClass("js-lbImage") || /\.(jpe?g|png|webp)(\?|$)/i.test(href))) return; // ya añadida su versión grande
      const w = parseInt($(i).attr("width") || "999", 10);
      if (!$(i).hasClass("smilie") && w >= 60) add($(i).attr("data-url") || $(i).attr("data-src") || $(i).attr("src"));
    });
  }
  if (!images.length) add($('meta[property="og:image"]').attr("content"));
  // Texto: sin los rótulos de las fotos de Discourse ("IMG_5154 3024×4032 2.93 MB"). Si no hay contenedor, la descripción og/meta.
  let text = "";
  if (root) { const c = root.clone(); c.find(".lightbox-wrapper, .lightbox .meta").remove(); text = stripHtml(c.text()).slice(0, 3000); }
  if (!text) text = stripHtml($('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "").slice(0, 3000);
  // Autor y fecha del hilo (Discourse no los da en la lista de categoría).
  const isDiscourse = /discourse/i.test($('meta[name="generator"]').attr("content") || "");
  const first: cheerio.Cheerio<any> | null = $("#post_1").length ? $("#post_1") : isDiscourse ? $.root() : null;
  const author = first && (first.find("[itemprop='author'] [itemprop='name']").first().text() || first.find(".creator").first().text() || first.find("a[href*='/u/']").first().text()).trim();
  const postedAt = $('meta[property="article:published_time"]').attr("content") || $("time[itemprop='datePublished']").first().attr("datetime");
  return { at: Date.now(), text, images: Array.from(new Set(images)).slice(0, 8), ...(author ? { author } : {}), ...(postedAt ? { postedAt } : {}) };
}

function rssRows(xml: string): Row[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("item").toArray().map((el) => { const it = $(el); return {
    title: stripHtml(it.find("title").first().text()), link: it.find("link").first().text().trim(),
    rssBody: stripHtml(it.find("content\\:encoded, encoded, description").first().text()),
    date: it.find("pubDate").first().text(), creator: it.find("dc\\:creator, creator").first().text().trim(),
  }; });
}

/** Lista de una sección-mercadillo de XenForo. Cada fila trae "Location: US FS" + precio ("$4999USD", "€10400", "360CHF").
 *  Independiente de clases CSS: la fila es el ancestro más grande que contiene un solo enlace de hilo. */
const SUPPORTED: Record<string, Currency> = { USD: "USD", EUR: "EUR", GBP: "GBP", CHF: "CHF", AUD: "AUD", CAD: "CAD", NOK: "NOK", SEK: "SEK", DKK: "DKK" };
// Etiquetas de estado de hilo (XenForo): vendido/retirado/reservado y "se busca". Sin \b: "Ø" no es carácter de palabra en JS.
const DEAD = /(?:^|\s)(?:SOLD|WITHDRAWN|EXPIRED|CANCELL?ED|PENDING|Solgt|Reservert|Verkauft|Vendido)(?=\s|$)/i;
const WANTED = /(?:^|\s)(?:Ønskes kjøpt|Ønskes|Kjøpes|Gesucht|WTB|Busco)(?=\s|$)/i;
function xenforoMarketRows(html: string, pageUrl: string): Row[] {
  const $ = loadHtml(html), out = new Map<string, Row>();
  const canon = (href: string | undefined) => { try { const u = new URL(href ?? "", pageUrl); return /\/threads\/[^/]+\.\d+\/?$/.test(u.pathname) ? u.origin + u.pathname : null; } catch { return null; } };
  const links = (el: cheerio.Cheerio<any>) => new Set(el.find("a[href*='/threads/']").toArray().map((x) => canon($(x).attr("href"))).filter(Boolean));
  $("a[href*='/threads/']").each((_, a) => {
    const link = canon($(a).attr("href")), title = stripHtml($(a).text());
    if (!link || !title || out.has(link) || !$(a).closest("h1,h2,h3,h4,.structItem-title").length) return;
    let row = $(a).parent();
    while (row.parent().length && links(row.parent()).size === 1) row = row.parent();
    const text = row.text().replace(/\s+/g, " ");
    const r: Row = { title, link, rssBody: "", date: row.find("time[datetime]").first().attr("datetime") ?? "", creator: "" };
    r.creator = row.find("a[href*='/members/']").toArray().map((x) => $(x).text().trim()).find(Boolean) ?? "";
    const m = text.match(/Location:\s*([A-Z]{2})\s+((?:[A-Z]{2,12}\s+)*?)([$€£])?\s?(\d[\d,.]*)\s?(USD|EUR|GBP|AUD|CAD|CHF|NZD)?/);
    if (m) {
      r.country = m[1]; r.status = m[2].trim();
      const cur = m[5] ?? ({ "€": "EUR", "£": "GBP", "$": "USD" } as Record<string, string>)[m[3] ?? ""];
      let n = m[4].replace(/,/g, ""); if (/^\d{1,3}(\.\d{3})+$/.test(n)) n = n.replace(/\./g, "");
      if (cur && SUPPORTED[cur] && +n > 0) r.price = { price: +n, currency: SUPPORTED[cur] }; else if (cur && !SUPPORTED[cur]) r.badCurrency = cur;
    }
    // Etiqueta de prefijo del hilo ("Selges", "Solgt", "Ønskes kjøpt"...): enlaces ?prefix_id=N de la fila.
    const prefix = row.find("a[href*='prefix_id=']").toArray().map((x) => $(x).text().trim()).filter(Boolean).join(" ");
    r.status = [prefix, r.status].filter(Boolean).join(" ").trim() || undefined;
    out.set(link, r);
  });
  return [...out.values()];
}

/** Lista de hilos de una categoría de Discourse: enlaces /t/<slug>/<id> (sin el /<nº de mensaje> de "último mensaje"). */
function discourseRows(html: string, pageUrl: string): Row[] {
  const $ = loadHtml(html), out = new Map<string, Row>();
  $("a[href]").each((_, a) => {
    let u: URL; try { u = new URL($(a).attr("href")!, pageUrl); } catch { return; }
    if (!/^\/t\/[^/]+\/\d+\/?$/.test(u.pathname)) return;
    const title = stripHtml($(a).text());
    if (!title || /^\d+$/.test(title)) return;
    const link = u.origin + u.pathname.replace(/\/$/, "");
    if (!out.has(link)) out.set(link, { title, link, rssBody: "", date: "", creator: "" });
  });
  return [...out.values()];
}

export const forum = (s: ForumSource): Connector => ({
  id: slug(s.name), name: s.name, country: s.country, access: "rss", status: "active",

  async fetchListings(onProgress) {
    const key = `threads_${slug(s.name)}`;
    const cache = (await readJson<Record<string, Detail>>(key)) ?? {};
    const keep: Record<string, Detail> = {};
    const all: Listing[] = [], seen = new Set<string>();
    let fails = 0, fetched = 0;
    const diag = { pages: [] as { url: string; ok: boolean; bytes?: number; rows?: number }[],
      skipped: { wanted: 0, titleFilter: 0, sold: 0, currency: 0, noBrand: 0, noDetail: 0, noParse: 0 }, accepted: 0 };

    const detail = async (url: string): Promise<Detail | null> => {
      const hit = cache[url];
      if (hit && Date.now() - hit.at < DETAIL_TTL) return hit;
      if (fails >= MAX_FAILS) return hit ?? null;     // el sitio nos rechaza: no insistimos
      const html = await politeFetch(url, { ttl: 5 * 60e3 });
      if (!html) { fails++; return hit ?? null; }
      fails = 0; fetched++;
      return extract(html, url);
    };

    for (const feedUrl of s.feedUrls) {
      const xml = await politeFetch(feedUrl);
      if (!xml) { diag.pages.push({ url: feedUrl, ok: false }); console.warn(`[${s.name}] sin ${s.kind === "discourse" ? "página de categoría" : "RSS"}: ${feedUrl}`); continue; }
      const rows = s.kind === "discourse" ? discourseRows(xml, feedUrl) : s.kind === "xenforo-market" ? xenforoMarketRows(xml, feedUrl) : rssRows(xml);
      diag.pages.push({ url: feedUrl, ok: true, bytes: xml.length, rows: rows.length });
      const items = rows.slice(s.skipItems ?? 0, (s.skipItems ?? 0) + (s.maxThreads ?? 20));
      let ok = 0;

      for (const row of items) {
        try {
          const { title, link, rssBody } = row;
          if (!title || !link || seen.has(link)) continue;
          seen.add(link);
          const cur = s.defaultCurrency ?? "EUR";

          // Atajo: sin marca en el título no hay anuncio válido (salvo parser propio): ahorra la petición.
          if (isWanted(title)) { diag.skipped.wanted++; continue; }
          if (s.skipTitle?.test(title)) { diag.skipped.titleFilter++; continue; }
          if (!s.parse && !detectBrand(title)) { diag.skipped.noBrand++; continue; }
          if (row.status && WANTED.test(row.status)) { diag.skipped.wanted++; continue; }
          if (row.status && DEAD.test(row.status)) { diag.skipped.sold++; continue; }
          if (row.badCurrency) { diag.skipped.currency++; continue; }

          const d = await detail(link);
          if (d) keep[link] = d; // también los descartados: así no se vuelven a pedir
          if (!d) diag.skipped.noDetail++;
          let parsed: Parsed | null = null;
          if (s.parse && s.priceFromThread) {
            const price = d && s.priceFromThread(d.text);
            if (price) parsed = s.parse(title, rssBody, price);
          } else parsed = parseListing(title, d?.text || rssBody, cur, row.price);
          if (!parsed) { diag.skipped.noParse++; continue; }
          parsed = { ...parsed, ...extractSpecs(title, d?.text || rssBody) }; // también para parsers propios (p. ej. Relojes Especiales)

          const date = new Date(row.date || d?.postedAt || "");
          all.push({
            id: `${slug(s.name)}-${hash(link)}`, ...parsed,
            seller: row.creator || d?.author || "—", source: s.name, country: row.country || s.country,
            postedAt: (isNaN(+date) ? new Date() : date).toISOString(), url: link, images: d?.images ?? [],
          });
          ok++; diag.accepted++;
          if (ok % 5 === 0) onProgress?.([...all]);
        } catch (e) { console.warn(`[${s.name}] error en un anuncio:`, (e as Error).message); }
      }
      console.log(`[${s.name}] ${feedUrl.split("/").slice(-2, -1)[0]}: ${ok}/${items.length} anuncios`);
      onProgress?.([...all]);
    }
    // Solo se conservan los hilos que siguen en los feeds: la caché no crece sin límite.
    if (all.length) await writeJson(key, keep); // si todo falló (red, 403...) no se borra la memoria de hilos anterior
    diagnostics[slug(s.name)] = diag;
    console.log(`[${s.name}] ${all.length} anuncios (${fetched} hilos nuevos descargados)`);
    return all;
  },
});
