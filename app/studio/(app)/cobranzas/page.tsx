/**
 * Cobranzas (SDD-0041) — cola de cuentas por cobrar (CxC) sobre las facturas
 * con saldo, con aging + KPIs + gestión de cobranza (contacto/promesa/nota).
 *
 * Server component: deriva la cola de CxC de las facturas con saldo, computa
 * KPIs, lista las cuentas de caja/banco (para el cobro) y delega la UI a
 * CobranzasClient.
 */

import { createClient } from "@/lib/db/server";
import {
  collectionKpis,
  listCashAccounts,
  receivablesQueue,
} from "@/lib/studio/payment-queries";
import { CobranzasClient } from "./_components/CobranzasClient";

export const metadata = { title: "Cobranzas" };

export default async function CobranzasPage() {
  const supabase = await createClient();

  const [queue, kpis, cashAccounts] = await Promise.all([
    receivablesQueue(supabase),
    collectionKpis(supabase),
    listCashAccounts(supabase),
  ]);

  return (
    <CobranzasClient
      receivables={queue}
      kpis={kpis}
      cashAccounts={cashAccounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
      }))}
    />
  );
}
