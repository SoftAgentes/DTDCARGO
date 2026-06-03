/**
 * Tesorería (SDD-0044) — el espejo de Cobranzas, lado del PAGO.
 *
 * Server component: deriva la cola de CxP de las supplier_bills con saldo,
 * computa KPIs, lista los pagos + proveedores + cuentas (gasto / caja), y
 * delega la UI a TesoreriaClient (KPI strip + 3 tabs: CxP / Pagos / Proveedores).
 */

import { createClient } from "@/lib/db/server";
import {
  listPayments,
  listCashAccounts,
  listExpenseAccounts,
  payablesQueue,
  treasuryKpis,
} from "@/lib/studio/treasury/bill-queries";
import { listSuppliers } from "@/lib/studio/treasury/supplier-queries";
import { TesoreriaClient } from "./_components/TesoreriaClient";

export const metadata = { title: "Tesorería" };

export default async function TesoreriaPage() {
  const supabase = await createClient();

  const [queue, kpis, payments, suppliers, expenseAccounts, cashAccounts] =
    await Promise.all([
      payablesQueue(supabase),
      treasuryKpis(supabase),
      listPayments(supabase),
      listSuppliers(supabase),
      listExpenseAccounts(supabase),
      listCashAccounts(supabase),
    ]);

  return (
    <TesoreriaClient
      payables={queue}
      kpis={kpis}
      payments={payments}
      suppliers={suppliers}
      expenseAccounts={expenseAccounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
      }))}
      cashAccounts={cashAccounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
      }))}
    />
  );
}
