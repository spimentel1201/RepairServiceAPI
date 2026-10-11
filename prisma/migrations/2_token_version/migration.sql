-- 2_token_version
-- Revocación de sesiones sin romper clientes existentes:
-- agrega User.tokenVersion con DEFAULT 0. Los tokens emitidos antes de esta
-- migración no llevan `tv` y la estrategia JWT los acepta (compat hacia atrás);
-- solo los tokens con `tv` desactualizado se rechazan.
-- Idempotente: IF NOT EXISTS no hace nada en bases ya migradas.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0;
