// @vitest-environment node
/**
 * SDD-0305 · Las variables del correo «Factura emitida».
 *
 * Lo que se prueba es lo que le llega al cliente en un correo automático: un
 * monto mal formateado, una tasa que no corresponde o un dato inventado donde
 * falta uno. Un correo no se revisa antes de salir.
 */

import { describe, it, expect } from "vitest";
import {
  varsDeFacturaEmitida,
  type FacturaParaCorreo,
} from "../invoice-mail-vars";

function mk(over: Partial<FacturaParaCorreo> = {}): FacturaParaCorreo {
  return {
    invoice_code: "F-2026-0117",
    client_name: "Importadora Ñandú, C.A.",
    client_markbox: "DTD-1234",
    shipment_code: "S-2026-0089",
    currency: "USD",
    fx_rate: null,
    total_amount: 4250,
    due_date: "2026-06-25",
    ...over,
  };
}

describe("varsDeFacturaEmitida", () => {
  it("🔴 `total_ves` y `bcv_rate` SOLO salen si la factura es en bolívares", () => {
    // Si salieran siempre, una plantilla que los use imprimiría la cifra en
    // dólares rotulada como bolívares. El cliente pagaría lo que no es.
    const usd = varsDeFacturaEmitida(mk(), "2026-05-26", "2026-06-25");
    expect(usd).not.toHaveProperty("total_ves");
    expect(usd).not.toHaveProperty("bcv_rate");

    const ves = varsDeFacturaEmitida(
      mk({ currency: "VES", total_amount: 152000, fx_rate: 35.76 }),
      "2026-05-26",
      "2026-06-25",
    );
    expect(ves.total_ves).toBe("152000.00");
    expect(ves.bcv_rate).toBe("35.76");
  });

  it("los montos van con dos decimales y sin separador de miles", () => {
    expect(varsDeFacturaEmitida(mk(), "d", "v").total_usd).toBe("4250.00");
    expect(
      varsDeFacturaEmitida(mk({ total_amount: 0 }), "d", "v").total_usd,
    ).toBe("0.00");
  });

  it("🔴 donde falta un dato va un guion, NUNCA un valor inventado", () => {
    const v = varsDeFacturaEmitida(
      mk({ shipment_code: null, client_name: null }),
      "2026-05-26",
      "2026-06-25",
    );
    expect(v.shipment_code).toBe("—");
    // El saludo cae a algo neutro: "Hola, cliente" se lee raro pero es honesto;
    // "Hola, null" o "Hola, undefined" es lo que no puede pasar.
    expect(v.customer_name).toBe("cliente");
  });

  it("un nombre en blanco cuenta como ausente", () => {
    expect(
      varsDeFacturaEmitida(mk({ client_name: "   " }), "d", "v").customer_name,
    ).toBe("cliente");
    expect(
      varsDeFacturaEmitida(mk({ shipment_code: "  " }), "d", "v").shipment_code,
    ).toBe("—");
  });

  it("las fechas son las que decide la emisión, no las que trae la fila", () => {
    // `issue_date` es el día de la emisión y `due_date` puede ser el que la
    // emisión calculó (+30) cuando la factura no traía uno. Por eso entran
    // como parámetros y no se leen del objeto.
    const v = varsDeFacturaEmitida(
      mk({ due_date: "VIEJA" }),
      "2026-08-26",
      "2026-09-25",
    );
    expect(v.issue_date).toBe("2026-08-26");
    expect(v.due_date).toBe("2026-09-25");
  });

  it("las claves son las del vocabulario de plantillas", () => {
    // Si una clave se renombra acá y no en la plantilla, el correo sale con el
    // `{{placeholder}}` crudo a la vista del cliente.
    expect(Object.keys(varsDeFacturaEmitida(mk(), "d", "v")).sort()).toEqual([
      "customer_name",
      "due_date",
      "invoice_code",
      "issue_date",
      "markbox",
      "shipment_code",
      "total_usd",
    ]);
  });
});
