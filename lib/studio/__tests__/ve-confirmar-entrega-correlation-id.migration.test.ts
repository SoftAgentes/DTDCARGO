// @vitest-environment node
/**
 * SDD-0534 · 0487: confirmar a mano una entrega en Almacén VE (complete_ve_delivery_governed,
 * 0321) con el correlation_id dentro de los 128 caracteres del writer AUD-01.
 * Control rojo, mutantes, deriva y texto: ver ./r3-correlation-contract.ts.
 */
import { describeCorrelationMigration } from "./r3-correlation-contract";

describeCorrelationMigration({
  n: "0487",
  src: "0321",
  file: "0487_ve_confirmar_entrega_correlation_id",
  srcFile: "0321_warehouse_ve_delivery_governance.sql",
  name: "complete_ve_delivery_governed",
  sig: "uuid,text,text,text",
  prefix: "warehouse-ve-delivery",
  idParam: "p_shipment_id",
  screenFile: "app/studio/(app)/ve/_components/VeRowActions.tsx",
  screenTemplate: "`warehouse-ve-delivery:${shipmentId}:${crypto.randomUUID()}`",
});
