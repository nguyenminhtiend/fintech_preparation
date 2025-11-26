/*
  Warnings:

  - You are about to drop the column `version` on the `accounts` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ledger_entries_account_id_idx";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "version";

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");
