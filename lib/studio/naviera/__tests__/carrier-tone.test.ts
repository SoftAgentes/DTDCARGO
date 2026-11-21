// @vitest-environment node
/**
 * SDD-0686 · grupo 7 (BD-076 regla 7): el tono de la naviera está guardado en
 * `carriers.tone`, texto libre. El vino se retiró de los badges y la base no
 * se toca, así que un «wine» guardado antes tiene que caer a neutral al leerlo,
 * sin error.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { listCarriers } from "../queries";
import { carrierTone } from "../types";

/** Cliente mínimo: la cadena from → select → order → limit resuelve a `rows`. */
function clienteCon(rows: Record<string, unknown>[]): SupabaseClient {
  const cadena = {
    select: () => cadena,
    order: () => cadena,
    limit: () => cadena,
    eq: () => cadena,
    then: (resolver: (r: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolver),
  };
  return { from: () => cadena } as unknown as SupabaseClient;
}

const fila = (id: string, tone: unknown) => ({
  id,
  tenant_id: "t1",
  name: `Naviera ${id}`,
  name_cn: null,
  scac: null,
  tone,
  active: true,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  deleted_at: null,
});

describe("carrierTone", () => {
  it("un «wine» guardado cae a neutral", () => {
    expect(carrierTone("wine")).toBe("neutral");
  });

  it("los tonos del sistema se conservan", () => {
    for (const t of ["success", "warning", "danger", "info", "neutral"]) {
      expect(carrierTone(t)).toBe(t);
    }
  });

  it("lo vacío, lo desconocido o lo que no es texto cae a neutral", () => {
    for (const t of [null, undefined, "", "Wine", "rojo", 3, {}]) {
      expect(carrierTone(t)).toBe("neutral");
    }
  });
});

describe("listCarriers · tono guardado", () => {
  it("la naviera con «wine» en la base llega neutral; las demás, con su tono", async () => {
    const navieras = await listCarriers(
      clienteCon([fila("a", "wine"), fila("b", "info"), fila("c", null)]),
    );
    expect(navieras.map((c) => [c.id, c.tone])).toEqual([
      ["a", "neutral"],
      ["b", "info"],
      ["c", "neutral"],
    ]);
  });
});
