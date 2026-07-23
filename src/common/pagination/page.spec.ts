import { buildPage, mapPage, pageOffset } from './page';

describe('pagination/page', () => {
  describe('pageOffset', () => {
    it('convierte una página 1-indexada en su OFFSET', () => {
      expect(pageOffset(1, 12)).toBe(0);
      expect(pageOffset(3, 10)).toBe(20);
    });
  });

  describe('buildPage', () => {
    it('calcula totalPages con ceil(total / pageSize)', () => {
      expect(buildPage([1, 2], 25, 2, 12)).toEqual({
        items: [1, 2],
        total: 25,
        page: 2,
        pageSize: 12,
        totalPages: 3,
      });
    });

    it('totalPages es 0 cuando no hay resultados', () => {
      expect(buildPage([], 0, 1, 12).totalPages).toBe(0);
    });
  });

  describe('mapPage', () => {
    it('transforma los items conservando los metadatos', () => {
      const source = buildPage([1, 2, 3], 3, 1, 12);

      const mapped = mapPage(source, (n) => n * 2);

      expect(mapped.items).toEqual([2, 4, 6]);
      expect(mapped).toMatchObject({ total: 3, page: 1, pageSize: 12, totalPages: 1 });
    });
  });
});
