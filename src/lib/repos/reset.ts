import { getDb } from "../db";
import { logAudit } from "./audit";

export interface ResetScope {
  transactions?: boolean;
  expenses?: boolean;
  auditLog?: boolean;
  customers?: boolean;
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
      db.productVariants,
    ],
    async () => {
      if (scope.transactions) {
        await db.transactionItems.clear();
        await db.transactions.clear();
      }
      if (scope.expenses) await db.expenses.clear();
      if (scope.auditLog) await db.auditLog.clear();
      if (scope.customers) await db.customers.clear();
      if (scope.resetStock) {
        await db.productVariants.toCollection().modify({ stock: 0 });
      }
    },
  );

  await logAudit({ action: "reset_data", table: "app", newData: scope });
}
