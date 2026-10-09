# Roadmap — Trabajo pendiente

> Estado al 09/10/2026. Los Sprints 1–3 están **completados, validados y pushados**
> en sus ramas; falta integrarlos y hay un Sprint 4 planificado.
>
> | Rama | Contenido | Estado |
> |---|---|---|
> | `fix/sprint-1-security` | Guards globales, roles, registro→TECHNICIAN, Swagger condicional | ✅ pushada |
> | `fix/sprint-2-data-integrity` | Decimal money, catálogo de precios, totals server-side, paginación, índices | ✅ pushada (migración ya aplicada en Neon) |
> | `fix/sprint-3-hygiene` | ESLint/Prettier, `.env.example`, healthcheck, tests, CI, README, dotenv | ✅ pushada |
>
> Validación: smoke 46/46 · unit 55/55 · e2e 10/10 · build limpio.

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

## 2. Sprint 4 (planificado)

- [ ] **IGV configurable** — `0.18` hardcodeado en
  `sales.service.generateInvoice`; moverlo a variable de entorno (ej. `IGV_RATE`).
- [ ] **Paginación scoped** — `findByCustomer` / `findByTechnician`
  (`/quotes/customer/:id`, `/repair-orders/technician/:id`, …) devuelven listas
  sin `X-Total-Count` ni `page`/`limit`, a diferencia del resto de listados.
- [ ] **Revocación de tokens** — el JWT es stateless: un token robado vale hasta
  expirar. Evaluar blacklist (Redis/DB) o rotación de secret.
- [ ] **`strictNullChecks`** en `tsconfig` (endurece el chequeo de nulos en todo
  el proyecto; tocará ajustar código).
- [ ] **`prisma.config.ts`** — formato de configuración nuevo de Prisma 6.
- [ ] *(Opcional)* **Swagger bajo Vercel** — si en producción `https://<app>.vercel.app/api/docs`
  da 404, es un desajuste de rutas del serverless; ajustar con ruta dual.

## 3. Higiene / decisiones del dueño del proyecto

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
