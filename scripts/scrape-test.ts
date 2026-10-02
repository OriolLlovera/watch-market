// Prueba los conectores reales sin arrancar Next:  npm run scrape:test
import { CONNECTORS } from "../lib/connectors/registry";
(async () => {
  for (const c of CONNECTORS.filter((c) => c.status === "active")) {
    const t = Date.now(), ls = await c.fetchListings();
    console.log(`\n== ${c.name}: ${ls.length} anuncios, ${ls.filter((l) => l.images.length).length} con fotos (${Date.now() - t} ms)`);
    for (const l of ls.slice(0, 5)) console.log(` · ${l.brand} | ${l.model} | ${l.reference} | ${l.price} ${l.currency} | ${l.images.length} fotos\n   ${l.title}\n   ${l.url}`);
  }
  if (!CONNECTORS.some((c) => c.status === "active")) console.log("Ningún conector activo: define REDDIT_CLIENT_ID/SECRET o añade foros en lib/connectors/sources.ts");
})();
