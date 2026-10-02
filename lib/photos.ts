/**
 * Fotos de prueba. Copia imágenes en /public/photos y regístralas aquí por "Marca-Modelo":
 *   "Rolex-Submariner": ["/photos/sub-1.jpg", "/photos/sub-2.jpg"],
 * Si un modelo no tiene fotos se muestra el dibujo de respaldo.
 * Con fuentes reales, cada connector rellenará Listing.images con las URLs del anuncio original.
 */
export const PHOTOS: Record<string, string[]> = {};
export const photosFor = (brand: string, model: string) => PHOTOS[`${brand}-${model}`] ?? [];
