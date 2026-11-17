/** SDD-0650 F1 · Reglas puras de la ficha del cliente (`lib/studio/ficha-cliente.ts`). */
import { describe, expect, it } from "vitest";

import { accionesRapidas, codigosConCaida, nombreDeLaFicha } from "../ficha-cliente";

describe("nombreDeLaFicha", () => {
  it.each([[""], ["   "], [null], [undefined]])("%j es «Sin nombre»", (nombre) => {
    expect(nombreDeLaFicha(nombre)).toEqual({ texto: "Sin nombre", sinNombre: true });
  });
  it("un nombre se muestra tal cual", () => {
    expect(nombreDeLaFicha("Ana Pérez")).toEqual({ texto: "Ana Pérez", sinNombre: false });
  });
});

describe("accionesRapidas", () => {
  const UNA = [{ conversation_id: 7 }, { conversation_id: 3 }];
  it("con permiso y conversaciones, las dos acciones; el chat es la primera (la más reciente)", () => {
    expect(accionesRapidas({ markbox: "DTD 1/2", puedeVerCotizaciones: true, conversaciones: UNA })).toEqual({
      cotizacionesHref: "/studio/cotizador?client=DTD%201%2F2",
      chatHref: "/studio/bandeja?c=7",
    });
  });
  it("sin quotes no hay cotizaciones; sin Bandeja (null) o sin chats, no hay chat", () => {
    expect(accionesRapidas({ markbox: "DTD-1", puedeVerCotizaciones: false, conversaciones: null })).toEqual({
      cotizacionesHref: null,
      chatHref: null,
    });
    expect(accionesRapidas({ markbox: "DTD-1", puedeVerCotizaciones: false, conversaciones: [] }).chatHref).toBeNull();
  });
});

describe("codigosConCaida", () => {
  it("devuelve la cadena cuando se lee", async () => {
    expect(await codigosConCaida(async () => ["DTD-1", "DTD-0"], "DTD-1")).toEqual(["DTD-1", "DTD-0"]);
  });
  it("cae al vigente si la lectura lanza o viene vacía", async () => {
    expect(await codigosConCaida(async () => { throw new Error("x"); }, "DTD-1")).toEqual(["DTD-1"]);
    expect(await codigosConCaida(async () => [], "DTD-1")).toEqual(["DTD-1"]);
  });
});
