/**
 * Server actions del módulo Órdenes de compra (SDD-0071).
 *
 * Frontera "use server" del módulo: re-exporta las acciones implementadas en
 * `lib/studio/purchase-orders/actions.ts` (que ya son "use server" + parsing
 * manual + validate*Input sin Zod + revalidatePath). Las client components del
 * módulo importan desde acá (`../actions`), patrón del resto del Studio.
 */

"use server";

export {
  createPurchaseOrder,
  updatePurchaseOrder,
  setPurchaseOrderStatus,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} from "@/lib/studio/purchase-orders/actions";
