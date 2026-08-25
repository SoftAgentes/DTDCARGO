/**
 * SDD-0288 rebanada 1 · contratos del semáforo de conversación.
 *
 * Cada caso existe porque su ausencia pintaría una tarjeta al revés. El error
 * caro acá NO es simétrico: un rojo de menos deja a un cliente esperando; un
 * rojo de más entrena al equipo a ignorar el tablero. Los dos se prueban.
 */
import { describe, expect, it } from "vitest";
import {
  colorConversacion,
  conversacionDe,
  etiquetaDesde,
  rotuloConversacion,
} from "../kommo-conversacion";

const AHORA = Date.parse("2026-08-25T12:00:00.000Z");
const haceH = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();

describe("conversacionDe", () => {
  it("sin ninguna fecha → sin conversación", () => {
    expect(conversacionDe({ last_inbound_at: null, last_outbound_at: null }, AHORA))
      .toEqual({ estado: "sin-chat", desdeMs: null });
  });

  it("escribió y nunca le contestamos → TE ESCRIBIÓ", () => {
    const c = conversacionDe(
      { last_inbound_at: haceH(3), last_outbound_at: null },
      AHORA,
    );
    expect(c.estado).toBe("te-escribio");
    expect(c.desdeMs).toBe(3 * 3_600_000);
  });

  it("le contestamos después de que escribió → ESPERANDO", () => {
    const c = conversacionDe(
      { last_inbound_at: haceH(5), last_outbound_at: haceH(2) },
      AHORA,
    );
    expect(c.estado).toBe("esperando");
    // El "hace cuánto" cuenta desde NUESTRO mensaje, no desde el suyo: lo que
    // importa es cuánto lleva él sin responder.
    expect(c.desdeMs).toBe(2 * 3_600_000);
  });

  it("volvió a escribir después de que le contestamos → TE ESCRIBIÓ otra vez", () => {
    const c = conversacionDe(
      { last_inbound_at: haceH(1), last_outbound_at: haceH(4) },
      AHORA,
    );
    expect(c.estado).toBe("te-escribio");
    expect(c.desdeMs).toBe(1 * 3_600_000);
  });

  it("le escribimos primero y nunca contestó → ESPERANDO", () => {
    // Campaña saliente: la tarjeta NO debe ponerse roja, no le debemos nada.
    const c = conversacionDe(
      { last_inbound_at: null, last_outbound_at: haceH(48) },
      AHORA,
    );
    expect(c.estado).toBe("esperando");
    expect(c.desdeMs).toBe(48 * 3_600_000);
  });

  it("🔴 en un EMPATE exacto gana el entrante", () => {
    // Pasa cuando el agente de IA contesta en el mismo tick. Preferimos un rojo
    // de más en el empate que dar por contestado algo que quizá no lo está.
    const t = haceH(2);
    expect(conversacionDe({ last_inbound_at: t, last_outbound_at: t }, AHORA).estado)
      .toBe("te-escribio");
  });

  it("una fecha impresentable no revienta ni inventa un estado", () => {
    expect(conversacionDe({ last_inbound_at: "ayer", last_outbound_at: null }, AHORA).estado)
      .toBe("sin-chat");
    // Basura de un lado, dato bueno del otro → manda el bueno.
    expect(conversacionDe({ last_inbound_at: "ayer", last_outbound_at: haceH(1) }, AHORA).estado)
      .toBe("esperando");
  });

  it("nunca devuelve un tiempo negativo aunque la fecha venga del futuro", () => {
    const futuro = new Date(AHORA + 9_000_000).toISOString();
    expect(conversacionDe({ last_inbound_at: futuro, last_outbound_at: null }, AHORA).desdeMs)
      .toBe(0);
  });
});

describe("el rojo se reserva, y eso es el contrato", () => {
  it("SOLO 'te escribió' es --danger", () => {
    // Si 'esperando' también fuera rojo, la columna se vuelve un muro rojo y el
    // indicador muere. Es el riesgo que el doc de Kommo anotó el 11-ago y nunca
    // se midió.
    expect(colorConversacion({ estado: "te-escribio", desdeMs: 0 }))
      .toBe("var(--danger)");
    expect(colorConversacion({ estado: "esperando", desdeMs: 0 }))
      .not.toBe("var(--danger)");
    expect(colorConversacion({ estado: "sin-chat", desdeMs: null })).toBeNull();
  });
});

describe("rotuloConversacion", () => {
  it("dice qué pasó y hace cuánto", () => {
    expect(rotuloConversacion({ estado: "te-escribio", desdeMs: 3 * 3_600_000 }))
      .toBe("Te escribió · hace 3 h");
    expect(rotuloConversacion({ estado: "esperando", desdeMs: 2 * 86_400_000 }))
      .toBe("Esperando respuesta · hace 2 d");
    expect(rotuloConversacion({ estado: "sin-chat", desdeMs: null }))
      .toBe("Sin conversación");
  });
});

describe("etiquetaDesde", () => {
  it("redondea hacia ABAJO — un semáforo que exagera se deja de mirar", () => {
    expect(etiquetaDesde(2 * 3_600_000 + 50 * 60_000)).toBe("2 h");
  });

  it.each([
    [30_000, "recién"],
    [5 * 60_000, "5 min"],
    [59 * 60_000, "59 min"],
    [60 * 60_000, "1 h"],
    [23 * 3_600_000, "23 h"],
    [24 * 3_600_000, "1 d"],
    [72 * 3_600_000, "3 d"],
  ])("%i ms → %s", (msv, esperado) => {
    expect(etiquetaDesde(msv as number)).toBe(esperado);
  });
});
