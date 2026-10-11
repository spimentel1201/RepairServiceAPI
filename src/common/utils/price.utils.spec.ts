import { roundToTwoDecimals, safeRound, toAmount } from './price.utils';

describe('toAmount', () => {
  it('devuelve 0 para null, undefined o cadena vacia', () => {
    expect(toAmount(null)).toBe(0);
    expect(toAmount(undefined)).toBe(0);
    expect(toAmount('')).toBe(0);
  });

  it('pasa through los numeros', () => {
    expect(toAmount(15.5)).toBe(15.5);
  });

  it('convierte strings numericos', () => {
    expect(toAmount('1500.55')).toBe(1500.55);
  });

  it('normaliza objetos Decimal (via su representacion en texto)', () => {
    const decimalLike = { toString: () => '99.90' };
    expect(toAmount(decimalLike)).toBe(99.9);
  });

  it('devuelve 0 para valores no numericos', () => {
    expect(toAmount('abc')).toBe(0);
    expect(toAmount(Infinity)).toBe(0);
  });
});

describe('roundToTwoDecimals', () => {
  it('redondea a dos decimales', () => {
    expect(roundToTwoDecimals(10.129)).toBe(10.13);
    expect(roundToTwoDecimals(40)).toBe(40);
  });

  it('corrige el error clasico de suma de flotantes', () => {
    expect(roundToTwoDecimals(0.1 + 0.2)).toBe(0.3);
  });
});

describe('safeRound', () => {
  it('devuelve 0 para null/undefined', () => {
    expect(safeRound(null)).toBe(0);
    expect(safeRound(undefined)).toBe(0);
  });

  it('redondea el resto de valores', () => {
    expect(safeRound('7.777')).toBe(7.78);
  });
});
