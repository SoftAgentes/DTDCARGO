// @vitest-environment node
/**
 * SDD-0256 · Fase 5 (B4) — el estado comercial que lee el agente de IA de Kommo.
 *
 * SDD-0558: «Tiene saldo pendiente» ya no se calcula en TypeScript. Sale de las
 * filas de `client_outstanding` (0492), así que estos casos ahora reciben
 * filas por cliente y moneda. Los casos que probaban la REGLA del saldo se
 * movieron al contrato SQL de la 0492, que es donde vive la regla:
 *  - «un BORRADOR no es una deuda» → aserción «un borrador no es deuda»;
 *  - «una ANULADA tampoco» → aserción «una anulada no es deuda»;
 *  - «un anticipo no cancela la deuda de OTRO cliente» → «un sobrepago no
 *    compensa otra factura» (más estricta: tampoco la de OTRA factura del
 *    mismo cliente);
 *  - «suma varias facturas del mismo cliente» → la suma completa de c1.
 * El del residuo de coma flotante se RETIRA: el cálculo pasa a numeric(14,2)
 * en la base y ese defecto ya no existe.
 *
 * MUTACIONES QUE VALIDAN ESTE ARCHIVO:
 *  1. contar `delivered` como carga en tránsito → rojo;
 *  2. atribuir el tránsito solo por el código vigente → rojo con el embarque
 *     bajo un código fusionado o retirado;
 *  3. `tieneSaldo` con la fila semilla o con abierto 0 → rojo;
 *  4. `buildContactStatusPayload` devolviendo `{custom_fields_values: []}` sin
 *     campos configurados → rojo;
 *  5. `soloLecturaKommo` neutralizando toda RPC (el dryAdmin viejo) → rojo.
 */

import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildContactStatusPayload,
  computeEstadoComercial,
  NO,
  SI,
  soloLecturaKommo,
  type EmbarqueLite,
} from "../kommo-contact-status";
import type { ClientOutstandingRow } from "../client-account";

const f = (over: Partial<ClientOutstandingRow> = {}): ClientOutstandingRow => ({
  client_id: "c1",
  markboxes: ["DTD-0001"],
  currency: "USD",
  open_amount: 100,
  overdue_amount: 0,
  open_invoices: 1,
  overdue_invoices: 0,
  oldest_overdue_due_date: null,
  last_payment_on: null,
  as_of: "2026-10-19",
  ...over,
});

const e = (over: Partial<EmbarqueLite> = {}): EmbarqueLite => ({
  client_markbox: "DTD-0001",
  status: "in_transit",
  ...over,
});

describe("computeEstadoComercial · saldo (filas de la 0492)", () => {
  it("una moneda con algo abierto deja saldo", () => {
    expect(computeEstadoComercial([f()], [])["c1"].tieneSaldo).toBe(true);
  });

  it("abierto 0 NO deja saldo", () => {
    expect(computeEstadoComercial([f({ open_amount: 0 })], [])["c1"].tieneSaldo).toBe(false);
  });

  it("algo abierto en VES es saldo aunque USD esté al día", () => {
    const r = computeEstadoComercial(
      [f({ open_amount: 0 }), f({ currency: "VES", open_amount: 900 })],
      [],
    );
    expect(r["c1"].tieneSaldo).toBe(true);
  });

  it("la fila semilla de un cliente sin facturas no es saldo", () => {
    expect(
      computeEstadoComercial([f({ currency: null, open_amount: 0 })], [])["c1"].tieneSaldo,
    ).toBe(false);
  });

  it("el saldo de un cliente no se le atribuye a otro", () => {
    const r = computeEstadoComercial(
      [f({ client_id: "c1" }), f({ client_id: "c2", markboxes: ["DTD-0002"], open_amount: 0 })],
      [],
    );
    expect(r["c1"].tieneSaldo).toBe(true);
    expect(r["c2"].tieneSaldo).toBe(false);
  });
});

describe("computeEstadoComercial · carga en tránsito", () => {
  it("un embarque navegando cuenta", () => {
    expect(computeEstadoComercial([f()], [e()])["c1"].tieneTransito).toBe(true);
  });

  it("⭐ lo ENTREGADO no es carga en tránsito", () => {
    expect(computeEstadoComercial([f()], [e({ status: "delivered" })])["c1"].tieneTransito).toBe(false);
  });

  it("un borrador ni un cancelado tampoco", () => {
    expect(computeEstadoComercial([f()], [e({ status: "draft" })])["c1"].tieneTransito).toBe(false);
    expect(computeEstadoComercial([f()], [e({ status: "cancelled" })])["c1"].tieneTransito).toBe(false);
  });

  it("una EXCEPCIÓN sí cuenta: la carga existe y está trabada", () => {
    expect(computeEstadoComercial([f()], [e({ status: "exception" })])["c1"].tieneTransito).toBe(true);
  });

  it("con uno entregado y otro navegando, cuenta el que navega", () => {
    const r = computeEstadoComercial([f()], [e({ status: "delivered" }), e()]);
    expect(r["c1"].tieneTransito).toBe(true);
  });

  it("⭐ un embarque bajo un código fusionado o retirado es carga del cliente superviviente", () => {
    const filas = [f({ markboxes: ["DTD-0001", "DTD-0002", "DTD-0100"] })];
    expect(computeEstadoComercial(filas, [e({ client_markbox: "DTD-0002" })])["c1"].tieneTransito).toBe(true);
    expect(computeEstadoComercial(filas, [e({ client_markbox: " dtd-0100 " })])["c1"].tieneTransito).toBe(true);
  });

  it("sin markbox, o con un código que no es de nadie, no se le atribuye a nadie", () => {
    const r = computeEstadoComercial(
      [f({ open_amount: 0 })],
      [e({ client_markbox: "" }), e({ client_markbox: null }), e({ client_markbox: "DTD-9999" })],
    );
    expect(r).toEqual({ c1: { tieneSaldo: false, tieneTransito: false } });
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

describe("soloLecturaKommo · el dry=1 del cron", () => {
  function admin() {
    const rpc = vi.fn(async (fn: string) => ({ data: `real:${fn}`, error: null }));
    const from = vi.fn(() => "tabla");
    return { cliente: { rpc, from } as unknown as SupabaseClient, rpc, from };
  }

  it("⭐ el saldo se lee de la base real: la RPC del saldo pasa al cliente de verdad", async () => {
    const { cliente, rpc } = admin();
    const r = await soloLecturaKommo(cliente).rpc("client_outstanding", { p_client_ids: ["c1"] });
    expect(r).toEqual({ data: "real:client_outstanding", error: null });
    expect(rpc).toHaveBeenCalledWith("client_outstanding", { p_client_ids: ["c1"] });
  });

  it("el encolado NO llega a la base", async () => {
    const { cliente, rpc } = admin();
    const r = await soloLecturaKommo(cliente).rpc("enqueue_kommo_contact_writeback", {});
    expect(r).toEqual({ data: null, error: null });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("las lecturas de tablas pasan tal cual", () => {
    const { cliente, from } = admin();
    expect(soloLecturaKommo(cliente).from("clients")).toBe("tabla");
    expect(from).toHaveBeenCalledWith("clients");
  });
});
