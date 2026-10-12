# Roadmap — Trabajo pendiente

> Estado al 12/10/2026. Los Sprints 1–5 están **en `main`** (PRs #10–#12,
> ramas S1–S3 + `feat/sprint-4-hardening` + `feat/sprint-5-quote-billing`).
> En `fix/sprint-3-hygiene` (rebaseada sobre `main`) quedó el ciclo de
> presupuestos **unificado**: quote-to-cash de S5 + estado `PAID` (pago sin
> documento), pendiente de merge — ver §4.
>
> | Rama | Contenido | Estado |
> |---|---|---|
> | `fix/sprint-1-security` | Guards globales, roles, registro→TECHNICIAN, Swagger condicional | ✅ en `main` |
> | `fix/sprint-2-data-integrity` | Decimal money, catálogo de precios, totals server-side, paginación, índices | ✅ en `main` (migración aplicada en Neon) |
> | `fix/sprint-3-hygiene` | ESLint/Prettier, `.env.example`, healthcheck, tests, CI, README, dotenv + **`PAID` unificado con quote-to-cash** | ✅ pushada, pendiente de PR |
> | `feat/sprint-4-hardening` | IGV configurable, paginación scoped, Swagger dual-route, strictNullChecks, revocación opt-in | ✅ en `main` |
> | `feat/sprint-5-quote-billing` | Convert-to-sale, máquina de estados, `recalcBilling`, e2e quote-to-cash | ✅ en `main` |
>
> Validación local tras unificar: build limpio · ESLint 0 · unit 105/105.
> e2e del flujo corre en CI (service `postgres:17`); local no: el `.env`
> apunta a Neon prod y este entorno Windows no puede spawnear backends PG.

## 1. Inmediato (cierre del trabajo ya hecho)

- [ ] **Mergear `fix/sprint-3-hygiene`** — único trabajo fuera de `main`
  (ciclo `PAID` unificado; ver §4).
- [ ] **Desplegar a Vercel** — producción corre sin S4/S5 ni `PAID`. Las
  migraciones (`0`…`3_quote_billing` + `2_add_quote_paid_status`) ya están
  aplicadas en Neon; falta publicar código.
- [ ] **Verificar CI tras el merge** — e2e quote-to-cash con `postgres:17`:
  revisar la pestaña Actions tras el push.

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
- ✅ Merged a `main` (PRs #10–#12); migraciones aplicadas en Neon.
  Pendiente: deploy Vercel. e2e del flujo corre en CI.
- Unificado con `PAID` en `fix/sprint-3-hygiene` — ver §4.

## 4. Quote-to-cash unificado — `PAID` + `INVOICED` (`fix/sprint-3-hygiene`)

> Complementa S5 sin pisarlo: S5 aporta la venta (`convert-to-sale` →
> `INVOICED`) y esto añade el pago sin documento (`PAID`) por `PATCH
> /quotes/:id/status`.

- [x] **Ciclo completo** — `PENDING → APPROVED → (PAID) → INVOICED`.
  `PAID` = pago registrado sin venta; `INVOICED` = venta generada (solo vía
  `convert-to-sale`, que ahora acepta `APPROVED` **o** `PAID`).
- [x] **Máquina de estados fusionada** — conserva todas las transiciones de
  S5 (`APPROVED→REJECTED/EXPIRED`, `REJECTED|EXPIRED→PENDING`) y agrega
  `APPROVED→PAID` + reversiones solo ADMIN (`APPROVED→PENDING`,
  `PAID→APPROVED`). `PAID` e `INVOICED` no se alcanzan por creación.
- [x] **Reflejo en la orden** — `recalcBilling` cuenta `APPROVED + PAID +
  INVOICED` (si no, pagar dejaba el total en 0) y **ambos cobros cierran la
  orden** (`COMPLETED` + `endDate`, salvo que ya esté `DELIVERED`): al
  pagar por `payQuote` y al facturar en `createFromQuote`.
- [x] **Congelados** — `PAID` e `INVOICED` no editan ni eliminan (corrigen
  revirtiendo); `APPROVED`/`EXPIRED` mantienen las libertades de S5.
- [x] **Un cobro vigente por orden** — `payQuote` rechaza pagar si otra
  cotización de la orden está `PAID` o `INVOICED` (complementa el anti
  doble-cobro `Sale.quoteId` único de S5).
- [x] **Migración `2_add_quote_paid_status`** — idempotente, **ya aplicada
  en Neon**; enum final `PENDING, APPROVED, PAID, REJECTED, EXPIRED,
  INVOICED`.
- Validación local: build · ESLint 0 · unit 105/105. e2e en CI.

## 5. Tras mergear S4–S5 (dueño del proyecto)

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
