-- 1_align_existing_database
-- 0_init se basa en una BD existente (migrate resolve --applied 0_init), por lo
-- que sus CREATE INDEX y la definicion DECIMAL nunca se ejecutan alla. Esta
-- migracion cierra esa brecha. Ambas partes son idempotentes: en una base nueva
-- ya existen y no hacen nada.
--
-- Nota: convertir double precision -> DECIMAL(10,2) redondea los valores con
-- mas de 2 decimales (p. ej. 1500.555 -> 1500.56). Si un valor excede 10
-- digitos la conversion falla y la transaccion se revierte entera.

-- ---- Dinero: double precision -> DECIMAL(10,2)

ALTER TABLE "Product" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::DECIMAL(10,2);
ALTER TABLE "Product" ALTER COLUMN "cost" TYPE DECIMAL(10,2) USING "cost"::DECIMAL(10,2);
ALTER TABLE "RepairOrder" ALTER COLUMN "initialReviewCost" TYPE DECIMAL(10,2) USING "initialReviewCost"::DECIMAL(10,2);
ALTER TABLE "RepairOrder" ALTER COLUMN "totalCost" TYPE DECIMAL(10,2) USING "totalCost"::DECIMAL(10,2);
ALTER TABLE "RepairOrderItem" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::DECIMAL(10,2);
ALTER TABLE "Quote" ALTER COLUMN "totalAmount" TYPE DECIMAL(10,2) USING "totalAmount"::DECIMAL(10,2);
ALTER TABLE "QuoteItem" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::DECIMAL(10,2);
ALTER TABLE "Sale" ALTER COLUMN "totalAmount" TYPE DECIMAL(10,2) USING "totalAmount"::DECIMAL(10,2);
ALTER TABLE "SaleItem" ALTER COLUMN "price" TYPE DECIMAL(10,2) USING "price"::DECIMAL(10,2);

-- ---- Indices de consulta
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "public"."User"("role");
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "public"."Customer"("name");
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "public"."Customer"("phone");
CREATE INDEX IF NOT EXISTS "Product_category_idx" ON "public"."Product"("category");
CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "public"."Product"("name");
CREATE INDEX IF NOT EXISTS "RepairOrder_status_idx" ON "public"."RepairOrder"("status");
CREATE INDEX IF NOT EXISTS "RepairOrder_createdAt_idx" ON "public"."RepairOrder"("createdAt");
CREATE INDEX IF NOT EXISTS "RepairOrder_customerId_idx" ON "public"."RepairOrder"("customerId");
CREATE INDEX IF NOT EXISTS "RepairOrder_technicianId_idx" ON "public"."RepairOrder"("technicianId");
CREATE INDEX IF NOT EXISTS "RepairOrderItem_repairOrderId_idx" ON "public"."RepairOrderItem"("repairOrderId");
CREATE INDEX IF NOT EXISTS "RepairOrderItem_productId_idx" ON "public"."RepairOrderItem"("productId");
CREATE INDEX IF NOT EXISTS "Quote_status_idx" ON "public"."Quote"("status");
CREATE INDEX IF NOT EXISTS "Quote_repairOrderId_idx" ON "public"."Quote"("repairOrderId");
CREATE INDEX IF NOT EXISTS "Quote_customerId_idx" ON "public"."Quote"("customerId");
CREATE INDEX IF NOT EXISTS "Quote_technicianId_idx" ON "public"."Quote"("technicianId");
CREATE INDEX IF NOT EXISTS "QuoteItem_quoteId_idx" ON "public"."QuoteItem"("quoteId");
CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "public"."Sale"("createdAt");
CREATE INDEX IF NOT EXISTS "Sale_customerId_idx" ON "public"."Sale"("customerId");
CREATE INDEX IF NOT EXISTS "Sale_userId_idx" ON "public"."Sale"("userId");
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "public"."SaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "SaleItem_productId_idx" ON "public"."SaleItem"("productId");
