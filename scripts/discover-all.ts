/**
 * Sondea todos los foros de scripts/candidates.txt y escribe las entradas listas para pegar en sources.ts.
 *   npm run discover:all                  (usa scripts/candidates.txt)
 *   npm run discover:all -- mi-lista.txt  (otra lista)
 * Define SCRAPER_UA con un contacto real antes de lanzarlo. Tarda unos minutos (1 petición/s por host).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { discoverForum, sourceEntry } from "../lib/connectors/discover";

(async () => {
  const file = path.resolve(process.argv[2] ?? path.join(__dirname, "candidates.txt"));
  const lines = (await fs.readFile(file, "utf8")).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const ready: string[] = [], summary: string[] = [];
  for (const line of lines) {
    const [name, url, country = "??", currency = "EUR"] = line.split("|").map((s) => s.trim());
    console.log(`\n=== ${name} (${url})`);
    try {
      const r = await discoverForum(new URL(url), (s) => console.log(s));
      if (r.problem) { console.log(`→ ${r.problem}`); summary.push(`✘ ${name}: ${r.problem}`); continue; }
      ready.push(sourceEntry(name, country, currency, r.feeds));
      summary.push(`✔ ${name}: ${r.feeds.length} feed(s) (${r.platform})`);
    } catch (e) { summary.push(`✘ ${name}: ${(e as Error).message}`); }
  }
  console.log(`\n\n######## RESUMEN\n${summary.join("\n")}`);
  if (ready.length) console.log(`\n######## Revisa que las secciones sean de VENTA y pega dentro de FORUM_SOURCES en lib/connectors/sources.ts:\n\n${ready.join("\n")}\n`);
})();
