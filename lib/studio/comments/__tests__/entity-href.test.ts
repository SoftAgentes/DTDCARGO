// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  COMMENT_ENTITY_TYPES,
  entityHref,
  entityTypeLabel,
} from "../types";

/**
 * entityHref alimenta DOS consumidores: la navegación de la bandeja de menciones
 * y `revalidatePath` en las server actions. Por eso debe (1) aterrizar en el
 * record cuando existe ruta de detalle, y (2) NO llevar query string (rompería
 * el revalidate). Estos tests fijan el fix del review SDD-0045.
 */
describe("entityHref", () => {
  it("shipment aterriza en tracking/[id] por id", () => {
    expect(entityHref("shipment", "uuid-1", "DTDU-1")).toBe(
      "/studio/tracking/uuid-1",
    );
  });

  it("client aterriza en clientes/[markbox] por code, lista si falta code", () => {
    expect(entityHref("client", "uuid-1", "DTD-5532")).toBe(
      "/studio/clientes/DTD-5532",
    );
    expect(entityHref("client", "uuid-1", null)).toBe("/studio/clientes");
  });

  it("invoice aterriza en facturacion/[code] (record), no en la lista", () => {
    expect(entityHref("invoice", "uuid-1", "F-2026-0418")).toBe(
      "/studio/facturacion/F-2026-0418",
    );
    expect(entityHref("invoice", "uuid-1", null)).toBe("/studio/facturacion");
  });

  it("quote usa /studio/cotizador/[code] (no el typo /studio/cotizar)", () => {
    const href = entityHref("quote", "uuid-1", "Q-2026-0188");
    expect(href).toBe("/studio/cotizador/Q-2026-0188");
    expect(href).not.toContain("/studio/cotizar?");
    expect(href.startsWith("/studio/cotizar/")).toBe(false); // /cotizar ≠ /cotizador
    expect(entityHref("quote", "uuid-1", null)).toBe("/studio/cotizador");
  });

  it("entidades sin ruta de detalle aterrizan en su lista", () => {
    expect(entityHref("dispatch_order", "uuid-1", "D-1")).toBe(
      "/studio/despacho",
    );
    expect(entityHref("supplier_bill", "uuid-1", "CXP-1")).toBe(
      "/studio/tesoreria",
    );
    expect(entityHref("warehouse_receipt_cn", "uuid-1", "WR-1")).toBe(
      "/studio/cn",
    );
    expect(entityHref("warehouse_receipt_ve", "uuid-1", "WR-1")).toBe(
      "/studio/ve",
    );
  });

  it("ningún href lleva query string (revalidatePath-safe)", () => {
    for (const t of COMMENT_ENTITY_TYPES) {
      const href = entityHref(t, "uuid-1", "CODE-1");
      expect(href).not.toContain("?");
      expect(href.startsWith("/studio/")).toBe(true);
    }
  });

  it("todos los tipos tienen label legible", () => {
    for (const t of COMMENT_ENTITY_TYPES) {
      expect(entityTypeLabel(t).length).toBeGreaterThan(0);
    }
  });
});
