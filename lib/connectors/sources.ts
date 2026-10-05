import { ForumSource } from "./forum";
import { findRelojesEspecialesPrice, parseRelojesEspeciales } from "./sites/relojes-especiales";

/**
 * Foros con feed RSS. Para añadir uno nuevo:
 *   npm run discover -- https://url-del-foro.com
 * detecta la plataforma, busca las secciones de compraventa, comprueba robots.txt y el RSS,
 * e imprime la entrada lista para pegar aquí.
 */
export const FORUM_SOURCES: ForumSource[] = [
  {
    name: "Relojes Especiales", country: "ES", defaultCurrency: "EUR",
    feedUrls: [
      "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-hasta-200-%E2%82%AC.190/index.rss",
      "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-entre-201%E2%82%AC-y-1000%E2%82%AC.137/index.rss",
      "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-entre-1001%E2%82%AC-y-4000%E2%82%AC.3/index.rss",
      "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-de-4001%E2%82%AC-en-adelante.189/index.rss",
    ],
    maxThreads: 20,   // por categoría
    skipItems: 1,     // el primer item del feed no es un anuncio
    priceFromThread: findRelojesEspecialesPrice, // "Precio: 1.250€" está en el primer mensaje
    parse: parseRelojesEspeciales,
  },
  {
    // Discourse. El RSS de Discourse suele estar vetado en robots.txt: se lee la categoría pública en HTML (2 páginas ≈ 60 hilos).
    // El precio va en el primer mensaje ("Precio: 90€"), que el conector lee de cada hilo nuevo (se cachea 48 h).
    name: "Hablemos de Relojes", country: "ES", defaultCurrency: "EUR", kind: "discourse",
    feedUrls: [
      "https://www.hablemosderelojes.com/c/mercado-de-relojes/12",
      "https://www.hablemosderelojes.com/c/mercado-de-relojes/12?page=1",
    ],
    maxThreads: 30,
    skipTitle: /\b(vendid[oa]s?|reservad[oa]s?|sold|cerrad[oa]s?)\b/i,   // el hilo fijado de normas ya cae solo (sin marca); "Busco…" lo descarta isWanted
  },  {
    // XenForo con add-on de mercadillo: cada fila de la lista trae país, estado (FS/SOLD...) y precio. Publicar exige 200 mensajes; leer es público.
    // Se descartan SOLD/WITHDRAWN. Precios en CHF/AUD/CAD se convierten de forma aproximada (lib/search.ts).
    name: "Omega Forums", country: "US", defaultCurrency: "USD", kind: "xenforo-market",
    feedUrls: [
      "https://omegaforums.net/forums/private-watch-sales/",
      "https://omegaforums.net/forums/private-watch-sales/page-2",
    ],
    maxThreads: 30,
  },
  {
    // XenForo noruego. Estado en la etiqueta del hilo (Selges / Selges/byttes = en venta; Solgt, Ønskes kjøpt = descartados).
    // Sin precio en la lista: se lee del primer mensaje ("Pris: 9500,-", "kr 12 500") y se asume NOK. Publicar exige registro; leer es público.
    name: "Tidssonen", country: "NO", defaultCurrency: "NOK", kind: "xenforo-market",
    feedUrls: [
      "https://www.tidssonen.no/forum/forums/marked-%E2%80%93-klokker.9/",
      "https://www.tidssonen.no/forum/forums/marked-%E2%80%93-klokker.9/page-2",
    ],
    maxThreads: 30,
  },
];
