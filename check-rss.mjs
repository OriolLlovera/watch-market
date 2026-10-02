const feeds = [
  {
    name: "Hasta 200 €",
    url: "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-hasta-200-%E2%82%AC.190/index.rss",
  },
  {
    name: "201–1000 €",
    url: "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-entre-201%E2%82%AC-y-1000%E2%82%AC.137/index.rss",
  },
  {
    name: "1001–4000 €",
    url: "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-entre-1001%E2%82%AC-y-4000%E2%82%AC.3/index.rss",
  },
  {
    name: "Más de 4000 €",
    url: "https://relojes-especiales.com/foros/foro-compraventa-relojes-fcvr-de-4001%E2%82%AC-en-adelante.189/index.rss",
  },
];

for (const feed of feeds) {
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "WatchMarketBot/0.1",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });

    const text = await response.text();

    const items = [...text.matchAll(/<item[\s>]/gi)].length;

    console.log(`\n${feed.name}`);
    console.log(`HTTP: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get("content-type")}`);
    console.log(`Tamaño RSS: ${text.length} caracteres`);
    console.log(`<item>: ${items}`);

    if (items > 0) {
      const titles = [
        ...text.matchAll(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi),
      ]
        .slice(0, 5)
        .map((m) => m[1].replace(/<[^>]+>/g, "").trim());

      console.log("Primeros títulos:");
      titles.forEach((title) => console.log(`  - ${title}`));
    }
  } catch (error) {
    console.error(`\n${feed.name}: ERROR`);
    console.error(error);
  }
}