// @vitest-environment node
import { describe, expect, it } from "vitest";

import { enlaceClientes, etiquetasConSegmento, respuestaPara } from "../segmento";
import { bsuidDe, interpretarConversacion } from "../webhook-events";
import { conversacionSintetica } from "./webhook-fixtures";

const NUMERO = "584125550999";

describe("segmento: etiquetas (SDD-0586)", () => {
  it("conserva las ajenas y deja una sola de segmento", () => {
    expect(etiquetasConSegmento(["vip", "lead-nuevo", "lead-registrado"], "cliente")).toEqual(["vip", "cliente"]);
    expect(etiquetasConSegmento([], "lead_nuevo")).toEqual(["lead-nuevo"]);
  });

  it("no escribe si ya está justo la del segmento", () => {
    expect(etiquetasConSegmento(["vip", "cliente"], "cliente")).toBeNull();
    expect(etiquetasConSegmento(["cliente", "cliente"], "cliente")).toEqual(["cliente"]);
  });
});

describe("segmento: respuesta del bot (SDD-0586)", () => {
  it("al cliente, la redirección; al lead con teléfono, nada", () => {
    expect(respuestaPara("cliente", false, NUMERO)?.tipo).toBe("redireccion_cliente");
    expect(respuestaPara("lead_registrado", false, NUMERO)).toBeNull();
    expect(respuestaPara("lead_nuevo", false, NUMERO)).toBeNull();
  });

  it("sin teléfono, la neutra, la misma sea cual sea el segmento", () => {
    const a = respuestaPara("lead_nuevo", true, NUMERO);
    expect(a?.tipo).toBe("neutra_sin_telefono");
    expect(respuestaPara("cliente", true, NUMERO)).toEqual(a);
    // Condicional («si ya eres cliente»): nunca afirma que lo es.
    expect(a?.texto).toContain("Si ya eres cliente");
    expect(a?.texto).not.toBe(respuestaPara("cliente", false, NUMERO)?.texto);
  });

  it("ni la redirección afirma que la persona es cliente (el cruce no mira el código de país)", () => {
    for (const r of [respuestaPara("cliente", false, NUMERO), respuestaPara("lead_nuevo", true, NUMERO)]) {
      expect(r?.texto).not.toMatch(/(como|porque) ya eres cliente/i);
    }
  });

  it("un solo mensaje con el enlace wa.me y un saludo codificado", () => {
    expect(enlaceClientes(NUMERO)).toBe(`https://wa.me/${NUMERO}?text=Hola%2C%20soy%20cliente%20de%20DTD%20Cargo`);
    for (const r of [respuestaPara("cliente", false, NUMERO), respuestaPara("lead_nuevo", true, NUMERO)]) {
      expect(r?.texto.split("https://wa.me/")).toHaveLength(2);
      expect(r?.texto).not.toContain("\n");
    }
  });
});

describe("interpretarConversacion: campos de E10 (SDD-0586)", () => {
  it("con teléfono no toma el BSUID; trae etiquetas y equipo", () => {
    const c = interpretarConversacion(
      conversacionSintetica({ labels: ["vip", 3], contact_inbox: { source_id: "VE.5550000000000000001" } }),
    );
    expect(c?.bsuid).toBeUndefined();
    expect(c?.etiquetas).toEqual(["vip"]);
    expect(c && "equipoId" in c).toBe(false);
  });

  it("sin teléfono toma el BSUID de contact_inbox; un id de solo dígitos no", () => {
    const sin = (source_id: unknown) =>
      interpretarConversacion(conversacionSintetica({ meta: { sender: {}, team: null }, contact_inbox: { source_id } }));
    expect(sin("VE.5550000000000000001")?.bsuid).toBe("VE.5550000000000000001");
    expect(sin("584125550101")?.bsuid).toBeUndefined();
    expect(sin("con espacio")?.bsuid).toBeUndefined();
    expect(sin("VE.5550000000000000001")?.equipoId).toBeNull();
  });

  it("bsuidDe exige la misma forma que la tabla de la 0505", () => {
    expect(bsuidDe(" VE.1 ")).toBe("VE.1");
    expect(bsuidDe("x".repeat(129))).toBeNull();
    expect(bsuidDe(12)).toBeNull();
  });
});
