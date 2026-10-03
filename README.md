# Watch Market
    npm install && cp .env.example .env.local && npm run dev
    npm run scrape:test            # prueba los conectores activos sin arrancar Next
    npm run discover -- <url foro> # encuentra secciones de venta + RSS de un foro nuevo
    npm run discover:all           # lo mismo para todos los foros de scripts/candidates.txt

## Cómo carga (rápido)
La página nunca espera al scraping: sirve al instante lo guardado en `.cache/` y cada fuente se refresca
en segundo plano y en paralelo (los anuncios aparecen según llegan). Los hilos de foro ya descargados se
recuerdan `THREAD_TTL_HOURS` horas, así que tras la primera carga solo se piden los hilos nuevos.
Las fotos pasan por `/api/img`, que las reduce a WebP una sola vez (requiere `sharp`).
En local (`next dev` / `next start`) funciona así tal cual. En serverless (Netlify) NO se scrapea desde la web: ver "Despliegue en Netlify".

## Conectores (lib/connectors/)
- `forum.ts`  foros con RSS (XenForo, vBulletin, phpBB). Se configuran en `sources.ts`.
- `reddit.ts` API oficial.  `ebay.ts` API oficial (Browse API).
- `http.ts`   fetch educado: robots.txt, pausa por host, caché, sin reintentos ante 403/429.
- `parse.ts`  título -> marca/modelo/referencia/precio/divisa/condición/tamaño/estilo.

## Despliegue en Netlify
La web solo **lee** de Netlify Blobs; el scraping lo hace `npm run scrape` (GitHub Actions, `.github/workflows/scrape.yml`, cada 30 min).
1. `npm install` y commitea `package-lock.json` (se añadió `@netlify/blobs`).
2. En GitHub: Settings > Secrets and variables > Actions > añade `NETLIFY_SITE_ID` y `NETLIFY_AUTH_TOKEN`
   (opcionales: `SCRAPER_UA`, `REDDIT_*`, `EBAY_*`).
3. Pestaña Actions > scrape > Run workflow (primera carga de datos). Tarda unos minutos.
4. En Netlify, define `SCRAPER_UA` (lo usa `/api/img` al reducir fotos).

## Añadir más foros (sin API)
1. `export SCRAPER_UA="WatchMarketBot/0.1 (+tu@email.com)"` y `npm run discover:all` (edita antes `scripts/candidates.txt`).
2. Pega en `FORUM_SOURCES` (`lib/connectors/sources.ts`) las entradas que imprime, **revisando que las secciones sean de venta**.
3. Commit + push: el siguiente `scrape` en GitHub Actions ya las incluye. Ajusta `maxThreads` si tarda demasiado.
Límites: solo foros con RSS público y robots.txt que lo permita (no se salta login, CAPTCHA ni bloqueos);
solo divisas EUR/USD/GBP (SEK, CHF, etc. no están soportadas); muchos foros exigen N mensajes para *vender*, pero leer suele ser público.
