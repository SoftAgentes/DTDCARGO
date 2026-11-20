/**
 * SDD-0682 · Almacén China: vista por URL, filtro por defecto «En almacén» y el
 * texto del contador de días.
 */
import { describe, expect, it } from "vitest";
import { hrefDeVista, statusDelSelector, textoDeDias, vistaDeUrl } from "@/lib/studio/almacen-cn-vistas";
import {
  ESTADOS_EN_ALMACEN,
  parseReceiptFiltersFromSearchParams,
} from "@/lib/studio/warehouse-cn-queries";

describe("vistaDeUrl", () => {
  it("sin parámetro o con un valor desconocido es «En almacén»", () => {
    expect(vistaDeUrl(undefined)).toBe("almacen");
    expect(vistaDeUrl("otra")).toBe("almacen");
    expect(vistaDeUrl("camino")).toBe("camino");
    expect(vistaDeUrl(["camino", "almacen"])).toBe("camino");
  });
});

describe("hrefDeVista", () => {
  it("conserva el idioma y suelta los filtros de recepciones", () => {
    const params = { lang: "cn", q: "DEMO-0001", hub: "YIW", status: "all", view: "create" };
    expect(hrefDeVista("/studio/cn", params, "camino")).toBe("/studio/cn?lang=cn&vista=camino");
    expect(hrefDeVista("/studio/cn", { ...params, vista: "camino" }, "almacen")).toBe(
      "/studio/cn?lang=cn",
    );
    expect(hrefDeVista("/studio/cn", {}, "almacen")).toBe("/studio/cn");
  });
});

describe("filtro de estado de Almacén China", () => {
  it("sin ?status= abre en «En almacén» (pendiente, incidencia y lo consolidado que no zarpó)", () => {
    expect(parseReceiptFiltersFromSearchParams({}).status).toBe("en_almacen");
    expect([...ESTADOS_EN_ALMACEN].sort()).toEqual(["consolidado", "incidencia", "pendiente_consolidacion"]);
  });

  it("un estado que no existe cae en «En almacén», no en «todos»", () => {
    expect(parseReceiptFiltersFromSearchParams({ status: "received" }).status).toBe("en_almacen");
  });

  it("?status=all sigue mostrando todo y un estado concreto se respeta", () => {
    expect(parseReceiptFiltersFromSearchParams({ status: "all" }).status).toBe("all");
    expect(parseReceiptFiltersFromSearchParams({ status: "consolidado" }).status).toBe("consolidado");
    expect(parseReceiptFiltersFromSearchParams({ status: ["incidencia"] }).status).toBe("incidencia");
  });
});

describe("statusDelSelector", () => {
  it("el selector nunca queda sin opción: lo desconocido es «En almacén»", () => {
    expect(statusDelSelector(null)).toBe("");
    expect(statusDelSelector("foo")).toBe("");
    expect(statusDelSelector("all")).toBe("all");
    expect(statusDelSelector("consolidado")).toBe("consolidado");
  });

  it("dice lo mismo que el servidor para cada valor", () => {
    for (const crudo of [undefined, "", "foo", "all", "pendiente_consolidacion", "consolidado", "incidencia", "received"]) {
      const servidor = parseReceiptFiltersFromSearchParams(crudo === undefined ? {} : { status: crudo }).status;
      expect(statusDelSelector(crudo)).toBe(servidor === "en_almacen" ? "" : servidor);
    }
  });
});

describe("textoDeDias", () => {
  it("sin ETA no se inventa; hoy, faltan y vencida", () => {
    expect(textoDeDias(null)).toEqual({ tipo: "sin_eta" });
    expect(textoDeDias(0)).toEqual({ tipo: "hoy" });
    expect(textoDeDias(12)).toEqual({ tipo: "faltan", dias: 12 });
    expect(textoDeDias(-3)).toEqual({ tipo: "vencida", dias: 3 });
  });
});
