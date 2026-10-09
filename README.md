# RepairServiceAPI

API REST para la gestión de un taller de reparaciones: productos con control de stock,
clientes, órdenes de reparación, cotizaciones y ventas con facturación.

**Stack:** NestJS 11 · Prisma 6 · PostgreSQL · JWT · Swagger · Vercel

## Características

- **Autenticación JWT** con roles `ADMIN` / `TECHNICIAN`. Todas las rutas exigen token
  salvo `/`, `/health`, `/auth/login` y `/auth/register`. El registro siempre crea
  usuarios `TECHNICIAN`; el `ADMIN` se crea únicamente con `npm run seed`.
- **Dinero consistente:** columnas `DECIMAL(10,2)`, totales calculados por el servidor
  y precios de venta tomados **siempre del catálogo** (el precio que envíe el cliente se ignora).
- **Stock atómico:** la reserva ocurre dentro de la transacción con update condicional;
  dos ventas simultáneas nunca pueden dejar el stock negativo.
- **Paginación** `?page&limit` (20 por defecto, máx. 100) con cabecera `X-Total-Count`.
- Rate limiting global, validación estricta de payloads, errores de Prisma mapeados a
  HTTP (P2002→409, P2003→409, P2025→404) y healthcheck real.

## Requisitos

- Node.js **>=20 <25** (ver [Troubleshooting](#troubleshooting))
- PostgreSQL 14+ (o Neon / Supabase / Vercel Postgres)

## Puesta en marcha local

```bash
npm ci
cp .env.example .env        # en Windows: copy .env.example .env
# edita .env y completa DATABASE_URL y JWT_SECRET
npx prisma migrate deploy
npm run seed                # crea el usuario ADMIN (requiere ADMIN_EMAIL y ADMIN_PASSWORD en .env)
npm run start:dev
```

Documentación Swagger: `http://localhost:3000/api/docs`

## Variables de entorno

Las obligatorias son `DATABASE_URL` y `JWT_SECRET`; la API valida ambas al arrancar
y falla con un mensaje claro si faltan. Referencia completa y comentada en [`.env.example`](.env.example).

| Variable | Obligatoria | Descripción | Por defecto |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Conexión a PostgreSQL (con `sslmode=require` en la nube) | — |
| `JWT_SECRET` | ✅ | Secreto de firma del JWT | — |
| `JWT_EXPIRATION` | | Duración del token | `1d` |
| `PORT` | | Puerto HTTP (proceso local) | `3000` |
| `NODE_ENV` | | `production` silencia los logs de queries de Prisma | — |
| `REGISTRATION_ENABLED` | | Habilita `POST /auth/register` | `true` |
| `CORS_ORIGINS` | | Allowlist CORS separada por comas | refleja el origen |
| `ENABLE_SWAGGER` | | Muestra `/api/docs` | activo fuera de producción |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seed | Credenciales del admin creado por `npm run seed` | — |
| `ADMIN_FIRST_NAME` / `ADMIN_LAST_NAME` / `ADMIN_PHONE` | seed | Datos del admin | defaults |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | | Ventana y máximo de peticiones globales | `60000` / `10` |

## Endpoints principales

| Método y ruta | Descripción | Roles |
|---|---|---|
| `GET /health` | Estado de la API y de la BD (`SELECT 1`) | público |
| `POST /auth/login` · `POST /auth/register` | Login y registro | público |
| `GET /auth/profile` · `POST /auth/refresh` | Perfil y renovación de token | cualquiera |
| `GET/POST /products` · `GET /products/search` · `GET /products/categories` | Catálogo (crear: ADMIN) | ADMIN/TECH |
| `PATCH /products/:id` · `PATCH /products/:id/stock` · `DELETE /products/:id` · `POST /products/import` | Gestión e importación CSV/Excel | ADMIN |
| `GET/POST /customers` · `GET /customers/search` · `GET /customers/:id/history` | Clientes e historial | ADMIN/TECH |
| `DELETE /customers/:id` | Eliminar (bloqueado si tiene relaciones) | ADMIN |
| `GET/POST /repair-orders` · `GET /repair-orders/customer/:id` · `GET /repair-orders/technician/:id` | Órdenes de reparación | ADMIN/TECH |
| `PATCH /repair-orders/:id/status` · `DELETE /repair-orders/:id` | Estados y borrado | ADMIN |
| `GET/POST /quotes` · `GET /quotes/repair-order/:id` · `GET /quotes/customer/:id` | Cotizaciones (crear: ADMIN) | ADMIN/TECH |
| `PATCH /quotes/:id/status` · `POST /quotes/:id/send-email` · `GET /quotes/:id/whatsapp-link` | Flujo comercial | ADMIN |
| `GET/POST /sales` · `GET /sales/:id` · `GET /sales/:id/invoice` | Ventas e factura (IGV 18%) | ADMIN/TECH |
| `PATCH /sales/:id` · `DELETE /sales/:id` | Gestión de ventas | ADMIN |
| `GET/POST /users` · `PATCH/DELETE /users/:id` · `POST /users/:id/change-password` | Usuarios | ADMIN |

Todos los listados aceptan `?page&limit` y responden con la cabecera `X-Total-Count`.

## Tests

```bash
npm test          # unitarios (Jest, sin base de datos)
npm run test:e2e  # integración (requiere DATABASE_URL con las migraciones aplicadas)
npm run lint      # ESLint
npm run format    # Prettier
```

El CI (`.github/workflows/ci.yml`) ejecuta lint + build + unitarios en Node 20 y 22,
y los e2e contra un servicio `postgres:17`.

## Despliegue (Vercel)

- `api/index.js` re-exporta `dist/main` como función serverless; `vercel-build`
  compila el proyecto en cada despliegue.
- `dist/` **no se versiona** (ya se genera en el build).
- Las variables de entorno se configuran en el dashboard de Vercel, nunca en el repo
  (`.env` está en `.gitignore`).

## Operación de la base de datos

### ⚠️ Migraciones en Neon (o cualquier pgbouncer)

**Las migraciones deben ejecutarse con la conexión directa**, quitando `-pooler.` del
host de `DATABASE_URL`. Los advisory locks de Prisma Migrate no funcionan a través del
pooler en modo transacción: dejan locks huérfanos y el deploy falla con `P1002`.
La aplicación en runtime sí debe usar el pooler (como está en `.env`).

```bash
# ejemplo: en .env el host es ep-xxx-pooler.us-east-2.aws.neon.tech...
# para migrar, se usa ep-xxx.us-east-2.aws.neon.tech (sin -pooler)
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require" \
  npx prisma migrate deploy
```

### Base de datos existente (creada antes del baseline)

Si la BD de producción se creó con `prisma db push` y no tiene `_prisma_migrations`:

1. `npx prisma migrate resolve --applied 0_init` — marca el esquema actual como baseline.
2. `npx prisma migrate deploy` — aplica `1_align_existing_database` (21 índices +
   conversión de dinero a `DECIMAL(10,2)`; es idempotente).
3. `npx prisma migrate status` — debe decir que el esquema está al día.

Si la BD tiene migraciones antiguas registradas que ya no existen en el repo, bórralas
de `_prisma_migrations` antes del paso 1 (el SQL está documentado en la cabecera de
`prisma/migrations/0_init/migration.sql`).

## Comandos útiles

| Comando | Descripción |
|---|---|
| `npm run build` | Compila `dist/` y genera el cliente Prisma |
| `npm run start:dev` | Desarrollo con recarga automática |
| `npm run seed` | Crea el usuario ADMIN (upsert) |
| `npm run test:cov` | Cobertura de tests unitarios |

## Troubleshooting

- **Node 25 no está soportado** (`engines: ">=20 <25"`): `buffer-equal-constant-time`
  (dependencia de `jsonwebtoken`) crashea. Usa Node 20 o 22 LTS.
- **`prisma generate` falla con `EPERM`:** el proceso de la API está corriendo y bloquea
  los binarios de Prisma; detén el servidor.
- **Faltan variables de entorno:** la API valida `DATABASE_URL` y `JWT_SECRET` al
  arrancar y aborta con un mensaje claro (copia `.env.example` a `.env`).
