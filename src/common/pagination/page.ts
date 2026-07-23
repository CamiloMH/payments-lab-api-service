/** Página de resultados: los elementos más los metadatos de paginación. */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Desplazamiento SQL (`OFFSET`) correspondiente a una página 1-indexada. */
export function pageOffset(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}

/**
 * Arma una `Page<T>` calculando `totalPages` a partir de `total` y `pageSize`
 * (0 cuando no hay resultados; el front muestra el estado vacío).
 */
export function buildPage<T>(items: T[], total: number, page: number, pageSize: number): Page<T> {
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

/** Transforma los elementos de una `Page<E>` a otra forma conservando los metadatos. */
export function mapPage<E, R>(source: Page<E>, map: (item: E) => R): Page<R> {
  return { ...source, items: source.items.map(map) };
}
