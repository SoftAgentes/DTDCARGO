/**
 * Server actions del módulo Órdenes de venta (SDD-0072).
 *
 * Frontera "use server" del módulo: re-exporta las acciones implementadas en
 * `lib/studio/sales-orders/actions.ts` (que ya son "use server" + parsing manual
 * + validate*Input sin Zod + revalidatePath). Las client components del módulo
 * importan desde acá (`../actions`), patrón del resto del Studio.
 */

"use server";

export {
  createSalesOrder,
  convertEstimateToSalesOrder,
  updateSalesOrder,
  setSalesOrderStatus,
  cancelSalesOrder,
  assignPrealertaToSalesOrder,
  unassignPrealertaFromSalesOrder,
} from "@/lib/studio/sales-orders/actions";
