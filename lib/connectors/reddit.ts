import { Listing } from "../types";
import { Connector } from "./types";
import { UA, throttle } from "./http";
import { imageUrls, parseListing } from "./parse";

/**
 * r/Watchexchange vía API OFICIAL de Reddit (OAuth "application-only").
 * Reddit no permite rastreo anónimo (robots.txt) y su API da galerías completas de fotos.
 * 1) https://www.reddit.com/prefs/apps -> "create another app" -> tipo "script" (o "web app")
 * 2) .env.local: REDDIT_CLIENT_ID=...  REDDIT_CLIENT_SECRET=...
 * Revisa los términos de la API de Reddit si el proyecto va a ser comercial.
 */
const ID = process.env.REDDIT_CLIENT_ID, SECRET = process.env.REDDIT_CLIENT_SECRET;
const SUBREDDIT = process.env.REDDIT_SUBREDDIT || "Watchexchange";
let tok: { v: string; exp: number } | null = null;

async function token(): Promise<string | null> {
  if (tok && Date.now() < tok.exp) return tok.v;
  const r = await throttle("www.reddit.com", () => fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { authorization: "Basic " + Buffer.from(`${ID}:${SECRET}`).toString("base64"), "user-agent": UA, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }));
  if (!r.ok) { console.warn(`[reddit] token ${r.status}`); return null; }
  const j = await r.json();
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return tok.v;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function photos(d: any): string[] {
  const out: string[] = [];
  const meta = d.media_metadata as Record<string, any> | undefined;
  if (d.is_gallery && meta) // galería: respeta el orden elegido por el vendedor
    for (const it of d.gallery_data?.items ?? []) { const u = meta[it.media_id]?.s?.u; if (u && meta[it.media_id].status === "valid") out.push(u); }
  if (!out.length && d.post_hint === "image" && d.url) out.push(d.url);
  out.push(...imageUrls(d.selftext ?? ""));
  if (!out.length) { const p = d.preview?.images?.[0]?.source?.url; if (p) out.push(p); }
  return Array.from(new Set(out)).slice(0, 8);
}

export const reddit: Connector = {
  id: "reddit", name: "Reddit", country: "US", access: "api", status: ID && SECRET ? "active" : "planned",
  async fetchListings() {
    if (!ID || !SECRET) return [];
    const t = await token(); if (!t) return [];
    const r = await throttle("oauth.reddit.com", () => fetch(`https://oauth.reddit.com/r/${SUBREDDIT}/new?limit=100&raw_json=1`, {
      headers: { authorization: `Bearer ${t}`, "user-agent": UA }, signal: AbortSignal.timeout(10000), cache: "no-store" }));
    if (!r.ok) { console.warn(`[reddit] listado ${r.status}`); return []; }
    const posts: any[] = (await r.json()).data?.children?.map((c: any) => c.data) ?? [];
    const out: Listing[] = [];
    for (const d of posts) {
      if (!/\b(wts|fs)\b|\[(wts|fs)\]/i.test(d.title) || d.removed_by_category || d.over_18) continue;
      const p = parseListing(d.title, d.selftext ?? "", "USD"); if (!p) continue;
      out.push({ id: `reddit-${d.id}`, ...p, seller: `u/${d.author}`, source: "Reddit", country: "US",
        postedAt: new Date(d.created_utc * 1000).toISOString(), url: `https://www.reddit.com${d.permalink}`, images: photos(d) });
    }
    return out;
  },
};
