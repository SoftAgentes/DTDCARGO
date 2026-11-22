import { describe, expect, it } from "vitest";
import {
  leerNumero,
  mensajeErrorMedidas,
  parseCorregirResultado,
  parsePartirResultado,
  textosAvisosMedidas,
  textosBloqueosMedidas,
  validarGrupo,
} from "@/lib/studio/medidas-embarque";

describe("SDD-0673 · medidas del embarque (puro)", () => {
  it("lee la respuesta de correct_shipment_measures", () => {
    const r = parseCorregirResultado({
      outcome: "preview",
      shipment_code: "DTD-9001",
      before: {
        shipment: { cbm: 1.78, weight_kg: 300 },
        consolidation_item: { cbm: 1.78, weight_kg: 300, pieces: 5 },
        warehouse_receipt_cn: { boxes: 5, cbm: 1.78, weight_kg: 300 },
      },
      after: { shipment: { cbm: 1.8, weight_kg: 310.5 }, consolidation_item: null, warehouse_receipt_cn: null },
      blockers: {},
      warnings: { contenedor: "zarpado", cajas_nuevas_sin_etiqueta: 1 },
    });
    expect(r?.outcome).toBe("preview");
    expect(r?.before.receipt?.boxes).toBe(5);
    expect(r?.after.consolidationItem).toBeNull();
    expect(r?.warnings).toEqual({ contenedor: "zarpado", cajas_nuevas_sin_etiqueta: 1 });
  });

  it("rechaza una respuesta sin la forma esperada", () => {
    expect(parseCorregirResultado(null)).toBeNull();
    expect(parseCorregirResultado({ outcome: "otro", shipment_code: "X" })).toBeNull();
    expect(parsePartirResultado({ outcome: "split" })).toBeNull();
  });

  it("lee las dos partes de split_shipment", () => {
    const r = parsePartirResultado({
      outcome: "split",
      shipment_code: "DTD-9001",
      new_shipment_id: "00000000-0000-0000-0000-000000000001",
      new_shipment_code: "DTD-9001-B",
      parts: {
        original: { code: "DTD-9001", boxes: 3, cbm: 1.38, weight_kg: 220 },
        nueva: { code: "DTD-9001-B", boxes: 2, cbm: 0.4, weight_kg: 80, client_markbox: "SINT-1002" },
        total: { boxes: 5, cbm: 1.78, weight_kg: 300 },
        box_codes: ["DTD-B-000004", "DTD-B-000005", 7],
      },
      blockers: {},
      warnings: {},
    });
    expect((r?.parts?.original.boxes ?? 0) + (r?.parts?.nueva.boxes ?? 0)).toBe(5);
    expect(r?.parts?.nueva.clientMarkbox).toBe("SINT-1002");
    expect(r?.parts?.boxCodes).toEqual(["DTD-B-000004", "DTD-B-000005"]);
  });

  it("dice cada bloqueo en texto llano", () => {
    const t = textosBloqueosMedidas({ estado: "delivered", medidas_desalineadas: 1, caja_escaneada_ve: 2 });
    expect(t[0]).toContain("entregado");
    expect(t[1]).toContain("Corrige primero las medidas");
    expect(t[2]).toContain("2 cajas que se moverían ya se escanearon");
    expect(textosAvisosMedidas({ borrador_factura: 1, contenedor: "arribado" })).toEqual([
      "Tiene 1 factura en borrador: contabilidad la ajusta antes de emitir.",
      "El contenedor ya arribó: el cambio sale en los totales del contenedor.",
    ]);
  });

  it("nunca muestra el mensaje crudo de la base", () => {
    expect(mensajeErrorMedidas({ code: "PGRST202", message: "x" })).toBe("Esta acción todavía no está disponible.");
    expect(mensajeErrorMedidas({ code: "22023", message: "partir embarque: la parte nueva tiene que llevar menos de 5 cajas" }))
      .toBe("La parte nueva tiene que llevar menos cajas que el embarque.");
    expect(mensajeErrorMedidas({ code: "XX000", message: "relation secret" })).toBe("No pudimos guardar. Intenta de nuevo.");
  });

  it("acepta coma decimal y valida el grupo de WeChat", () => {
    expect(leerNumero("1,38")).toBe(1.38);
    expect(leerNumero("")).toBeNull();
    expect(leerNumero("abc")).toBeNull();
    expect(validarGrupo("  Grupo Yiwu  ")).toEqual({ ok: true, valor: "Grupo Yiwu" });
    expect(validarGrupo("   ")).toEqual({ ok: true, valor: null });
    expect(validarGrupo("x".repeat(121)).ok).toBe(false);
  });
});
