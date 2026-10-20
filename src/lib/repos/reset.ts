import { getDb } from "../db";
import { newId } from "../id";
import { logAudit } from "./audit";

export interface ResetScope {
  transactions?: boolean;
  expenses?: boolean;
  auditLog?: boolean;
  customers?: boolean;
  loyaltyClaims?: boolean;
  resetStock?: boolean;
}

export async function resetData(scope: ResetScope): Promise<void> {
  if (!Object.values(scope).some(Boolean)) return;

  const db = getDb();

  await db.transaction(
    "rw",
    [
      db.transactions,
      db.transactionItems,
      db.expenses,
      db.auditLog,
      db.customers,
      db.loyaltyClaims,
      db.productVariants,
      db.stockEvents,
    ],
    async () => {
      if (scope.transactions) {
        await db.transactionItems.clear();
        await db.transactions.clear();
      }
      if (scope.expenses) await db.expenses.clear();
      if (scope.auditLog) await db.auditLog.clear();
      if (scope.customers) {
        await db.customers.clear();
        await db.loyaltyClaims.clear();
      }
      if (scope.loyaltyClaims) await db.loyaltyClaims.clear();
      if (scope.resetStock) {
        const variants = await db.productVariants.toArray();
        const at = Date.now();
        for (const variant of variants) {
          await db.stockEvents.add({
            id: newId(),
            variantId: variant.id,
            type: "reset",
            value: 0,
            refId: null,
            at,
          });
          await db.productVariants.update(variant.id, { stock: 0 });
        }
      }
    },
  );

  await logAudit({ action: "reset_data", table: "app", newData: scope });
}
