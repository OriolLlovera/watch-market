# Watch Market
    npm install && cp .env.example .env.local && npm run dev
    npm run scrape:test            # prueba los conectores activos sin arrancar Next
    npm run discover -- <url foro> # encuentra secciones de venta + RSS de un foro nuevo

## Cómo carga (rápido)
La página nunca espera al scraping: sirve al instante lo guardado en `.cache/` y cada fuente se refresca
en segundo plano y en paralelo (los anuncios aparecen según llegan). Los hilos de foro ya descargados se
recuerdan `THREAD_TTL_HOURS` horas, así que tras la primera carga solo se piden los hilos nuevos.
Las fotos pasan por `/api/img`, que las reduce a WebP una sola vez (requiere `sharp`).
Necesita un servidor Node de larga vida (`next dev` / `next start`); en serverless el refresco en segundo plano no funciona.

## Conectores (lib/connectors/)
- `forum.ts`  foros con RSS (XenForo, vBulletin, phpBB). Se configuran en `sources.ts`.
- `reddit.ts` API oficial.  `ebay.ts` API oficial (Browse API).
- `http.ts`   fetch educado: robots.txt, pausa por host, caché, sin reintentos ante 403/429.
- `parse.ts`  título -> marca/modelo/referencia/precio/divisa/condición/tamaño/estilo.
