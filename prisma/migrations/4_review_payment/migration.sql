-- Agrega campos de pago de la revisión a la orden de reparación.
-- La revisión puede pagarse al registrar la orden o en otro momento.

ALTER TABLE "RepairOrder"
  ADD COLUMN "reviewPaid" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewPaymentMethod" "PaymentMethod",
  ADD COLUMN "reviewPaymentCode" TEXT,
  ADD COLUMN "reviewPaidAt" TIMESTAMP(3);

CREATE INDEX "RepairOrder_reviewPaid_idx" ON "RepairOrder" ("reviewPaid");