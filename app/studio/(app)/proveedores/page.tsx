/**
 * /studio/proveedores — vista de operador de Proveedores + Prealertas
 * (SDD-0057, Slice C · SOLO LECTURA).
 *
 * Server component: fetcha (sin markbox = todo el tenant, RLS filtra) los stats
 * de prealertas por estado, la cola de prealertas y los proveedores; calcula el
 * # de compras vivas por proveedor en memoria y delega la UI a ProveedoresClient.
 *
 * Reusa los queries puros de lib/studio/prealertas (Slice A). Cero writes.
 */

import { createClient } from "@/lib/db/server";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import {
  cbmByPrealerta,
  listPrealertas,
  listSuppliers,
  prealertaStats,
} from "@/lib/studio/prealertas/queries";
import {
  ProveedoresClient,
  type SupplierRow,
} from "./_components/ProveedoresClient";

export const metadata = { title: "PreAlertas de servicios" };

export default async function ProveedoresPage() {
  await requireModuleView("suppliers");

  const supabase = await createClient();

  // Operador = todo el tenant (sin markbox). RLS de 0105 le da read del tenant.
  // cbmByPrealerta: CBM real medido al recibir en CN (migr 0127) — la columna
  // CBM de la cola lo muestra cuando existe.
  const [stats, prealertas, suppliers, cbmByPrealertaId] = await Promise.all([
    prealertaStats(supabase),
    listPrealertas(supabase),
    listSuppliers(supabase),
    cbmByPrealerta(supabase),
  ]);

  // # de compras vivas por proveedor (las prealertas ya vienen sin borradas).
  const orderCountBySupplierId: Record<string, number> = {};
  for (const p of prealertas) {
    if (p.supplier_id) {
      orderCountBySupplierId[p.supplier_id] =
        (orderCountBySupplierId[p.supplier_id] ?? 0) + 1;
    }
  }

  const supplierRows: SupplierRow[] = suppliers.map((s) => ({
    id: s.id,
    client_markbox: s.client_markbox,
    supplier_seq: s.supplier_seq,
    name: s.name,
    city: s.city,
    wechat: s.wechat,
    contact: s.contact,
    orderCount: orderCountBySupplierId[s.id] ?? 0,
  }));

  return (
    <ProveedoresClient
      stats={stats}
      prealertas={prealertas}
      suppliers={supplierRows}
      cbmByPrealertaId={cbmByPrealertaId}
    />
  );
}
