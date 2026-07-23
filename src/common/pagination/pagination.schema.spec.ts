import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, paginationSchema } from './pagination.schema';

describe('paginationSchema', () => {
  it('aplica los defaults cuando no se envía nada', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('coacciona los query params string a número', () => {
    expect(paginationSchema.parse({ page: '3', pageSize: '20' })).toEqual({
      page: 3,
      pageSize: 20,
    });
  });

  it('rechaza page < 1', () => {
    expect(() => paginationSchema.parse({ page: '0' })).toThrow();
  });

  it('rechaza pageSize por encima del máximo', () => {
    expect(() => paginationSchema.parse({ pageSize: String(MAX_PAGE_SIZE + 1) })).toThrow();
  });
});
