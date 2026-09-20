// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildCalcEventRow,
  CALC_EVENT_COLUMNS,
  type CalcEventPayload,
} from "@/lib/public/calc-event";

/**
 * SDD-0259 · el evento de la calculadora es ANÓNIMO, y esto lo vigila.
 *
 * La regla que protege esta suite no es de estilo: mientras la tabla no lleve
 * identificadores, el evento queda fuera del régimen de datos personales
 * (CRBV 28 y 60, Ley Especial contra los Delitos Informáticos, PIPL en Yiwu).
 * El día que se cuele un `email`, eso deja de ser cierto **en silencio** — no
 * hay error, no hay aviso, sólo una columna nueva llena de correos.
 *
 * Por eso el test central manda un payload envenenado y exige que no
 * sobreviva. Es el contrato, no un detalle.
 */
describe("el evento de la calculadora no puede llevar datos personales", () => {
  const base: CalcEventPayload = { modo: "ddp", cbm: 12 };

  it("descarta cualquier campo que no esté en la lista blanca", () => {
    const envenenado = {
      ...base,
      // Todo esto es lo que NO puede llegar nunca a la DB.
      email: "cliente@example.com",
      phone: "+58 412 1234567",
      nombre: "Juan Pérez",
      ip: "190.202.1.1",
      cookie: "sid=abc123",
      sessionId: "sess_123",
      userAgent: "Mozilla/5.0",
    } as CalcEventPayload;

    const out = buildCalcEventRow(envenenado);
    expect(out.ok).toBe(true);
    if (!out.ok) return;

    // Ni las claves…
    expect(Object.keys(out.row).sort()).toEqual([...CALC_EVENT_COLUMNS].sort());
    // …ni los valores, por si alguien los colara con otro nombre.
    const serializado = JSON.stringify(out.row);
    for (const rastro of [
      "cliente@example.com",
      "412",
      "Juan",
      "190.202",
      "abc123",
      "sess_123",
      "Mozilla",
    ]) {
      expect(serializado).not.toContain(rastro);
    }
  });

  it("la lista blanca no tiene ninguna columna sospechosa", () => {
    // Guardia por si alguien agranda CALC_EVENT_COLUMNS sin pensarlo.
    const prohibidas =
      /(email|correo|phone|tel|whatsapp|nombre|name|ip|cookie|session|user|agent|device)/i;
    const sospechosas = CALC_EVENT_COLUMNS.filter((c) => prohibidas.test(c));
    expect(sospechosas).toEqual([]);
  });
});

describe("validación del payload", () => {
  it("sin CBM no hay evento: no hubo cálculo que registrar", () => {
    for (const cbm of [undefined, null, 0, -3, "abc", NaN, Infinity]) {
      const out = buildCalcEventRow({ modo: "ddp", cbm });
      expect(out.ok).toBe(false);
    }
  });

  it("el peso ausente NO invalida el evento — es justamente el dato", () => {
    const out = buildCalcEventRow({ modo: "ddp", cbm: 12 });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.row.weight_kg).toBeNull();
    expect(out.row.cbm).toBe(12);
  });

  it("guarda el peso cuando sí viene", () => {
    const out = buildCalcEventRow({ modo: "ddp", cbm: 12, weightKg: 4800 });
    expect(out.ok && out.row.weight_kg).toBe(4800);
  });

  it("un modo desconocido cae a `ddp` en vez de romper", () => {
    const out = buildCalcEventRow({ modo: "hackeado", cbm: 1 });
    expect(out.ok && out.row.modo).toBe("ddp");
    const lcl = buildCalcEventRow({ modo: "consolidado", cbm: 1 });
    expect(lcl.ok && lcl.row.modo).toBe("consolidado");
  });

  it("un embalaje inventado queda en null, no se copia tal cual", () => {
    const out = buildCalcEventRow({ modo: "ddp", cbm: 1, embalaje: "oro" });
    expect(out.ok && out.row.embalaje).toBeNull();
  });

  it("corta los textos largos: son columnas `text` sin límite", () => {
    const out = buildCalcEventRow({
      modo: "ddp",
      cbm: 1,
      alerta: "x".repeat(5000),
      ciudadId: "y".repeat(5000),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.row.alerta!.length).toBe(64);
    expect(out.row.ciudad_id!.length).toBe(64);
  });

  it("las banderas sólo son true con un true de verdad", () => {
    const out = buildCalcEventRow({
      modo: "ddp",
      cbm: 1,
      bateria: "sí",
      cargaEspecial: 1,
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.row.bateria).toBe(false);
    expect(out.row.carga_especial).toBe(false);
  });

  it("registra el caso «no cotizó»: total null + su alerta", () => {
    const out = buildCalcEventRow({
      modo: "ddp",
      cbm: 100,
      alerta: "contenedor_excedido",
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.row.total_usd).toBeNull();
    expect(out.row.alerta).toBe("contenedor_excedido");
  });
});
