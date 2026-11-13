/**
 * Cobranzas (SDD-0041 + SDD-0068) — cola de cuentas por cobrar (CxC) sobre
 * las facturas con saldo, con aging + KPIs + gestión de cobranza, más la capa
 * del mandato: pagos sin identificar (cláusula 7.3) y separación de fondos
 * third_party vs local_revenue (insumo de la rendición SDD-D).
 *
 * Server component: deriva la cola de CxC de las facturas con saldo, computa
 * KPIs, lista las cuentas de caja/banco (para el cobro), los pagos sin
 * identificar y la separación del mes en curso, y delega la UI a
 * CobranzasClient.
 */

import { createClient } from "@/lib/db/server";
import {
  collectionKpis,
  fundsSeparationSummary,
  listCashAccounts,
  listUnidentifiedReceipts,
  receivablesQueue,
} from "@/lib/studio/payment-queries";
import { todayCaracasISO } from "@/lib/studio/bitacora/dates";
import { tasasVesPorFecha } from "@/lib/studio/fx-rates";
import { CobranzasClient } from "./_components/CobranzasClient";

export const metadata = { title: "Cobranzas" };

export default async function CobranzasPage() {
  const supabase = await createClient();

  // SDD-0558: «hoy» es la fecha de Caracas, la misma de `client_outstanding`
  // (0492). Decide qué está vencido en la cola y en los KPI, y el período de la
  // card de separación: el mes en curso (1 → hoy), también en Caracas.
  const today = todayCaracasISO();
  const monthStart = `${today.slice(0, 7)}-01`;

  const [queue, kpis, cashAccounts, unidentified, separation] =
    await Promise.all([
      receivablesQueue(supabase, today),
      collectionKpis(supabase, today),
      listCashAccounts(supabase),
      listUnidentifiedReceipts(supabase),
      fundsSeparationSummary(supabase, { from: monthStart, to: today }),
    ]);

  // SDD-0629 · la tasa de bolívares de hoy (Caracas), solo para la vista del
  // equivalente en Bs del saldo abierto. El tenant es el de la cola, que la RLS
  // ya acotó al del usuario; sin casos abiertos no hay vista ni lectura. Sin
  // tasa, null: «tasa no disponible».
  const tenantId = queue[0]?.invoice.tenant_id;
  const tasas = tenantId
    ? await tasasVesPorFecha(supabase, tenantId, [today])
    : new Map();

  return (
    <CobranzasClient
      receivables={queue}
      kpis={kpis}
      cashAccounts={cashAccounts.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
      }))}
      unidentified={unidentified}
      separation={separation}
      hoy={today}
      tasaHoy={tasas.get(today) ?? null}
    />
  );
}
