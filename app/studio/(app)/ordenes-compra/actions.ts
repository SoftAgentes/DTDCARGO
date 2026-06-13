/**
 * Server actions del módulo Órdenes de compra (SDD-0071).
 *
 * Frontera "use server" del módulo: re-exporta las acciones implementadas en
 * `lib/studio/purchase-orders/actions.ts` (que ya son "use server" + parsing
 * manual + validate*Input sin Zod + revalidatePath). Las client components del
 * módulo importan desde acá (`../actions`), patrón del resto del Studio.
 *
 * NO lleva "use server" propio: los símbolos re-exportados ya son server actions
 * (definidos con "use server" en lib/studio/purchase-orders/actions.ts). Un barrel
 * `export { … } from` DENTRO de un "use server" rompe el build de Turbopack (Next 16)
 * — el `verify.mjs` no lo caza pero el deploy de Vercel falla. Sin la directiva acá
 * es un re-export normal que pasa por la frontera del lib.
 */

export {
  createPurchaseOrder,
  updatePurchaseOrder,
  setPurchaseOrderStatus,
  cancelPurchaseOrder,
  receivePurchaseOrder,
} from "@/lib/studio/purchase-orders/actions";
