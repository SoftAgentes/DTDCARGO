import { describe, it, expect } from "vitest";
import {
  SERVICE_CATALOG,
  SERVICE_CATALOG_BY_ID,
  SERVICE_GROUPS,
  LEGACY_SLUG_ALIASES,
  NUCLEO_SERVICES,
  serviceIdsForShipment,
} from "../service-catalog";
import { SERVICIOS_DETALLE_BY_SLUG } from "../../servicios-detalle";

// Valores del enum `ShipmentService` (type-only en shipment-public.ts → se replican acá).
const SHIPMENT_SERVICES = [
  "consolidacion",
  "puerta_a_puerta_DDP",
  "reserva_FCL",
  "transporte_terrestre",
] as const;

const GROUP_IDS = new Set(SERVICE_GROUPS.map((g) => g.id));

describe("service-catalog · forma e integridad", () => {
  it("tiene 20 servicios", () => {
    expect(SERVICE_CATALOG).toHaveLength(20);
  });

  it("los ids son únicos", () => {
    const ids = SERVICE_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("el orden va de 1 a 20 sin huecos ni repetidos", () => {
    const ordenes = SERVICE_CATALOG.map((s) => s.orden).sort((a, b) => a - b);
    expect(ordenes).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("SERVICE_CATALOG_BY_ID indexa todas las entradas", () => {
    expect(Object.keys(SERVICE_CATALOG_BY_ID)).toHaveLength(20);
    for (const s of SERVICE_CATALOG) {
      expect(SERVICE_CATALOG_BY_ID[s.id]).toBe(s);
    }
  });

  it("cada grupo de una entrada existe en SERVICE_GROUPS", () => {
    for (const s of SERVICE_CATALOG) {
      expect(GROUP_IDS.has(s.grupo)).toBe(true);
    }
  });

  it("hay exactamente un servicio principal (puerta a puerta DDP)", () => {
    const principales = SERVICE_CATALOG.filter((s) => s.principal);
    expect(principales).toHaveLength(1);
    expect(principales[0].id).toBe("puerta-a-puerta-ddp");
  });
});

describe("service-catalog · mapeo a ShipmentService (núcleo)", () => {
  it("hay exactamente 5 servicios núcleo", () => {
    expect(NUCLEO_SERVICES).toHaveLength(5);
  });

  it("cada núcleo mapea a un ShipmentService válido", () => {
    for (const s of NUCLEO_SERVICES) {
      expect(s.shipmentService).not.toBeNull();
      expect(SHIPMENT_SERVICES).toContain(s.shipmentService);
    }
  });

  it("los add-on NO tienen ShipmentService", () => {
    for (const s of SERVICE_CATALOG.filter((x) => x.tipo === "addon")) {
      expect(s.shipmentService).toBeNull();
    }
  });

  it("los 4 valores del enum están cubiertos por algún servicio", () => {
    for (const svc of SHIPMENT_SERVICES) {
      expect(serviceIdsForShipment(svc).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("reserva_FCL es N:1 — la comparten fcl-bodega y fcl-directo", () => {
    expect(serviceIdsForShipment("reserva_FCL").sort()).toEqual([
      "fcl-bodega",
      "fcl-directo",
    ]);
  });
});

describe("service-catalog · reconciliación con lib/servicios-detalle (los 18)", () => {
  const legacySlugs = SERVICE_CATALOG.map((s) => s.legacySlug).filter(
    (x): x is string => x !== null,
  );

  it("los legacySlug no-null son únicos", () => {
    expect(new Set(legacySlugs).size).toBe(legacySlugs.length);
  });

  it("cada legacySlug existe como ficha en servicios-detalle.ts", () => {
    for (const slug of legacySlugs) {
      expect(SERVICIOS_DETALLE_BY_SLUG[slug]).toBeDefined();
    }
  });

  it("los 18 slugs de servicios-detalle quedan todos reconciliados en el catálogo", () => {
    const detalleSlugs = Object.keys(SERVICIOS_DETALLE_BY_SLUG);
    const catalogSet = new Set(legacySlugs);
    expect(detalleSlugs).toHaveLength(18);
    for (const slug of detalleSlugs) {
      expect(catalogSet.has(slug)).toBe(true);
    }
  });

  it("cursos-importacion es nuevo (sin legacySlug)", () => {
    expect(SERVICE_CATALOG_BY_ID["cursos-importacion"].legacySlug).toBeNull();
  });

  it("documentos-importacion quedó sin ficha (fusionado dentro de aduana)", () => {
    expect(SERVICE_CATALOG_BY_ID["documentos-importacion"].legacySlug).toBeNull();
  });
});

describe("service-catalog · aliases legacy fusionados (design-tokens)", () => {
  it("cada alias apunta a un id existente del catálogo", () => {
    for (const target of Object.values(LEGACY_SLUG_ALIASES)) {
      expect(SERVICE_CATALOG_BY_ID[target]).toBeDefined();
    }
  });

  it("los slugs fusionados no son legacySlug real de ninguna entrada", () => {
    const legacySlugs = new Set(
      SERVICE_CATALOG.map((s) => s.legacySlug).filter(Boolean),
    );
    for (const fused of Object.keys(LEGACY_SLUG_ALIASES)) {
      expect(legacySlugs.has(fused)).toBe(false);
    }
  });

  it("last-mile → transporte-terrestre y registro-marca-coord → registro-marca-cn", () => {
    expect(LEGACY_SLUG_ALIASES["last-mile"]).toBe("transporte-terrestre");
    expect(LEGACY_SLUG_ALIASES["registro-marca-coord"]).toBe("registro-marca-cn");
  });
});
