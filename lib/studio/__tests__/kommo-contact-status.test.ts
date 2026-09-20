// @vitest-environment node
/**
 * SDD-0256 · Fase 5 (B4) — el estado comercial que lee el agente de IA de Kommo.
 *
 * MUTACIONES QUE VALIDAN ESTE ARCHIVO (las cuatro se corrieron y salieron rojas):
 *  1. `computeEstadoComercial` contando también las facturas en `borrador` →
 *     rojo: le diría a un cliente que debe algo que nadie le facturó.
 *  2. …contando `delivered` como carga en tránsito → rojo: el agente diría que
 *     tiene carga navegando a alguien que ya la recibió.
 *  3. …con `total > 0` en vez de redondear a centavos → rojo con el residuo de
 *     coma flotante de una factura pagada al centavo.
 *  4. `buildContactStatusPayload` devolviendo `{custom_fields_values: []}` en
 *     vez de `null` sin campos configurados → rojo: encolaría un PATCH vacío
 *     que sube el `updated_at` del contacto por nada.
 */

import { describe, it, expect } from "vitest";
import {
  buildContactStatusPayload,
  computeEstadoComercial,
  NO,
  SI,
  type EmbarqueLite,
  type FacturaLite,
} from "../kommo-contact-status";

const f = (over: Partial<FacturaLite> = {}): FacturaLite => ({
  client_markbox: "DTD-0001",
  status: "emitida",
  total_amount: 100,
  paid_amount: 0,
  ...over,
});

const e = (over: Partial<EmbarqueLite> = {}): EmbarqueLite => ({
  client_markbox: "DTD-0001",
  status: "in_transit",
  ...over,
});

describe("computeEstadoComercial · saldo", () => {
  it("una factura sin pagar deja saldo", () => {
    expect(computeEstadoComercial([f()], [])["DTD-0001"].tieneSaldo).toBe(true);
  });

  it("una factura pagada NO deja saldo", () => {
    expect(
      computeEstadoComercial([f({ paid_amount: 100 })], [])["DTD-0001"]?.tieneSaldo,
    ).toBe(false);
  });

  it("⭐ un BORRADOR no es una deuda", () => {
    // Decirle a un cliente que debe algo que nadie le facturó es peor que no
    // decirle nada — y del otro lado hay un agente automático repitiéndolo.
    expect(
      computeEstadoComercial([f({ status: "borrador" })], [])["DTD-0001"]?.tieneSaldo,
    ).toBeFalsy();
  });

  it("una ANULADA tampoco", () => {
    expect(
      computeEstadoComercial([f({ status: "anulada" })], [])["DTD-0001"]?.tieneSaldo,
    ).toBeFalsy();
  });

  it("⭐ el residuo de coma flotante NO enciende el saldo", () => {
    // 0.1 + 0.2 !== 0.3. Sin redondear a centavos, una factura pagada exacta
    // deja un balance de 1e-17 y el cliente aparece debiendo para siempre.
    const filas = [
      f({ total_amount: 0.1, paid_amount: 0 }),
      f({ total_amount: 0.2, paid_amount: 0 }),
      f({ total_amount: 0, paid_amount: 0.3 }),
    ];
    expect(computeEstadoComercial(filas, [])["DTD-0001"].tieneSaldo).toBe(false);
  });

  it("suma varias facturas del mismo cliente", () => {
    const filas = [
      f({ total_amount: 100, paid_amount: 100 }),
      f({ total_amount: 50, paid_amount: 10 }),
    ];
    expect(computeEstadoComercial(filas, [])["DTD-0001"].tieneSaldo).toBe(true);
  });

  it("un anticipo no cancela la deuda de OTRO cliente", () => {
    const filas = [
      f({ client_markbox: "DTD-0001", total_amount: 100, paid_amount: 0 }),
      f({ client_markbox: "DTD-0002", total_amount: 100, paid_amount: 200 }),
    ];
    const r = computeEstadoComercial(filas, []);
    expect(r["DTD-0001"].tieneSaldo).toBe(true);
    expect(r["DTD-0002"].tieneSaldo).toBe(false);
  });
});

describe("computeEstadoComercial · carga en tránsito", () => {
  it("un embarque navegando cuenta", () => {
    expect(computeEstadoComercial([], [e()])["DTD-0001"].tieneTransito).toBe(true);
  });

  it("⭐ lo ENTREGADO no es carga en tránsito", () => {
    expect(
      computeEstadoComercial([], [e({ status: "delivered" })])["DTD-0001"]?.tieneTransito,
    ).toBeFalsy();
  });

  it("un borrador ni un cancelado tampoco", () => {
    expect(
      computeEstadoComercial([], [e({ status: "draft" })])["DTD-0001"]?.tieneTransito,
    ).toBeFalsy();
    expect(
      computeEstadoComercial([], [e({ status: "cancelled" })])["DTD-0001"]?.tieneTransito,
    ).toBeFalsy();
  });

  it("una EXCEPCIÓN sí cuenta: la carga existe y está trabada", () => {
    // Es justo cuando más importa que el agente escale a un humano.
    expect(
      computeEstadoComercial([], [e({ status: "exception" })])["DTD-0001"].tieneTransito,
    ).toBe(true);
  });

  it("con uno entregado y otro navegando, cuenta el que navega", () => {
    const r = computeEstadoComercial([], [e({ status: "delivered" }), e()]);
    expect(r["DTD-0001"].tieneTransito).toBe(true);
  });

  it("sin markbox no se le atribuye a nadie", () => {
    expect(computeEstadoComercial([f({ client_markbox: null })], [e({ client_markbox: "" })]))
      .toEqual({});
  });
});

describe("buildContactStatusPayload", () => {
  const ESTADO = { tieneSaldo: true, tieneTransito: false };

  it("escribe Sí/No, no montos ni cantidades", () => {
    expect(buildContactStatusPayload({ saldoFieldId: 11, transitoFieldId: 22 }, ESTADO)).toEqual({
      custom_fields_values: [
        { field_id: 11, values: [{ value: SI }] },
        { field_id: 22, values: [{ value: NO }] },
      ],
    });
  });

  it("sólo viaja el campo CONFIGURADO", () => {
    const p = buildContactStatusPayload({ saldoFieldId: 11, transitoFieldId: null }, ESTADO);
    expect(p).toEqual({ custom_fields_values: [{ field_id: 11, values: [{ value: SI }] }] });
  });

  it("⭐ sin ningún campo configurado devuelve null, no un PATCH vacío", () => {
    // Un `custom_fields_values: []` Kommo lo acepta, cuenta como escritura y
    // sube el `updated_at` del contacto sin cambiar nada.
    expect(
      buildContactStatusPayload({ saldoFieldId: null, transitoFieldId: null }, ESTADO),
    ).toBeNull();
    expect(buildContactStatusPayload({ saldoFieldId: 0, transitoFieldId: -3 }, ESTADO)).toBeNull();
  });

  it("el estado 'no debe nada y no tiene carga' TAMBIÉN se escribe", () => {
    // Un campo vacío el agente no lo distingue de "todavía no lo calculamos", y
    // ahí vuelve a contestar a ciegas. El valor está en que siempre esté escrito.
    const p = buildContactStatusPayload(
      { saldoFieldId: 11, transitoFieldId: 22 },
      { tieneSaldo: false, tieneTransito: false },
    );
    expect(p).toEqual({
      custom_fields_values: [
        { field_id: 11, values: [{ value: NO }] },
        { field_id: 22, values: [{ value: NO }] },
      ],
    });
  });
});
