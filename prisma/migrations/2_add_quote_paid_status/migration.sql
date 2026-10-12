-- Añade el estado PAID a los presupuestos.
-- Idempotente: se puede aplicar varias veces sin error (IF NOT EXISTS),
-- siguiendo el mismo patrón que 1_align_existing_database.
-- Nota: PostgreSQL >= 12 permite ALTER TYPE ... ADD VALUE dentro de la
-- transacción que usa `prisma migrate deploy`.
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'PAID' AFTER 'APPROVED';
