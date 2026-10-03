// Job de scraping: refresca TODAS las fuentes activas y guarda el resultado en Netlify Blobs.
//   npm run scrape
// Con NETLIFY_SITE_ID + NETLIFY_AUTH_TOKEN escribe en los Blobs de tu sitio (así lo usa GitHub Actions);
// sin ellas escribe en .cache/ como en desarrollo. En CI (GitHub Actions) NUNCA se permite caer a disco en silencio.
import { refreshAll } from "../lib/connectors/registry";
import { probe, storageInfo } from "../lib/connectors/store";

const die = (msg: string): never => { console.error(`\nERROR: ${msg}`); process.exit(1); };
const len = (v?: string) => (v?.trim() ? `definida (${v.trim().length} caracteres)` : "VACÍA o no definida");

(async () => {
  const env = process.env, info = storageInfo();
  const mustUseBlobs = !!(env.CI || env.GITHUB_ACTIONS || env.WM_REQUIRE_BLOBS === "1");
  console.log(`Almacenamiento: ${info.mode.toUpperCase()}${mustUseBlobs ? " (CI: se exige Blobs)" : ""}`);
  console.log(`  NETLIFY_SITE_ID:    ${env.NETLIFY_SITE_ID?.trim() ? `${env.NETLIFY_SITE_ID.trim().slice(0, 8)}… (${env.NETLIFY_SITE_ID.trim().length} caracteres; un Site ID real tiene 36)` : "VACÍA o no definida"}`);
  console.log(`  NETLIFY_AUTH_TOKEN: ${len(env.NETLIFY_AUTH_TOKEN)}`);

  if (mustUseBlobs && info.mode !== "blobs") {
    die("estás en CI pero faltan credenciales de Netlify, así que se habría guardado en el disco del runner (que se borra) y la web no vería nada.\n"
      + "  Faltan: " + Object.entries(info.credentials).filter(([, ok]) => !ok).map(([k]) => k).join(", ") + "\n"
      + "  En GitHub: Settings > Secrets and variables > Actions > pestaña *Secrets* > *Repository secrets*, con ESTOS nombres exactos.\n"
      + "  (Si están en la pestaña Variables, en Environment secrets o en Dependabot secrets, el workflow no los ve.)");
  }

  const res = await refreshAll();
  if (!res.length) die("ningún conector activo: revisa lib/connectors/sources.ts y las variables REDDIT_*/EBAY_*");

  // Lectura de vuelta: confirma que lo escrito está de verdad en el almacén (en Blobs, vía API de Netlify).
  const back = await Promise.all(res.map(async (r) => ({ ...r, enAlmacen: (await probe(`listings_${r.id}`)).found })));
  console.table(back.map(({ id, ...r }) => r));

  const notSaved = back.filter((r) => !r.saved), missing = back.filter((r) => r.saved && !r.enAlmacen), failed = back.filter((r) => !r.ok);
  if (failed.length) console.warn(`Sin resultados nuevos (se conserva lo anterior): ${failed.map((r) => r.name).join(", ")}`);
  if (notSaved.length) die(`no se pudo guardar: ${notSaved.map((r) => r.name).join(", ")} (mira los avisos [store] de arriba: token o Site ID incorrectos suelen dar 401/404)`);
  if (missing.length) die(`se escribió pero no se puede leer de vuelta: ${missing.map((r) => r.name).join(", ")}`);
  if (failed.length === back.length) die("ninguna fuente devolvió anuncios");
  console.log(`\nOK: ${back.reduce((n, r) => n + r.count, 0)} anuncios guardados en ${info.mode}.`);
  process.exit(0);
})();
