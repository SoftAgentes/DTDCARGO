// @vitest-environment node
/**
 * SDD-0530 · La regla, la lectura del resultado de la RPC y el resumen del
 * zarpe/arribo. La regla se compara además con la de la base, caso por caso,
 * en lib/studio/__tests__/naviera-zarpe-avanza-envios.migration.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  AVANCE,
  MOTIVOS_SALTO,
  MOTIVO_SALTO_TEXTO,
  decidirAvance,
  esAvanceContenedor,
  leerResultadoAvance,
  lineaResumenAvance,
  mensajeErrorAvance,
  resumirAvance,
} from "../avance-por-contenedor";

const TENANT = "10000000-0000-4000-8000-000000000530";

function rpcZarpe(over: Record<string, unknown> = {}) {
  return {
    outcome: "transitioned",
    tenant_id: TENANT,
    consolidation_ref: "DTD-CONSOL-0101",
    from: "cerrado",
    to: "zarpado",
    shipment_status: "shipped",
    advanced: [
      { shipment_id: "s1", code: "ENV-1", from: "in_warehouse", client_markbox: "DTD-1", client_name: "Ana" },
      { shipment_id: "s2", code: "ENV-2", from: "draft", client_markbox: null, client_name: null },
    ],
    skipped: [
      { shipment_id: "s3", code: "ENV-3", status: "delivered", client_markbox: "DTD-3", reason: "entregado" },
    ],
    pieces_without_shipment: 2,
    ...over,
  };
}

describe("AVANCE", () => {
  it("el zarpe va de cerrado a shipped y el arribo de zarpado a in_customs", () => {
    expect(AVANCE).toEqual({
      zarpado: { desde: "cerrado", destino: "shipped" },
      arribado: { desde: "zarpado", destino: "in_customs" },
    });
    expect(esAvanceContenedor("zarpado")).toBe(true);
    expect(esAvanceContenedor("arribado")).toBe(true);
    expect(esAvanceContenedor("cerrado")).toBe(false);
    expect(esAvanceContenedor("consolidando")).toBe(false);
  });

  it("cada motivo tiene su texto, en tuteo", () => {
    for (const m of MOTIVOS_SALTO) expect(MOTIVO_SALTO_TEXTO[m].length).toBeGreaterThan(5);
    expect(MOTIVO_SALTO_TEXTO.excepcion).toBe("Está en excepción: resuélvela en Tracking");
  });
});

describe("decidirAvance", () => {
  it("un servicio que no existe no avanza", () => {
    expect(decidirAvance("consolidacion", "in_warehouse", "shipped")).toBe("servicio_sin_estado");
  });
  it("un estado que no existe no avanza", () => {
    expect(decidirAvance("consolidado_lcl", "perdido", "shipped")).toBe("estado_desconocido");
  });
  it("cancelado gana aunque el servicio no tenga el destino", () => {
    expect(decidirAvance("transporte_terrestre", "cancelled", "shipped")).toBe("cancelado");
  });
});

describe("leerResultadoAvance", () => {
  it("lee el resultado de la RPC", () => {
    expect(leerResultadoAvance(rpcZarpe())).toEqual({
      outcome: "transitioned",
      tenantId: TENANT,
      consolidationRef: "DTD-CONSOL-0101",
      to: "zarpado",
      destino: "shipped",
      avanzados: [
        { shipmentId: "s1", code: "ENV-1", from: "in_warehouse", clientMarkbox: "DTD-1", clientName: "Ana" },
        { shipmentId: "s2", code: "ENV-2", from: "draft", clientMarkbox: null, clientName: null },
      ],
      saltados: [
        { shipmentId: "s3", code: "ENV-3", status: "delivered", clientMarkbox: "DTD-3", motivo: "entregado" },
      ],
      piezasSinEnvio: 2,
    });
  });

  it("acepta already sin envíos", () => {
    const r = leerResultadoAvance(rpcZarpe({ outcome: "already", advanced: [], skipped: [], pieces_without_shipment: 0 }));
    expect(r?.outcome).toBe("already");
    expect(r?.avanzados).toEqual([]);
  });

  it.each([
    ["sin datos", null],
    ["outcome desconocido", rpcZarpe({ outcome: "ok" })],
    ["destino que no corresponde al avance", rpcZarpe({ shipment_status: "in_customs" })],
    ["avance desconocido", rpcZarpe({ to: "cerrado" })],
    ["sin tenant", rpcZarpe({ tenant_id: null })],
    ["sin lista de avanzados", rpcZarpe({ advanced: null })],
    ["un avanzado sin código", rpcZarpe({ advanced: [{ shipment_id: "s1", from: "draft" }] })],
    ["un saltado con un motivo desconocido", rpcZarpe({ skipped: [{ shipment_id: "s3", code: "ENV-3", status: "x", reason: "otro" }] })],
  ])("rechaza %s", (_nombre, data) => {
    expect(leerResultadoAvance(data)).toBeNull();
  });
});

describe("resumen", () => {
  it("resume con códigos, Shipping Mark y textos, sin nombres", () => {
    const r = resumirAvance(leerResultadoAvance(rpcZarpe())!, 1);
    expect(r).toEqual({
      outcome: "transitioned",
      to: "zarpado",
      destino: "shipped",
      destinoTexto: "Embarcado",
      consolidationRef: "DTD-CONSOL-0101",
      avanzados: [
        { code: "ENV-1", clientMarkbox: "DTD-1" },
        { code: "ENV-2", clientMarkbox: null },
      ],
      saltados: [{ code: "ENV-3", clientMarkbox: "DTD-3", motivo: "entregado", motivoTexto: "Ya está entregado" }],
      piezasSinEnvio: 2,
      avisosProgramados: 1,
    });
    expect(JSON.stringify(r)).not.toContain("Ana");
  });

  it("al arribar suma los avisos de llegada", () => {
    const res = leerResultadoAvance(
      rpcZarpe({ to: "arribado", from: "zarpado", shipment_status: "in_customs" }),
    )!;
    const r = resumirAvance(res, 0, 3);
    expect(r.avisosLlegada).toBe(3);
    expect(r.destinoTexto).toBe("En aduana");
  });

  it("la línea del toast dice cuántos avanzaron y cuántos no", () => {
    const res = leerResultadoAvance(rpcZarpe())!;
    expect(lineaResumenAvance(resumirAvance(res, 2))).toBe(
      "Contenedor zarpado · 2 envíos pasaron a Embarcado · 1 sin cambio",
    );
    const uno = leerResultadoAvance(rpcZarpe({ advanced: [rpcZarpe().advanced[0]], skipped: [] }))!;
    expect(lineaResumenAvance(resumirAvance(uno, 1))).toBe("Contenedor zarpado · 1 envío pasó a Embarcado");
    const ninguno = leerResultadoAvance(rpcZarpe({ advanced: [], skipped: [] }))!;
    expect(lineaResumenAvance(resumirAvance(ninguno, 0))).toBe("Contenedor zarpado · ningún envío cambió");
    const ya = leerResultadoAvance(rpcZarpe({ outcome: "already", advanced: [], skipped: [] }))!;
    expect(lineaResumenAvance(resumirAvance(ya, 0))).toBe(
      "El contenedor ya estaba zarpado: no se tocó ningún envío",
    );
  });
});

describe("mensajeErrorAvance", () => {
  it("traduce los códigos de la RPC", () => {
    expect(mensajeErrorAvance("42501")).toBe("No tienes permiso para cambiar el estado de este contenedor.");
    expect(mensajeErrorAvance("40001")).toMatch(/^El contenedor cambió de estado/);
    expect(mensajeErrorAvance("P0002")).toBe("El contenedor ya no está disponible.");
    expect(mensajeErrorAvance("22023")).toBe("Ese cambio de estado no se puede hacer desde aquí.");
    expect(mensajeErrorAvance("PGRST202")).toBe(
      "No se pudo cambiar el estado del contenedor. No cambió nada; vuelve a intentarlo.",
    );
  });
});
