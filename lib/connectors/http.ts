/**
 * fetch "educado" para todos los conectores:
 *  - respeta robots.txt (si no se puede leer o bloquea la ruta, NO se descarga)
 *  - 1 petición cada SCRAPER_DELAY_MS por host (por defecto 1 s)
 *  - caché en memoria (también de los fallos, para no insistir tras un 403/429)
 *  - User-Agent identificable. Pon un contacto real en SCRAPER_UA.
 * No reintenta ni esquiva bloqueos, CAPTCHAs o logins: si el sitio dice que no, se salta.
 */
import { shared } from "./store";
export const UA = process.env.SCRAPER_UA || "WatchMarketBot/0.1 (proyecto personal; define SCRAPER_UA con un email o URL de contacto)";
const DELAY = Number(process.env.SCRAPER_DELAY_MS || 1000);
const BOT = "watchmarketbot";

type Rule = [allow: boolean, re: RegExp, len: number];
const robots = shared("robots", () => new Map<string, { at: number; ttl: number; rules: Rule[] | "deny" }>());
const queue = shared("queue", () => new Map<string, Promise<unknown>>());
const cache = shared("httpcache", () => new Map<string, { at: number; body: string | null }>());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Serializa los trabajos de un mismo host dejando DELAY ms entre ellos. */
export function throttle<T>(host: string, job: () => Promise<T>): Promise<T> {
  const prev = queue.get(host) ?? Promise.resolve();
  const run = prev.then(job);
  queue.set(host, run.then(() => sleep(DELAY), () => sleep(DELAY)));
  return run;
}

function parseRobots(txt: string): Rule[] {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let cur: (typeof groups)[number] | null = null, lastAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const m = raw.replace(/#.*/, "").trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") {
      if (!cur || !lastAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(v.toLowerCase()); lastAgent = true; continue;
    }
    lastAgent = false;
    if (!cur || (k !== "allow" && k !== "disallow") || !v) continue;
    const re = new RegExp("^" + v.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    cur.rules.push([k === "allow", re, v.length]);
  }
  return (groups.find((g) => g.agents.includes(BOT)) ?? groups.find((g) => g.agents.includes("*")))?.rules ?? [];
}

export async function allowed(u: URL): Promise<boolean> {
  let e = robots.get(u.origin);
  if (!e || Date.now() - e.at > e.ttl) {
    let rules: Rule[] | "deny" = "deny", ttl = 5 * 60e3; // un fallo puntual de red solo bloquea 5 min, no 12 h
    try {
      const r = await fetch(`${u.origin}/robots.txt`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000), cache: "no-store" });
      if (r.ok) { rules = parseRobots(await r.text()); ttl = 12 * 3600e3; }
      else if (r.status === 404 || r.status === 410) { rules = []; ttl = 12 * 3600e3; }
      else if (r.status === 401 || r.status === 403) ttl = 3600e3;
    } catch { /* sin robots.txt legible => no descargamos */ }
    e = { at: Date.now(), ttl, rules }; robots.set(u.origin, e);
  }
  if (e.rules === "deny") return false;
  const path = u.pathname + u.search;
  const best = e.rules.filter(([, re]) => re.test(path)).sort((a, b) => b[2] - a[2] || +b[0] - +a[0])[0];
  return !best || best[0];
}

export async function politeFetch(url: string, o: { ttl?: number; robots?: boolean; headers?: Record<string, string> } = {}): Promise<string | null> {
  const { ttl = 15 * 60e3, robots: check = true, headers } = o;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.body;
  const u = new URL(url);
  let body: string | null = null;
  try {
    if (check && !(await allowed(u))) console.warn(`[scraper] robots.txt no permite ${url}`);
    else body = await throttle(u.host, async () => {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.5", ...headers }, signal: AbortSignal.timeout(10000), cache: "no-store" });
      if (!r.ok) { console.warn(`[scraper] ${r.status} en ${url}`); return null; }
      return await r.text();
    });
  } catch (e) { console.warn(`[scraper] error en ${url}:`, (e as Error).message); }
  cache.set(url, { at: Date.now(), body });
  return body;
}
