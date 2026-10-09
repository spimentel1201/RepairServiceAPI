/**
 * Convierte un valor de dinero a `number`.
 * Acepta `number`, `string` y `Prisma.Decimal` (Prisma lo devuelve como objeto,
 * no como number, por eso se normaliza a traves de su representacion en texto).
 */
export function toAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function roundToTwoDecimals(value: unknown): number {
  return parseFloat(toAmount(value).toFixed(2));
}

export function safeRound(value?: unknown): number {
  if (value === null || value === undefined) return 0;
  return roundToTwoDecimals(value);
}
