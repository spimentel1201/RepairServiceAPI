import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerModuleOptions } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * Convierte el valor de entorno a número positivo.
 * Las variables de entorno llegan como string, y Throttler exige numbers.
 */
function toPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            // @nestjs/throttler v5+ expresa ttl en MILISEGUNDOS.
            // 60000 = 60 segundos por ventana (antes "60" = 60ms, inútil).
            ttl: toPositiveNumber(config.get('THROTTLE_TTL'), 60_000),
            limit: toPositiveNumber(config.get('THROTTLE_LIMIT'), 10),
          },
        ],
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
