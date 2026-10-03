// Job de scraping: refresca TODAS las fuentes activas y guarda el resultado en Netlify Blobs.
//   npm run scrape
// Con NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN escribe en los Blobs de tu sitio (así lo usa GitHub Actions);
// sin ellas escribe en .cache/ como en desarrollo. Sale con error si algo no se pudo guardar.
import { refreshAll } from "../lib/connectors/registry";

(async () => {
  const res = await refreshAll();
  if (!res.length) { console.error("Ningún conector activo: revisa lib/connectors/sources.ts y las variables REDDIT_*/EBAY_*"); process.exit(1); }
  console.table(res);
  const notSaved = res.filter((r) => !r.saved), failed = res.filter((r) => !r.ok);
  if (failed.length) console.warn(`Sin resultados nuevos (se conserva lo anterior): ${failed.map((r) => r.name).join(", ")}`);
  if (notSaved.length || failed.length === res.length) {
    console.error(`ERROR: ${notSaved.length ? "no se pudo guardar: " + notSaved.map((r) => r.name).join(", ") : "ninguna fuente devolvió anuncios"}`);
    process.exit(1);
  }
  process.exit(0);
})();
