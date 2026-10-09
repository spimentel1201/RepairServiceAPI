import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';

/**
 * Swagger se habilita/deshabilita con ENABLE_SWAGGER=true|false.
 * Por defecto: activo fuera de producción, oculto en producción
 * (no quieres publicar el mapa completo de tu API en el entorno real).
 */
function isSwaggerEnabled(): boolean {
  const flag = String(process.env.ENABLE_SWAGGER ?? '').toLowerCase();
  if (['true', '1', 'yes'].includes(flag)) return true;
  if (['false', '0', 'no'].includes(flag)) return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Allowlist de orígenes CORS desde CORS_ORIGINS (separada por comas).
 * Ej: CORS_ORIGINS=https://app.ejemplo.com,https://admin.ejemplo.com
 *
 * Si no se configura, se refleja el origen de la petición (sin cookies),
 * que es el comportamiento anterior. La API usa Authorization header,
 * así que el CORS no es el límite de seguridad real, pero conviene
 * restringirlo en producción.
 */
function getCorsOrigin(): string[] | boolean {
  const raw = String(process.env.CORS_ORIGINS ?? '').trim();
  if (!raw) return true;
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins.length > 0 ? origins : true;
}

/**
 * Configuración compartida entre el proceso local (bootstrap)
 * y el handler serverless de Vercel (export default).
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Los errores de Prisma se traducen a 409/404/500 en lugar de un 400 generico
  app.useGlobalFilters(new PrismaExceptionFilter());

  // Cierra Prisma y el resto de los hooks al recibir SIGTERM/SIGINT
  app.enableShutdownHooks();

  app.enableCors({
    origin: getCorsOrigin(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
  });

  if (isSwaggerEnabled()) {
    const config = new DocumentBuilder()
      .setTitle('Repair Service API')
      .setDescription('API for managing repair services')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}

if (require.main === module) {
  bootstrap();
}

/**
 * Handler serverless (Vercel).
 *
 * La aplicación se crea e inicializa UNA sola vez y se reutiliza entre
 * peticiones (la instancia Lambda/lambda-warm se mantiene viva). Antes se
 * creaba una app NestJS nueva por request, lo que multipliaba la latencia.
 * Si la inicialización falla, se descarta la promesa para que el siguiente
 * request pueda reintentarlo.
 */
let appPromise: Promise<INestApplication> | null = null;

function getServerlessApp(): Promise<INestApplication> {
  if (!appPromise) {
    appPromise = NestFactory.create(AppModule)
      .then(async (app) => {
        configureApp(app);
        await app.init();
        return app;
      })
      .catch((error) => {
        appPromise = null;
        throw error;
      });
  }
  return appPromise;
}

export default async (req, res) => {
  const app = await getServerlessApp();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
};
