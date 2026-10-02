import { Condition, Listing } from "../types";
import { Connector } from "./types";
import { UA, throttle } from "./http";
import { parseListing } from "./parse";

/**
 * eBay vía Browse API OFICIAL (https://developer.ebay.com). Sin scraping.
 * 1) Crea una cuenta de desarrollador y una "Application Keyset" (Production).
 * 2) .env.local:  EBAY_APP_ID=<App ID (Client ID)>   EBAY_CERT_ID=<Cert ID (Client Secret)>
 * Opcionales:
 *   EBAY_MARKETPLACES=EBAY_ES,EBAY_DE      (por defecto EBAY_ES; también EBAY_US, EBAY_GB, EBAY_FR, EBAY_IT...)
 *   EBAY_QUERIES=Rolex,Omega,Seiko         (una búsqueda por término y mercado; ~1 llamada cada una)
 *   EBAY_CATEGORY=31387                    (Wristwatches; compruébalo en tu mercado)
 *   EBAY_CAMPAIGN_ID=...                   (eBay Partner Network: devuelve enlaces de afiliado)
 * Límite por defecto de la API: 5.000 llamadas/día. Con 13 términos × 1 mercado × refresco cada 15 min ≈ 1.250/día.
 */
const APP = process.env.EBAY_APP_ID, CERT = process.env.EBAY_CERT_ID, CAMPAIGN = process.env.EBAY_CAMPAIGN_ID;
const MARKETS = (process.env.EBAY_MARKETPLACES || "EBAY_ES").split(",").map((s) => s.trim()).filter(Boolean);
const QUERIES = (process.env.EBAY_QUERIES || "Rolex,Omega,Tudor,Seiko,Grand Seiko,Breitling,TAG Heuer,Longines,Hamilton,Cartier,IWC,Panerai,Zenith").split(",").map((s) => s.trim()).filter(Boolean);
const CATEGORY = process.env.EBAY_CATEGORY || "31387";
const COUNTRY: Record<string, string> = { EBAY_ES: "ES", EBAY_DE: "DE", EBAY_US: "US", EBAY_GB: "GB", EBAY_FR: "FR", EBAY_IT: "IT", EBAY_AT: "AT", EBAY_NL: "NL", EBAY_BE: "BE", EBAY_IE: "IE" };
const JUNK = /\b(replacement|compatible|strap only|band only|bracelet only|box only|empty box|manual only|dial only|movement only|bezel insert|crystal only|buckle|clasp|repair kit|watch winder|display case|correa|caja vac[ií]a)\b/i;
const COND: Record<string, Condition> = { "1000": "Nuevo", "1500": "Nuevo", "1750": "Nuevo", "2750": "Como nuevo", "7000": "Para piezas" };

let tok: { v: string; exp: number } | null = null;
async function token(): Promise<string | null> {
  if (tok && Date.now() < tok.exp) return tok.v;
  const r = await throttle("api.ebay.com", () => fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { authorization: "Basic " + Buffer.from(`${APP}:${CERT}`).toString("base64"), "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: "grant_type=client_credentials&scope=" + encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
  }));
  if (!r.ok) { console.warn(`[eBay] token ${r.status}`); return null; }
  const j = await r.json();
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
  return tok.v;
}
/** Las búsquedas devuelven miniaturas (s-l225); pedimos la grande y el proxy de imágenes la reduce. */
const big = (u?: string) => (u ? u.replace(/s-l\d+\./, "s-l1600.") : "");

/* eslint-disable @typescript-eslint/no-explicit-any */
export const ebay: Connector = {
  id: "ebay", name: "eBay", country: "—", access: "api", status: APP && CERT ? "active" : "planned",
  async fetchListings(onProgress) {
    if (!APP || !CERT) return [];
    const t = await token(); if (!t) return [];
    const out = new Map<string, Listing>();
    for (const market of MARKETS) for (const q of QUERIES) {
      const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&category_ids=${CATEGORY}&limit=100&sort=newlyListed&filter=${encodeURIComponent("buyingOptions:{FIXED_PRICE}")}`;
      const r = await throttle("api.ebay.com", () => fetch(url, { signal: AbortSignal.timeout(15000), cache: "no-store",
        headers: { authorization: `Bearer ${t}`, "x-ebay-c-marketplace-id": market, "user-agent": UA, ...(CAMPAIGN ? { "x-ebay-c-enduserctx": `affiliateCampaignId=${CAMPAIGN}` } : {}) } }));
      if (!r.ok) { console.warn(`[eBay] ${market} "${q}": ${r.status}`); if (r.status === 429 || r.status === 401) break; continue; }
      for (const it of ((await r.json()).itemSummaries ?? []) as any[]) {
        const currency = it.price?.currency, price = Math.round(parseFloat(it.price?.value));
        if (!["USD", "EUR", "GBP"].includes(currency) || !(price >= 30) || JUNK.test(it.title)) continue;
        const p = parseListing(it.title, "", currency, { price, currency }); if (!p) continue;
        const images = Array.from(new Set([it.image?.imageUrl, ...(it.additionalImages ?? []).map((x: any) => x.imageUrl)].filter(Boolean).map(big))).slice(0, 8) as string[];
        const listing: Listing = { id: `ebay-${String(it.itemId).replace(/\W+/g, "")}`, ...p, condition: COND[String(it.conditionId)] ?? p.condition,
          seller: it.seller?.username ?? "—", source: "eBay", country: it.itemLocation?.country ?? COUNTRY[market] ?? "—",
          postedAt: it.itemCreationDate ?? new Date().toISOString(), url: it.itemAffiliateWebUrl ?? it.itemWebUrl, images };
        out.set(listing.url, listing);
      }
      onProgress?.([...out.values()]);
    }
    return [...out.values()];
  },
};
