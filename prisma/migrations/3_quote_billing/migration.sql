-- 3_quote_billing
-- Cobro de presupuestos + sincronía orden↔cotización:
-- 1. QuoteStatus.INVOICED (documento facturado, terminal).
-- 2. Sale.quoteId (1:1 con Quote, anti doble-cobro) + Sale.repairOrderId
--    (trazabilidad orden→cobro).
-- 3. SaleItem.productId nullable + SaleItem.description: los ítems de servicio
--    (mano de obra) no son catálogo y no mueven stock.
-- Idempotente: IF NOT EXISTS + bloques DO con duplicate_object tragado.

-- ---- 1. Nuevo estado INVOICED
-- Nota: ADD VALUE no corre dentro de un bloque transaccional en PG < 12.
-- Neon usa PG 17 (permitido). Si `migrate deploy` falla aquí, aplicar esta
-- única línea con conexión directa fuera de transacción (psql) y reintentar.
ALTER TYPE "QuoteStatus" ADD VALUE IF NOT EXISTS 'INVOICED';

-- ---- 2. Columnas en Sale
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "quoteId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "repairOrderId" TEXT;

-- Unicidad anti doble-cobro (un presupuesto → máximo una venta)
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_quoteId_key" ON "Sale"("quoteId");

-- Trazabilidad por orden
CREATE INDEX IF NOT EXISTS "Sale_repairOrderId_idx" ON "Sale"("repairOrderId");

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Sale" ADD CONSTRAINT "Sale_repairOrderId_fkey"
    FOREIGN KEY ("repairOrderId") REFERENCES "RepairOrder"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---- 3. SaleItem de servicio (sin producto)
-- DROP NOT NULL sobre columna ya nullable es no-op: seguro re-ejecutar.
ALTER TABLE "SaleItem" ALTER COLUMN "productId" DROP NOT NULL;
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "description" TEXT;
