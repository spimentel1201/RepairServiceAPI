# Roadmap — Trabajo pendiente

> Estado al 11/10/2026. Los Sprints 1–3 están **completados, validados y pushados**
> en sus ramas; falta integrarlos. El Sprint 4 está **implementado** en
> `feat/sprint-4-hardening` (apilada sobre S3), pendiente de merge + deploy.
> El Sprint 5 (cobro de presupuestos) está **implementado** en
> `feat/sprint-5-quote-billing` (apilada sobre S4), pendiente de merge + deploy.
>
> | Rama | Contenido | Estado |
> |---|---|---|
> | `fix/sprint-1-security` | Guards globales, roles, registro→TECHNICIAN, Swagger condicional | ✅ pushada |
> | `fix/sprint-2-data-integrity` | Decimal money, catálogo de precios, totals server-side, paginación, índices | ✅ pushada (migración ya aplicada en Neon) |
> | `fix/sprint-3-hygiene` | ESLint/Prettier, `.env.example`, healthcheck, tests, CI, README, dotenv | ✅ pushada |
> | `feat/sprint-4-hardening` | IGV configurable, paginación scoped, Swagger dual-route, strictNullChecks, revocación opt-in | ✅ implementada, sin mergear |
>
> Validación S4 local: `tsc --noEmit` limpio · unit 59/59 · build limpio.
> e2e pendiente en CI (requiere Postgres; local apunta a Neon prod, no correr ahí).

## 1. Inmediato (cierre del trabajo ya hecho)

- [ ] **Crear y mergear los PRs** — nada está en `main` todavía. Las ramas van
  apiladas, así que el orden es:
  1. `fix/sprint-1-security` → `main`
  2. `fix/sprint-2-data-integrity` → `main` (tras merge del 1)
  3. `fix/sprint-3-hygiene` → `main` (tras merge del 2)
- [ ] **Desplegar el Sprint 2+ a Vercel** — producción corre código pre-Sprint-2.
  La BD ya está alineada (migración `1_align_existing_database` aplicada en Neon),
  pero el código desplegado no usa los índices, `Decimal` para dinero, guards
  globales ni paginación con `X-Total-Count`.
- [ ] **Verificar la primera corrida del CI** — el workflow
  (`.github/workflows/ci.yml`) se pushó por primera vez hoy; revisar la pestaña
  Actions y ajustar si algo falla (service de Postgres, seed, versiones de Node).

## 2. Sprint 4 (implementado en `feat/sprint-4-hardening`)

- [x] **IGV configurable** — `IGV_RATE` (defecto `0.18`) en `sales.service.getIgvRate()`; `generateInvoice` descompone con la tasa. Tests en `sales.service.spec`.
- [x] **Paginación scoped** — `findByCustomer` / `findByTechnician` / `findByRepairOrder` devuelven `Paged<T>` con `X-Total-Count` y `page`/`limit`, igual que el resto.
- [x] **Revocación de tokens (opt-in, sin romper frontend)** — `User.tokenVersion` (migración `2_token_version`, default 0); `POST /auth/logout` + `POST /users/:id/revoke-sessions` (ADMIN). Tokens viejos sin `tv` siguen válidos; `change-password` no revoca solo; `JWT_EXPIRATION` intacto.
- [x] **`strictNullChecks`** en `tsconfig` — activado y errores fijados (6 archivos: guards `??`/validación, DTOs aceptan `null` real de Prisma, arrays tipados en importador, `req.user` con 401 explícito).
- [ ] **`prisma.config.ts`** — REVERTIDO tras probar: Prisma 6.13 no acepta `datasource` en `defineConfig` (`'datasource' does not exist in type 'PrismaConfig'`) y el archivo desactiva la carga automática del `.env` ("skipping environment variable loading"). Retomar al subir a Prisma 7. Sin impacto: solo queda el warning de `package.json#prisma` deprecado.
- [x] *(Opcional)* **Swagger bajo Vercel** — alias `/docs` además de `/api/docs`; verificar en preview.

## 3. Sprint 5 — cobro de presupuestos (implementado en `feat/sprint-5-quote-billing`)

- [x] **Convert-to-sale** — `POST /quotes/:id/convert-to-sale` (ADMIN): crea la
  venta desde un `APPROVED`, marca `INVOICED`, sincroniza la orden, todo en
  transacción. Anti doble-cobro (`Sale.quoteId` único → 409).
- [x] **Máquina de estados** — transiciones validadas, `INVOICED` terminal y
  congelado (no edita/elimina), `INVOICED` solo vía cobro.
- [x] **Sincronía orden** — `recalcBilling`: `totalCost` = Σ vigentes
  (recompute, no acumula) + avance a `IN_PROGRESS`; corre en aprobar,
  actualizar, eliminar y facturar.
- [x] **Lecturas** — `billing` en `GET /repair-orders/:id`;
  `GET /sales?quoteId=` / `?repairOrderId=`.
- [x] **Migración `3_quote_billing`** — idempotente; aplicar en Neon con
  conexión directa. Nota: `ADD VALUE 'INVOICED'` requiere PG 12+ en
  transacción (Neon PG 17 OK; si falla, aplicar esa línea vía psql y reintentar).
- Pendiente rutina: merge tras S4 + `migrate deploy` + deploy Vercel. e2e del
  flujo corre en CI (4 tests nuevos).

## 4. Tras mergear S4–S5 (dueño del proyecto)

- [ ] **DB local para desarrollo** — el `.env` local apunta a **Neon producción**
  (`electrodb`); cualquier prueba local escribe en prod. Ejemplo rápido:
  ```powershell
  docker run -d --name repairdb-local -e POSTGRES_PASSWORD=repair -e POSTGRES_USER=repair -e POSTGRES_DB=repairdb -p 55434:5432 postgres:17-alpine
  # DATABASE_URL=postgresql://repair:repair@localhost:55434/repairdb
  ```
- [ ] **Rotar `JWT_SECRET`** — el actual es corto y quedó expuesto durante una
  sesión de depuración. Generar uno fuerte:
  `[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')` (64 hex).
  Nota: si un valor del `.env` empieza con `#`, dotenv lo toma como comentario;
  envolverlo en comillas dobles (ver Troubleshooting del README).
- [ ] **Backup de producción** — el `pg_dump` de 09/10/2026
  (0.06 MB) quedó en una carpeta temporal de la máquina local; moverlo a
  almacenamiento permanente.
