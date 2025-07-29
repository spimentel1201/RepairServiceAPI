export function roundToTwoDecimals(value: number): number {
  return parseFloat(Number(value).toFixed(2));
}

export function safeRound(value?: number | null): number {
  if (value === null || value === undefined) return 0;
  return roundToTwoDecimals(value);
}