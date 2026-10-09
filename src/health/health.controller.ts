import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

interface HealthPayload {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  version: string;
  uptimeSeconds: number;
  dbLatencyMs: number;
  timestamp: string;
}

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly version: string;

  constructor(private readonly prisma: PrismaService) {
    this.version = HealthController.readPackageVersion();
  }

  /**
   * Sondeo de salud real: ejecuta un SELECT 1 contra la base de datos.
   * Responde 200 si todo está operativo y 503 si la BD no responde
   * (útil para monitores de uptime y para no enrutar tráfico a una
   * instancia con la base caída).
   */
  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Estado de la API y de la base de datos' })
  @ApiResponse({ status: 200, description: 'API y base de datos operativas' })
  @ApiResponse({ status: 503, description: 'Base de datos no accesible' })
  async check(): Promise<HealthPayload> {
    const startedAt = Date.now();
    let db: 'up' | 'down' = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'up';
    } catch {
      db = 'down';
    }

    const payload: HealthPayload = {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      version: this.version,
      uptimeSeconds: Math.round(process.uptime()),
      dbLatencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };

    if (db === 'down') {
      throw new ServiceUnavailableException(payload);
    }
    return payload;
  }

  private static readPackageVersion(): string {
    try {
      const pkg = JSON.parse(
        readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
      );
      return typeof pkg.version === 'string' ? pkg.version : 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
