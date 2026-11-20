/**
 * SDD-0682 §2.5 · Pestañas de Embarques, opción (a) elegida por Sam.
 *
 * «Activos» = lo que pide trabajo en origen o en destino; «En camino» = lo que va
 * en el mar (Embarcado, En tránsito). El conteo y el filtro salen de la misma
 * regla: se prueba que nunca se separan.
 */
import { describe, expect, it } from "vitest";
import {
  contarPorPestana,
  enPestana,
  filtrarPorPestana,
  PESTANA_POR_DEFECTO,
  PESTANAS_EMBARQUES,
} from "@/lib/studio/shipment-queries";
import type { ShipmentStatus } from "@/lib/studio/shipment-types";

const TODOS: ShipmentStatus[] = [
  "draft",
  "in_warehouse",
  "consolidating",
  "shipped",
  "in_transit",
  "in_customs",
  "arrived_destination",
  "delayed_warehouse",
  "out_for_delivery",
  "last_mile",
  "delivered",
  "exception",
  "cancelled",
];

describe("Embarques · pestañas (SDD-0682 opción a)", () => {
  it("abre en «Activos» y el orden es Activos · En camino · Entregados · Alertas · Todos", () => {
    expect(PESTANA_POR_DEFECTO).toBe("active");
    expect([...PESTANAS_EMBARQUES]).toEqual(["active", "camino", "delivered", "alerts", "all"]);
  });

  it("«En camino» trae solo Embarcado y En tránsito", () => {
    expect(TODOS.filter((s) => enPestana(s, "camino"))).toEqual(["shipped", "in_transit"]);
  });

  it("«Activos» deja fuera lo que va en el mar, lo entregado y lo cancelado", () => {
    expect(TODOS.filter((s) => enPestana(s, "active"))).toEqual([
      "draft",
      "in_warehouse",
      "consolidating",
      "in_customs",
      "arrived_destination",
      "delayed_warehouse",
      "out_for_delivery",
      "last_mile",
      "exception",
    ]);
  });

  it("ningún estado vivo se pierde: cada uno cae en Activos, En camino, Entregados o es cancelado", () => {
    for (const s of TODOS) {
      const enAlguna = enPestana(s, "active") || enPestana(s, "camino") || enPestana(s, "delivered");
      expect(enAlguna || s === "cancelled").toBe(true);
      // Activos y En camino no se pisan.
      expect(enPestana(s, "active") && enPestana(s, "camino")).toBe(false);
    }
  });

  it("el conteo de cada pestaña es igual a lo que filtra", () => {
    const filas = TODOS.flatMap((status, i) => Array.from({ length: i + 1 }, () => ({ status })));
    const conteo = contarPorPestana(filas);
    for (const p of PESTANAS_EMBARQUES) {
      expect(conteo[p]).toBe(filtrarPorPestana(filas, p).length);
    }
    expect(conteo.all).toBe(filas.length);
  });
});
