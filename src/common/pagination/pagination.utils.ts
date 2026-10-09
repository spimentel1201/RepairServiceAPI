import { BadRequestException } from '@nestjs/common';

/**
 * Respuesta paginada de los servicios: los datos de la página actual en `data`
 * y el total de registros sin paginar en `total` (este último se expone en la
 * cabecera HTTP `X-Total-Count` para no cambiar la forma de la respuesta).
 */
export interface Paged<T> {
  data: T[];
  total: number;
}

export interface PaginationParams {
  /** Página actual, base 1 */
  page: number;
  /** Registros por página */
  limit: number;
  /** Registros a saltar (para Prisma `skip`) */
  skip: number;
  /** Registros a traer (para Prisma `take`) */
  take: number;
}

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

function toPositiveInt(
  value: string | number | undefined,
  fallback: number,
  name: string,
  max?: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new BadRequestException(`El parámetro "${name}" debe ser un entero mayor a 0`);
  }
  return max ? Math.min(n, max) : n;
}

/**
 * Normaliza los query params `page` / `limit`.
 * Valores por defecto: page=1, limit=20 (máximo permitido: 100).
 */
export function parsePagination(page?: string, limit?: string): PaginationParams {
  const p = toPositiveInt(page, 1, 'page');
  const l = toPositiveInt(limit, DEFAULT_LIMIT, 'limit', MAX_LIMIT);
  return { page: p, limit: l, skip: (p - 1) * l, take: l };
}
