import { BadRequestException } from '@nestjs/common';
import { DEFAULT_LIMIT, MAX_LIMIT, parsePagination } from './pagination.utils';

describe('parsePagination', () => {
  it('usa page=1 y limit=20 por defecto', () => {
    expect(parsePagination()).toEqual({
      page: 1,
      limit: DEFAULT_LIMIT,
      skip: 0,
      take: DEFAULT_LIMIT,
    });
    expect(DEFAULT_LIMIT).toBe(20);
    expect(MAX_LIMIT).toBe(100);
  });

  it('interpreta page/limit y calcula skip/take', () => {
    expect(parsePagination('3', '50')).toEqual({
      page: 3,
      limit: 50,
      skip: 100,
      take: 50,
    });
  });

  it('trata cadenas vacias como ausentes', () => {
    expect(parsePagination('', '')).toEqual({
      page: 1,
      limit: DEFAULT_LIMIT,
      skip: 0,
      take: DEFAULT_LIMIT,
    });
  });

  it('limita limit a MAX_LIMIT', () => {
    expect(parsePagination('1', '500').limit).toBe(MAX_LIMIT);
  });

  it.each(['0', '-1', 'abc', '1.5'])('rechaza limit invalido: %s', (value) => {
    expect(() => parsePagination('1', value)).toThrow(BadRequestException);
  });

  it.each(['0', '-2', 'x'])('rechaza page invalido: %s', (value) => {
    expect(() => parsePagination(value, '10')).toThrow(BadRequestException);
  });
});
