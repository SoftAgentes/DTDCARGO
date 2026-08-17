/**
 * SDD-0265 · el `limite` del listado viene de la URL, así que se normaliza antes
 * de tocar la query. Estos tests fijan ese contrato: nada del querystring pasa
 * crudo al `.limit()`.
 */
import { describe, expect, it } from "vitest";
import { parseClientFiltersFromSearchParams } from "./client-queries";
import { CLIENTS_MAX, CLIENTS_PAGE } from "./client-types";

describe("parseClientFiltersFromSearchParams · limite (SDD-0265)", () => {
  it("sin parámetro arranca en el primer bloque", () => {
    expect(parseClientFiltersFromSearchParams({}).limite).toBe(CLIENTS_PAGE);
  });

  it("respeta un valor válido", () => {
    expect(parseClientFiltersFromSearchParams({ limite: "400" }).limite).toBe(400);
  });

  it("no baja del bloque: un limite chico no sirve para achicar la lista", () => {
    expect(parseClientFiltersFromSearchParams({ limite: "5" }).limite).toBe(CLIENTS_PAGE);
    expect(parseClientFiltersFromSearchParams({ limite: "0" }).limite).toBe(CLIENTS_PAGE);
    expect(parseClientFiltersFromSearchParams({ limite: "-300" }).limite).toBe(CLIENTS_PAGE);
  });

  it("recorta al techo de PostgREST en vez de pedir algo que igual se cortaría", () => {
    expect(parseClientFiltersFromSearchParams({ limite: "999999" }).limite).toBe(CLIENTS_MAX);
  });

  it("la basura cae al default, no revienta ni viaja cruda", () => {
    for (const basura of ["abc", "", "NaN", "12; drop table clients"]) {
      expect(parseClientFiltersFromSearchParams({ limite: basura }).limite).toBe(
        CLIENTS_PAGE,
      );
    }
  });

  it("toma el primer valor si la URL repite el parámetro", () => {
    expect(
      parseClientFiltersFromSearchParams({ limite: ["400", "999999"] }).limite,
    ).toBe(400);
  });

  it("no se lleva por delante los otros filtros", () => {
    const f = parseClientFiltersFromSearchParams({
      limite: "400",
      tier: "vip",
      q: "  Pérez ",
      pending: "1",
    });
    expect(f).toMatchObject({
      limite: 400,
      tier: "vip",
      q: "  Pérez ",
      pendingReview: true,
    });
  });
});
