import { Listing } from "../types";
import { MOCK_LISTINGS } from "../mock-data";
import { Connector } from "./types";
import { reddit } from "./reddit";
import { ebay } from "./ebay";
import { forum } from "./forum";
import { FORUM_SOURCES } from "./sources";
import { SERVERLESS, readJson, shared, writeJson } from "./store";

const planned = (name: string, country: string): Connector => ({
  id: name.toLowerCase().replace(/\W+/g, "-"), name, country, access: "pendiente", status: "planned",
  // Pendiente: `npm run discover -- <url>` y añadir a sources.ts. Sin saltar CAPTCHA, login ni bloqueos.
  async fetchListings() { return []; },
});
export const mockConnector: Connector = {
  id: "mock", name: "Datos de prueba", country: "—", access: "manual", status: "mock",
  async fetchListings() { return MOCK_LISTINGS; },
};

const PENDING: [string, string][] = [["Breitling Source","US"],["Forum a Montres","FR"],["Klocksnack","SE"],["Omega Forums","US"],["Orologi e Passioni","IT"],["Rolex Forums","US"],["Tidssonen","SE"],["Timezone","US"],["Uhrforum","DE"],["WatchCrunch","US"],["Watchnet","DE"],["WatchUSeek","US"],["Seiko & Citizen Watch Forum","US"],["The Watch Forum (UK)","GB"],["WatchLounge","US"],["Chronocentric","US"],["Horloge Forum","NL"],["Watchfreeks","NL"],["Wrist Sushi","US"]];
const real: Connector[] = [reddit, ebay, ...FORUM_SOURCES.map(forum)];
const done = new Set(real.filter((c) => c.status === "active").map((c) => c.name));
export const CONNECTORS: Connector[] = [mockConnector, ...real, ...PENDING.filter(([n]) => !done.has(n)).map(([n, c]) => planned(n, c))];

const active = () => CONNECTORS.filter((c) => c.status === "active");
const TTL = Number(process.env.LISTINGS_TTL_MIN || 15) * 60e3;

/**
 * Estado por fuente, en globalThis (sobrevive al recompilado de Next) y persistido en .cache/.
 * La página NUNCA espera al scraping: sirve lo último guardado y cada fuente se refresca en segundo plano.
 */
interface State { listings: Listing[]; at: number; running: boolean; ok?: boolean; saved?: boolean }
const states = shared("states", () => new Map<string, State>());
const boot = shared("boot", () => ({ p: null as Promise<void> | null, at: 0 }));
/** En serverless la web solo LEE lo que guarda el job de scraping: se relee cada minuto en cada instancia. */
const RELOAD_MS = 60e3;
const imgs = shared("imgs", () => ({ set: new Set<string>() }));
const st = (id: string) => { let s = states.get(id); if (!s) states.set(id, (s = { listings: [], at: 0, running: false })); return s; };

function rebuildImages() {
  imgs.set = new Set([...states.values()].flatMap((s) => s.listings.flatMap((l) => l.images)));
}
function hydrate(): Promise<void> {
  if (SERVERLESS && boot.p && Date.now() - boot.at > RELOAD_MS) boot.p = null;
  return (boot.p ??= (async () => {
    boot.at = Date.now();
    await Promise.all(active().map(async (c) => {
      const saved = await readJson<{ at: number; listings: Listing[] }>(`listings_${c.id}`);
      if (saved) Object.assign(st(c.id), { listings: saved.listings, at: saved.at });
    }));
    rebuildImages();
  })());
}

async function refresh(c: Connector) {
  const s = st(c.id);
  if (s.running) return;
  s.running = true;
  const old = s.listings, t0 = Date.now();
  try {
    const res = await c.fetchListings((partial) => {           // resultados parciales: se ven ya
      const urls = new Set(partial.map((l) => l.url));
      s.listings = [...partial, ...old.filter((l) => !urls.has(l.url))]; rebuildImages();
    });
    if (res.length || !old.length) s.listings = res;           // si falla (0 resultados) se conserva lo anterior
    else { s.listings = old; console.warn(`[${c.name}] 0 resultados: se conserva la caché anterior`); }
    s.ok = res.length > 0;
    s.at = res.length ? Date.now() : Date.now() - TTL + 2 * 60e3; // 0 resultados: reintento en ~2 min
    rebuildImages();
    s.saved = await writeJson(`listings_${c.id}`, { at: s.at, listings: s.listings });
    console.log(`[${c.name}] listo en ${((Date.now() - t0) / 1000).toFixed(1)} s: ${s.listings.length} anuncios`);
  } catch (e) { console.warn(`[${c.name}] falló:`, (e as Error).message); s.listings = old; s.ok = false; s.saved = false; s.at = Date.now() - TTL / 2; }
  finally { s.running = false; }
}

/** Lo que pinta la página: respuesta inmediata + refresco en segundo plano de lo que esté caducado. */
export async function getSnapshot(): Promise<{ listings: Listing[]; refreshing: boolean }> {
  await hydrate();
  const act = active();
  // En serverless NO se scrapea desde la web (la función se congela al responder): lo hace `npm run scrape`.
  if (!SERVERLESS) for (const c of act) if (!st(c.id).running && Date.now() - st(c.id).at > TTL) void refresh(c);
  const seen = new Set<string>();
  const rows = (act.length && process.env.USE_MOCK !== "1" ? [] : MOCK_LISTINGS).concat(act.flatMap((c) => st(c.id).listings));
  return { listings: rows.filter((l) => !seen.has(l.url) && seen.add(l.url)), refreshing: !SERVERLESS && act.some((c) => st(c.id).running) };
}
export async function isKnownImage(url: string) { await hydrate(); return imgs.set.has(url); }
/** Para scripts/tests: lanza una fuente y espera. */
export const refreshNow = refresh;
/** Para el job de scraping: refresca TODAS las fuentes activas en paralelo y resume el resultado. */
export async function refreshAll() {
  await hydrate(); // carga lo anterior: sirve de respaldo si una fuente falla
  await Promise.all(active().map(refresh));
  return active().map((c) => ({ name: c.name, count: st(c.id).listings.length, ok: !!st(c.id).ok, saved: !!st(c.id).saved }));
}
