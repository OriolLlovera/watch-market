import * as cheerio from "cheerio";
import { Listing } from "../types";
import { Connector } from "./types";
import { politeFetch } from "./http";
import { readJson, writeJson } from "./store";
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
}

interface Detail { at: number; text: string; images: string[] }
const DETAIL_TTL = Number(process.env.THREAD_TTL_HOURS || 48) * 3600e3;
const MAX_FAILS = 3; // fallos seguidos antes de dejar de pedir hilos en este refresco (403/429/robots)

// Contenedor del primer mensaje según plataforma; se usa el primero que exista en la página.
const POST_SEL = ["article.message--post .bbWrapper", ".postbody .content", "[id^='post_message_']", ".post .content", "[data-role='commentContent']"];
const BAD_IMG = /smilies?|emoji|emoticon|avatar|\/styles\/|\/images\/(icons|misc|buttons|statusicon)|spacer|pixel|logo|\/reactions?\//i;
const slug = (s: string) => s.toLowerCase().replace(/\W+/g, "");

function extract(html: string, url: string): Detail {
  const $ = cheerio.load(html);
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
  return { at: Date.now(), text: root ? stripHtml(root.text()).slice(0, 3000) : "", images: Array.from(new Set(images)).slice(0, 8) };
}

export const forum = (s: ForumSource): Connector => ({
  id: slug(s.name), name: s.name, country: s.country, access: "rss", status: "active",

  async fetchListings(onProgress) {
    const key = `threads_${slug(s.name)}`;
    const cache = (await readJson<Record<string, Detail>>(key)) ?? {};
    const keep: Record<string, Detail> = {};
    const all: Listing[] = [], seen = new Set<string>();
    let fails = 0, fetched = 0;

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
      if (!xml) { console.warn(`[${s.name}] sin RSS: ${feedUrl}`); continue; }
      const $ = cheerio.load(xml, { xmlMode: true });
      const items = $("item").toArray().slice(s.skipItems ?? 0, (s.skipItems ?? 0) + (s.maxThreads ?? 20));
      let ok = 0;

      for (const el of items) {
        try {
          const it = $(el);
          const title = stripHtml(it.find("title").first().text());
          const link = it.find("link").first().text().trim();
          if (!title || !link || seen.has(link)) continue;
          seen.add(link);
          const rssBody = stripHtml(it.find("content\\:encoded, encoded, description").first().text());
          const cur = s.defaultCurrency ?? "EUR";

          // Atajo: sin marca en el título no hay anuncio válido (salvo parser propio): ahorra la petición.
          if (isWanted(title) || (!s.parse && !detectBrand(title))) continue;

          const d = await detail(link);
          if (d) keep[link] = d; // también los descartados: así no se vuelven a pedir
          let parsed: Parsed | null = null;
          if (s.parse && s.priceFromThread) {
            const price = d && s.priceFromThread(d.text);
            if (price) parsed = s.parse(title, rssBody, price);
          } else parsed = parseListing(title, d?.text || rssBody, cur);
          if (!parsed) continue;

          const date = new Date(it.find("pubDate").first().text());
          all.push({
            id: `${slug(s.name)}-${hash(link)}`, ...parsed,
            seller: it.find("dc\\:creator, creator").first().text().trim() || "—", source: s.name, country: s.country,
            postedAt: (isNaN(+date) ? new Date() : date).toISOString(), url: link, images: d?.images ?? [],
          });
          ok++;
          if (ok % 5 === 0) onProgress?.([...all]);
        } catch (e) { console.warn(`[${s.name}] error en un anuncio:`, (e as Error).message); }
      }
      console.log(`[${s.name}] ${feedUrl.split("/").slice(-2, -1)[0]}: ${ok}/${items.length} anuncios`);
      onProgress?.([...all]);
    }
    // Solo se conservan los hilos que siguen en los feeds: la caché no crece sin límite.
    await writeJson(key, keep);
    console.log(`[${s.name}] ${all.length} anuncios (${fetched} hilos nuevos descargados)`);
    return all;
  },
});
