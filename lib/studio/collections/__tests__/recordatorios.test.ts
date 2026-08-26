/**
 * SDD-0306 · A quién se le manda el recordatorio de cobranza.
 *
 * Lo que se prueba es **a quién NO** se le escribe. Un recordatorio de cobranza
 * incomoda a un cliente que paga: cada omisión existe para no mandarlo cuando
 * sería injusto o dañino, y un error acá no se ve en pantalla — se ve en la
 * bandeja de un cliente.
 */

import { describe, it, expect } from "vitest";
import {
  MOTIVO_LABEL,
  motivoDeOmision,
  intersectarPedido,
  resumirSeleccion,
  seleccionarParaRecordatorio,
  VENTANA_DIAS,
  type ContextoEnvio,
} from "../recordatorios";
import type { Receivable } from "@/lib/studio/payment-queries";

const HOY = "2026-08-26";

function mk(over: Partial<Receivable> = {}, inv: Record<string, unknown> = {}): Receivable {
  return {
    invoice: {
      invoice_code: "F-2026-0001",
      client_markbox: "DTD-1234",
      client_name: "Importadora Ejemplo",
      currency: "USD",
      ...inv,
    },
    balance: 1000,
    balanceUsd: 1000,
    daysOverdue: 10,
    stage: "vencido",
    lastActivity: null,
    promiseDate: null,
    ...over,
  } as Receivable;
}

function ctx(over: Partial<ContextoEnvio> = {}): ContextoEnvio {
  return {
    conCorreo: new Set(["DTD-1234"]),
    marcaronSpam: new Set<string>(),
    ultimoRecordatorio: new Map<string, string>(),
    ...over,
  };
}

describe("motivoDeOmision", () => {
  it("una factura vencida, con saldo y con correo SÍ recibe", () => {
    expect(motivoDeOmision(mk(), HOY, ctx())).toBeNull();
  });

  it("no se le recuerda a quien todavía no vence", () => {
    // Apurar a alguien que no debe nada.
    expect(motivoDeOmision(mk({ daysOverdue: -3 }), HOY, ctx())).toBe("no_vencida");
    expect(motivoDeOmision(mk({ daysOverdue: 0 }), HOY, ctx())).toBe("no_vencida");
    expect(motivoDeOmision(mk({ daysOverdue: null }), HOY, ctx())).toBe("no_vencida");
  });

  it("no se le recuerda una factura sin saldo", () => {
    expect(motivoDeOmision(mk({ balance: 0 }), HOY, ctx())).toBe("sin_saldo");
  });

  it("🔴 NUNCA si hay una promesa de pago vigente", () => {
    // El equipo aceptó una fecha nueva. Escribirle antes rompe el acuerdo que
    // nosotros mismos concedimos — es la regla que más protege la relación.
    expect(motivoDeOmision(mk({ promiseDate: "2026-08-30" }), HOY, ctx())).toBe(
      "promesa_vigente",
    );
    // La promesa vence el día que llega: ese día todavía se respeta.
    expect(motivoDeOmision(mk({ promiseDate: HOY }), HOY, ctx())).toBe(
      "promesa_vigente",
    );
    // Pero una promesa incumplida ya no protege.
    expect(motivoDeOmision(mk({ promiseDate: "2026-08-25" }), HOY, ctx())).toBeNull();
  });

  it("🔴 NUNCA a quien marcó el correo como spam", () => {
    // Es una decisión del destinatario. Volver a escribirle es, además de
    // grosero, la vía rápida a que el dominio deje de entregar.
    expect(
      motivoDeOmision(mk(), HOY, ctx({ marcaronSpam: new Set(["DTD-1234"]) })),
    ).toBe("marco_spam");
  });

  it("el spam gana sobre todo lo demás, incluso sobre no tener correo", () => {
    const c = ctx({ marcaronSpam: new Set(["DTD-1234"]), conCorreo: new Set() });
    expect(motivoDeOmision(mk(), HOY, c)).toBe("marco_spam");
  });

  it("no repite dentro de la ventana, y sí fuera de ella", () => {
    const reciente = ctx({
      ultimoRecordatorio: new Map([["F-2026-0001", "2026-08-24"]]),
    });
    expect(motivoDeOmision(mk(), HOY, reciente)).toBe("recordada_hace_poco");

    const viejo = ctx({
      ultimoRecordatorio: new Map([["F-2026-0001", "2026-08-10"]]),
    });
    expect(motivoDeOmision(mk(), HOY, viejo)).toBeNull();

    // El borde: exactamente la ventana ya habilita.
    const borde = ctx({
      ultimoRecordatorio: new Map([["F-2026-0001", "2026-08-19"]]),
    });
    expect(VENTANA_DIAS).toBe(7);
    expect(motivoDeOmision(mk(), HOY, borde)).toBeNull();
  });

  it("🔴 la ventana la decide la FACTURA, no el cliente", () => {
    // Dos facturas vencidas del mismo cliente son dos deudas distintas. Si la
    // ventana fuera por cliente, recordarle una silenciaría la otra.
    const c = ctx({ ultimoRecordatorio: new Map([["F-2026-0001", "2026-08-25"]]) });
    expect(motivoDeOmision(mk(), HOY, c)).toBe("recordada_hace_poco");
    const otra = mk({}, { invoice_code: "F-2026-0002" });
    expect(motivoDeOmision(otra, HOY, c)).toBeNull();
  });

  it("sin correo no hay envío", () => {
    expect(motivoDeOmision(mk(), HOY, ctx({ conCorreo: new Set() }))).toBe("sin_correo");
  });
});

describe("seleccionarParaRecordatorio", () => {
  it("parte la cola en las dos listas y conserva el motivo de cada omitido", () => {
    const cola = [
      mk({}, { invoice_code: "F-1" }),
      mk({ daysOverdue: -1 }, { invoice_code: "F-2" }),
      mk({ promiseDate: "2026-09-01" }, { invoice_code: "F-3" }),
    ];
    const s = seleccionarParaRecordatorio(cola, HOY, ctx());
    expect(s.aEnviar.map((r) => r.invoice.invoice_code)).toEqual(["F-1"]);
    expect(s.omitidos).toEqual([
      { code: "F-2", markbox: "DTD-1234", motivo: "no_vencida" },
      { code: "F-3", markbox: "DTD-1234", motivo: "promesa_vigente" },
    ]);
  });

  it("🔴 una cola entera de omitidos NO manda nada", () => {
    // El caso peligroso es el inverso: que un filtro roto deje pasar a todos.
    const cola = [mk({ balance: 0 }), mk({ daysOverdue: null })];
    expect(seleccionarParaRecordatorio(cola, HOY, ctx()).aEnviar).toEqual([]);
  });

  it("una cola vacía no explota", () => {
    const s = seleccionarParaRecordatorio([], HOY, ctx());
    expect(s.aEnviar).toEqual([]);
    expect(s.omitidos).toEqual([]);
  });
});

describe("resumirSeleccion", () => {
  it("dice a cuántos se les escribe y por qué el resto queda fuera", () => {
    const cola = [
      mk({}, { invoice_code: "F-1" }),
      mk({ balance: 0 }, { invoice_code: "F-2" }),
      mk({ balance: 0 }, { invoice_code: "F-3" }),
    ];
    const texto = resumirSeleccion(seleccionarParaRecordatorio(cola, HOY, ctx()));
    expect(texto).toContain("1 cliente");
    expect(texto).toContain("2 sin saldo pendiente");
  });

  it("sin omitidos no inventa una lista vacía", () => {
    const s = seleccionarParaRecordatorio([mk()], HOY, ctx());
    expect(resumirSeleccion(s)).toBe("Se le escribe a 1 cliente");
  });

  it("cada motivo tiene etiqueta legible, ninguna es el código crudo", () => {
    for (const [codigo, label] of Object.entries(MOTIVO_LABEL)) {
      expect(label).not.toContain("_");
      expect(label.length).toBeGreaterThan(8);
      expect(label).not.toBe(codigo);
    }
  });
});

describe("intersectarPedido · la lista del navegador sólo puede ACOTAR", () => {
  const aEnviar = [
    mk({}, { invoice_code: "F-1" }),
    mk({}, { invoice_code: "F-2" }),
  ];

  it("deja pasar lo que está en las dos listas", () => {
    expect(
      intersectarPedido(aEnviar, ["F-1"]).map((r) => r.invoice.invoice_code),
    ).toEqual(["F-1"]);
  });

  it("🔴 un código que el servidor NO seleccionó jamás se manda", () => {
    // Este es el vector: si el navegador manda "F-99" —una factura que ya pagó,
    // o de un cliente que marcó spam— confiar en su lista significaría
    // escribirle igual. Basta con editar la petición.
    expect(intersectarPedido(aEnviar, ["F-99"])).toEqual([]);
    expect(
      intersectarPedido(aEnviar, ["F-1", "F-99"]).map((r) => r.invoice.invoice_code),
    ).toEqual(["F-1"]);
  });

  it("una lista vacía no manda nada", () => {
    expect(intersectarPedido(aEnviar, [])).toEqual([]);
  });

  it("ignora basura sin reventar", () => {
    expect(intersectarPedido(aEnviar, ["", "  F-1"])).toEqual([]);
  });
});
