/**
 * Descubre las secciones de compraventa de un foro y comprueba sus feeds RSS.
 *   npm run discover -- https://www.ejemplo-foro.com
 * Respeta robots.txt (usa la misma capa que los conectores). Imprime la entrada lista para sources.ts.
 * Para probar varios foros de golpe: npm run discover:all
 */
import { discoverForum, sourceEntry } from "../lib/connectors/discover";

(async () => {
  const arg = process.argv[2];
  if (!arg) return console.log("Uso: npm run discover -- https://url-del-foro.com");
  const base = new URL(/^https?:/.test(arg) ? arg : `https://${arg}`);
  const r = await discoverForum(base, (s) => console.log(s));
  if (r.problem) return console.log(`\n${r.problem}`);
  console.log(`\nRevisa que las secciones sean de VENTA (no de compra/ayuda) y pega en lib/connectors/sources.ts:\n`);
  console.log(sourceEntry(base.hostname.replace(/^www\./, ""), "??", "EUR", r.feeds));
  console.log(`\nSi el título no lleva el precio (como en Relojes Especiales), el conector lo busca en el primer mensaje del hilo.`);
})();
