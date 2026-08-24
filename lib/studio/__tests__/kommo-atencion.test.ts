/**
 * SDD-0288 · contratos de la derivada "sin atender".
 *
 * Cada caso existe porque su ausencia produciría un rojo mentiroso o un rojo
 * que no se enciende. No hay casos de relleno.
 */
import { describe, expect, it } from "vitest";
import {
  etiquetaEspera,
  leadsSinAtender,
  tareasAbsurdas,
  type TareaEspejo,
} from "../kommo-atencion";

/** Reloj congelado: la derivada recibe `ahoraMs`, nunca lee el reloj global. */
const AHORA = Date.parse("2026-08-24T12:00:00.000Z");
const haceHoras = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();
const enHoras = (h: number) => new Date(AHORA + h * 3_600_000).toISOString();

function tarea(over: Partial<TareaEspejo> = {}): TareaEspejo {
  return {
    entity_id: 900001,
    entity_type: "leads",
    is_completed: false,
    complete_till: haceHoras(3),
    ...over,
  };
}

describe("leadsSinAtender", () => {
  it("marca el lead cuya tarea está abierta y vencida", () => {
    const m = leadsSinAtender([tarea()], AHORA);
    expect(m.get(900001)).toEqual({ vencidaDesdeMs: 3 * 3_600_000, cuantas: 1 });
  });

  it("NO marca una tarea que todavía no vence", () => {
    // Si la marcara, el rojo se encendería antes de que nadie deba nada.
    expect(leadsSinAtender([tarea({ complete_till: enHoras(2) })], AHORA).size)
      .toBe(0);
  });

  it("NO marca una tarea completada aunque esté vencida", () => {
    // Completar la tarea es "ya lo tomé": es lo que APAGA el semáforo.
    expect(leadsSinAtender([tarea({ is_completed: true })], AHORA).size).toBe(0);
  });

  it("NO marca una tarea sin fecha límite", () => {
    // Sin vencimiento no hay nada vencido. Tratarla como vencida pintaría de
    // rojo cualquier tarea suelta del asesor.
    expect(leadsSinAtender([tarea({ complete_till: null })], AHORA).size).toBe(0);
  });

  it("ignora las tareas que no cuelgan de un lead", () => {
    // El semáforo del Tablero es por lead; una tarea de contacto pintaría una
    // tarjeta que no le corresponde.
    expect(
      leadsSinAtender([tarea({ entity_type: "contacts" })], AHORA).size,
    ).toBe(0);
  });

  it("ignora entity_id inválido en vez de crear un lead fantasma", () => {
    const basura: TareaEspejo[] = [
      tarea({ entity_id: null }),
      tarea({ entity_id: 0 }),
      tarea({ entity_id: -5 }),
    ];
    expect(leadsSinAtender(basura, AHORA).size).toBe(0);
  });

  it("ignora una fecha impresentable en vez de tirar", () => {
    expect(leadsSinAtender([tarea({ complete_till: "ayer" })], AHORA).size)
      .toBe(0);
  });

  it("con varias tareas del mismo lead se queda con la MÁS VIEJA", () => {
    // Si el cliente insistió tres veces, lo que importa es desde cuándo espera,
    // no la última vez que escribió.
    const m = leadsSinAtender(
      [
        tarea({ complete_till: haceHoras(1) }),
        tarea({ complete_till: haceHoras(9) }),
        tarea({ complete_till: haceHoras(4) }),
      ],
      AHORA,
    );
    expect(m.get(900001)).toEqual({ vencidaDesdeMs: 9 * 3_600_000, cuantas: 3 });
  });

  it("separa lead por lead", () => {
    const m = leadsSinAtender(
      [
        tarea({ entity_id: 111, complete_till: haceHoras(2) }),
        tarea({ entity_id: 222, complete_till: haceHoras(6) }),
      ],
      AHORA,
    );
    expect(m.get(111)?.vencidaDesdeMs).toBe(2 * 3_600_000);
    expect(m.get(222)?.vencidaDesdeMs).toBe(6 * 3_600_000);
  });

  it("una lista vacía no marca nada (y no revienta)", () => {
    expect(leadsSinAtender([], AHORA).size).toBe(0);
  });
});

describe("tareasAbsurdas — la firma del epoch en milisegundos", () => {
  it("delata el vencimiento proyectado al año ~57.000", () => {
    // `complete_till` viaja en epoch de SEGUNDOS. Mandarlo en milisegundos lo
    // manda 55.000 años al futuro: la tarea NUNCA se ve vencida y el rojo no
    // se enciende jamás. Falla en la dirección que no se ve, así que se DETECTA
    // en vez de corregirse adivinando (dividir entre 1000 sería inventar).
    const enMilisegundos = new Date(AHORA * 1000).toISOString();
    expect(tareasAbsurdas([tarea({ complete_till: enMilisegundos })], AHORA))
      .toEqual([900001]);
  });

  it("una tarea vencida normal NO es absurda", () => {
    expect(tareasAbsurdas([tarea()], AHORA)).toEqual([]);
  });

  it("una tarea futura razonable NO es absurda", () => {
    expect(tareasAbsurdas([tarea({ complete_till: enHoras(48) })], AHORA))
      .toEqual([]);
  });

  it("y esa misma tarea absurda NO enciende el rojo", () => {
    // El contrato cruzado: el bug se denuncia por un lado y por el otro no
    // produce un falso negativo silencioso — produce ningún rojo, que es lo
    // que `tareasAbsurdas` está ahí para explicar.
    const enMilisegundos = new Date(AHORA * 1000).toISOString();
    expect(
      leadsSinAtender([tarea({ complete_till: enMilisegundos })], AHORA).size,
    ).toBe(0);
  });
});

describe("etiquetaEspera", () => {
  it("redondea hacia ABAJO — un semáforo que exagera se deja de mirar", () => {
    expect(etiquetaEspera(2 * 3_600_000 + 50 * 60_000)).toBe("2 h");
  });

  it.each([
    [30_000, "recién"],
    [5 * 60_000, "5 min"],
    [59 * 60_000, "59 min"],
    [60 * 60_000, "1 h"],
    [23 * 3_600_000, "23 h"],
    [24 * 3_600_000, "1 d"],
    [72 * 3_600_000, "3 d"],
  ])("%i ms → %s", (ms, esperado) => {
    expect(etiquetaEspera(ms as number)).toBe(esperado);
  });
});
