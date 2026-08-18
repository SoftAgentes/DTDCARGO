/**
 * SDD-0269 · el precio que le toca a cada cliente.
 *
 * Lo que se prueba acá no es que el código corra: es que un cliente de aliado
 * NO cotice con el precio de la calle, y que un cliente directo NO cotice con
 * el descuento de nadie. Entre esas dos cosas está toda la plata del programa
 * de aliados.
 *
 * PRUEBAS DE MUTACIÓN (corridas, ver la spec):
 *   · si `aplicarDescuento` también baja `min_charge` → rojo el caso del piso.
 *   · si `resolveRateForClient` devuelve el id de la tarifa descontada en vez
 *     del de la casa → rojo el caso de `rate_used_id`.
 *   · si la tarifa propia deja de tener prioridad sobre el descuento → rojo.
 */
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  aplicarDescuento,
  fmtDescuento,
  validateBasePerCbm,
  validateDescuento,
} from "../price-book-types";
import { resolveRateForClient } from "../price-book-queries";
import type { Rate } from "../../rate-types";

const CASA = "book-casa";
const BOOK_DC = "book-dc";

function rate(over: Partial<Rate> = {}): Rate {
  return {
    id: "rate-casa",
    tenant_id: "t1",
    service: "puerta_a_puerta_DDP",
    origin: "China",
    destination: "Venezuela",
    per_cbm: 800,
    flat_rate: null,
    min_charge: 50,
    transit_days: 40,
    valid_from: null,
    valid_until: null,
    is_public: false,
    status: "published",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    expiry_warn_sent_at: null,
    expiry_overdue_sent_at: null,
    ...over,
  };
}

/**
 * Fake de Supabase con dos listas: la de la casa y la de Dynasty Cargo.
 * `bookDelCliente` es lo que devuelve la RPC `resolve_price_book`.
 * `tarifas` mapea id-de-lista → tarifa que esa lista tiene para el destino.
 */
function makeSupabase(opts: {
  bookDelCliente: string | null;
  descuentoDC?: number | null;
  pactadoDC?: number | null;
  tarifas: Record<string, Rate | null>;
}) {
  return {
    from: (tabla: string) => {
      const filtros: Record<string, unknown> = {};
      const c: Record<string, unknown> = {
        select: () => c,
        eq: (col: string, val: unknown) => {
          filtros[col] = val;
          return c;
        },
        is: () => c,
        ilike: () => c,
        or: () => c,
        order: () => c,
        limit: () => c,
        maybeSingle: async () => {
          if (tabla === "price_books") {
            if (filtros.is_house === true) {
              return {
                data: {
                  id: CASA,
                  name: "Tarifa DTD Cargo",
                  is_house: true,
                  discount_pct: null,
                  base_per_cbm: null,
                },
                error: null,
              };
            }
            if (filtros.id === BOOK_DC) {
              return {
                data: {
                  id: BOOK_DC,
                  name: "Tarifa Dynasty Cargo",
                  is_house: false,
                  discount_pct: opts.descuentoDC ?? null,
                  base_per_cbm: opts.pactadoDC ?? null,
                },
                error: null,
              };
            }
            return { data: null, error: null };
          }
          if (tabla === "rates") {
            return { data: opts.tarifas[filtros.price_book_id as string] ?? null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return c;
    },
    rpc: async (name: string) => {
      if (name === "resolve_price_book") return { data: opts.bookDelCliente, error: null };
      return { data: null, error: null };
    },
  } as unknown as SupabaseClient;
}

const PEDIDO = {
  service: "puerta_a_puerta_DDP" as const,
  destination: "Venezuela",
};

describe("aplicarDescuento", () => {
  it("baja el precio por CBM", () => {
    expect(aplicarDescuento(rate({ per_cbm: 800 }), 12).per_cbm).toBe(704);
  });

  it("baja también la tarifa flat del FCL", () => {
    const r = aplicarDescuento(rate({ per_cbm: null, flat_rate: 8500 }), 10);
    expect(r.flat_rate).toBe(7650);
  });

  it("⭐ NO toca el piso: min_charge es un término comercial aparte, no el precio", () => {
    expect(aplicarDescuento(rate({ min_charge: 50 }), 12).min_charge).toBe(50);
  });

  it("redondea a centavos", () => {
    expect(aplicarDescuento(rate({ per_cbm: 580 }), 12.5).per_cbm).toBe(507.5);
    expect(aplicarDescuento(rate({ per_cbm: 333.33 }), 7).per_cbm).toBe(310);
  });

  it("sin descuento, o con uno imposible, devuelve la tarifa intacta", () => {
    const base = rate({ per_cbm: 800 });
    expect(aplicarDescuento(base, null).per_cbm).toBe(800);
    expect(aplicarDescuento(base, 0).per_cbm).toBe(800);
    expect(aplicarDescuento(base, 100).per_cbm).toBe(800);
    expect(aplicarDescuento(base, Number.NaN).per_cbm).toBe(800);
  });

  it("no muta la tarifa de la casa que recibe", () => {
    const base = rate({ per_cbm: 800 });
    aplicarDescuento(base, 20);
    expect(base.per_cbm).toBe(800);
  });
});

describe("validateDescuento", () => {
  it("vacío es SIN descuento, no cero", () => {
    expect(validateDescuento("")).toEqual({ value: null });
    expect(validateDescuento(null)).toEqual({ value: null });
  });

  it("acepta coma decimal, que es como se escribe acá", () => {
    expect(validateDescuento("12,5")).toEqual({ value: 12.5 });
  });

  it("rechaza el 0, el 100 y lo que no es número", () => {
    expect(validateDescuento("0").error).toBeTruthy();
    expect(validateDescuento("100").error).toBeTruthy();
    expect(validateDescuento("mucho").error).toBeTruthy();
  });
});

describe("validateBasePerCbm", () => {
  it("vacío es SIN precio pactado, no cero", () => {
    expect(validateBasePerCbm("")).toEqual({ value: null });
    expect(validateBasePerCbm(null)).toEqual({ value: null });
  });

  it("tolera cómo se teclea de verdad: con $, con espacios y con coma", () => {
    expect(validateBasePerCbm("$690")).toEqual({ value: 690 });
    expect(validateBasePerCbm(" 690,50 ")).toEqual({ value: 690.5 });
  });

  it("rechaza el 0, el negativo y el error de tecleo", () => {
    expect(validateBasePerCbm("0").error).toBeTruthy();
    expect(validateBasePerCbm("-690").error).toBeTruthy();
    expect(validateBasePerCbm("690000").error).toBeTruthy();
    expect(validateBasePerCbm("caro").error).toBeTruthy();
  });
});

describe("fmtDescuento", () => {
  it("sin decimales cuando es redondo", () => {
    expect(fmtDescuento(12)).toBe("12 %");
    expect(fmtDescuento(12.5)).toBe("12,5 %");
    expect(fmtDescuento(null)).toBe("—");
  });
});

describe("resolveRateForClient", () => {
  it("un cliente directo cotiza con la tarifa de la casa", async () => {
    const supabase = makeSupabase({
      bookDelCliente: CASA,
      tarifas: { [CASA]: rate({ id: "rate-casa", per_cbm: 800 }) },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c1" });
    expect(r?.origen).toBe("casa");
    expect(r?.rate.per_cbm).toBe(800);
    expect(r?.descuentoPct).toBeNull();
  });

  it("un prospecto sin ficha también cotiza con la de la casa", async () => {
    const supabase = makeSupabase({
      bookDelCliente: null,
      tarifas: { [CASA]: rate({ per_cbm: 800 }) },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: null });
    expect(r?.origen).toBe("casa");
    expect(r?.rate.per_cbm).toBe(800);
  });

  it("⭐ la tarifa PROPIA del aliado manda sobre todo lo demás", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      descuentoDC: 12,
      tarifas: {
        [CASA]: rate({ id: "rate-casa", per_cbm: 800 }),
        [BOOK_DC]: rate({ id: "rate-dc", per_cbm: 690 }),
      },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c2" });
    expect(r?.origen).toBe("propia");
    expect(r?.rate.per_cbm).toBe(690);
    expect(r?.rateId).toBe("rate-dc");
    // El descuento NO se encima sobre la tarifa propia: 690, no 607,20.
    expect(r?.descuentoPct).toBeNull();
  });

  it("⭐ donde no tiene tarifa propia, la de la casa CON su descuento", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      descuentoDC: 12,
      tarifas: {
        [CASA]: rate({ id: "rate-casa", per_cbm: 800, min_charge: 50 }),
        [BOOK_DC]: null,
      },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c3" });
    expect(r?.origen).toBe("descuento");
    expect(r?.rate.per_cbm).toBe(704);
    expect(r?.rate.min_charge).toBe(50);
    expect(r?.descuentoPct).toBe(12);
    // `rate_used_id` tiene que apuntar a la fila REAL que se usó — la de la
    // casa. Guardar un id inventado dejaría el estimado sin trazabilidad.
    expect(r?.rateId).toBe("rate-casa");
  });

  it("un aliado con lista pero sin descuento ni tarifa propia paga lo de la casa", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      descuentoDC: null,
      tarifas: {
        [CASA]: rate({ id: "rate-casa", per_cbm: 800 }),
        [BOOK_DC]: null,
      },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c4" });
    expect(r?.origen).toBe("casa");
    expect(r?.rate.per_cbm).toBe(800);
  });

  it("sin tarifa de la casa para ese destino no inventa un precio", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      descuentoDC: 12,
      tarifas: { [CASA]: null, [BOOK_DC]: null },
    });

    expect(await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c5" })).toBeNull();
  });

  it("⭐ el precio PACTADO manda sobre el descuento — es más específico", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      descuentoDC: 12,
      pactadoDC: 690,
      tarifas: {
        [CASA]: rate({ id: "rate-casa", per_cbm: 800, min_charge: 50 }),
        [BOOK_DC]: null,
      },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c6" });
    expect(r?.origen).toBe("pactada");
    // 690 pactado, NO 704 (que sería el 12 % sobre 800).
    expect(r?.rate.per_cbm).toBe(690);
    expect(r?.descuentoPct).toBeNull();
    // El piso sigue siendo el de la casa, igual que con el descuento.
    expect(r?.rate.min_charge).toBe(50);
    expect(r?.rateId).toBe("rate-casa");
  });

  it("pero la tarifa PROPIA sigue mandando sobre el pactado", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      pactadoDC: 690,
      tarifas: {
        [CASA]: rate({ id: "rate-casa", per_cbm: 800 }),
        [BOOK_DC]: rate({ id: "rate-dc", per_cbm: 640 }),
      },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c7" });
    expect(r?.origen).toBe("propia");
    expect(r?.rate.per_cbm).toBe(640);
  });

  it("⭐ en un tramo que va por CONTENEDOR el $/CBM pactado no aplica", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      descuentoDC: 10,
      pactadoDC: 690,
      tarifas: {
        // FCL: se cobra por contenedor, no por metro cúbico.
        [CASA]: rate({ id: "rate-fcl", service: "fcl_directo", per_cbm: null, flat_rate: 8500 }),
        [BOOK_DC]: null,
      },
    });

    const r = await resolveRateForClient(supabase, {
      service: "fcl_directo",
      destination: "La Guaira",
      clientId: "c8",
    });
    // Cae al descuento, que sí sabe bajar un flat_rate. Nunca a "pactada".
    expect(r?.origen).toBe("descuento");
    expect(r?.rate.flat_rate).toBe(7650);
    expect(r?.rate.per_cbm).toBeNull();
  });

  it("un pactado sin descuento y sin tarifa propia igual se aplica", async () => {
    const supabase = makeSupabase({
      bookDelCliente: BOOK_DC,
      descuentoDC: null,
      pactadoDC: 725.5,
      tarifas: {
        [CASA]: rate({ id: "rate-casa", per_cbm: 800 }),
        [BOOK_DC]: null,
      },
    });

    const r = await resolveRateForClient(supabase, { ...PEDIDO, clientId: "c9" });
    expect(r?.origen).toBe("pactada");
    expect(r?.rate.per_cbm).toBe(725.5);
  });

  it("sin destino no consulta nada", async () => {
    const supabase = makeSupabase({ bookDelCliente: CASA, tarifas: {} });
    expect(
      await resolveRateForClient(supabase, { ...PEDIDO, destination: "  ", clientId: "c1" }),
    ).toBeNull();
  });
});
