/**
 * SDD-0300 — la regla de "qué estimado se puede borrar", que es lo único que
 * separa un borrado legítimo de dejar un embarque apuntando a un hueco.
 *
 * Se prueba la función PURA porque es la que consumen las dos puntas: el menú
 * del listado (para deshabilitar la opción con su motivo) y la server action
 * (que es quien decide de verdad).
 */

import { describe, it, expect } from "vitest";
import { canDeleteQuote, quoteDeleteBlockReason } from "../quote-types";

type Sujeto = Parameters<typeof quoteDeleteBlockReason>[0];

const sinConvertir: Sujeto = {
  converted_to_shipment_id: null,
  sales_order_id: null,
};

describe("quoteDeleteBlockReason", () => {
  it("no bloquea un estimado que no causó nada", () => {
    expect(quoteDeleteBlockReason(sinConvertir)).toBeNull();
    expect(canDeleteQuote(sinConvertir)).toBe(true);
  });

  it("bloquea si ya se convirtió en embarque", () => {
    const q = { ...sinConvertir, converted_to_shipment_id: "shp-1" };
    expect(quoteDeleteBlockReason(q)).toBe("ya se convirtió en un embarque");
    expect(canDeleteQuote(q)).toBe(false);
  });

  it("bloquea si está ligado a una orden de venta", () => {
    const q = { ...sinConvertir, sales_order_id: "ov-1" };
    expect(quoteDeleteBlockReason(q)).toBe("está ligado a una orden de venta");
    expect(canDeleteQuote(q)).toBe(false);
  });

  it("con embarque Y orden de venta el mensaje es estable: gana el embarque", () => {
    // Importa que sea determinista: el texto viaja a un `disabledReason` que el
    // usuario lee, y dos motivos alternándose serían ruido.
    const q = {
      converted_to_shipment_id: "shp-1",
      sales_order_id: "ov-1",
    };
    expect(quoteDeleteBlockReason(q)).toBe("ya se convirtió en un embarque");
  });

  it("el estado y el origen NO entran en la regla (founder · SDD-0300)", () => {
    // Un `sent` o un `rejected` sin convertir se borra igual: ése era justo el
    // caso sin salida, porque el borrado colgaba de "Editar" (sólo `draft`).
    expect(canDeleteQuote(sinConvertir)).toBe(true);
  });
});
