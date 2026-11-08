/**
 * SDD-0618 · 7.6 · modo comprobado antes de enviar y falla cerrada de `dtd-bot`. Puro.
 */
import { describe, expect, it } from "vitest";

import { canalDeSalida, decidirTurno, type FotoTurno } from "../decidir";

/** Una foto en la que todo deja seguir, en Sugerir. */
function foto(extra: Partial<FotoTurno> = {}): FotoTurno {
  return {
    leaseVigente: true,
    flagEncendido: true,
    modo: "sugerir",
    ia01Aprobada: false,
    enHorario: true,
    estadoConversacion: "open",
    callada: false,
    asignadaAPersona: false,
    personaEscribio: false,
    mensajeNuevo: false,
    soloPrimerMensaje: false,
    respuestasPrevias: 0,
    respuestas24h: 0,
    formatoAdmitido: true,
    gastoMesUsd: 0,
    costoMaximoLlamada: 0.01,
    ...extra,
  };
}

describe("decidirTurno: el camino feliz", () => {
  it("Sugerir con todo en orden sigue, aunque IA-01 no esté aprobada", () => {
    expect(decidirTurno(foto())).toEqual({ accion: "seguir", modo: "sugerir" });
  });

  it("Contesta solo sigue solo con IA-01 aprobada", () => {
    expect(decidirTurno(foto({ modo: "contesta_solo", ia01Aprobada: true }))).toEqual({ accion: "seguir", modo: "contesta_solo" });
  });

  it("Sugerir sigue aunque la conversación esté asignada a una persona (la ayuda a ella)", () => {
    expect(decidirTurno(foto({ asignadaAPersona: true }))).toEqual({ accion: "seguir", modo: "sugerir" });
  });
});

describe("decidirTurno: falla cerrada", () => {
  const campos: (keyof FotoTurno)[] = [
    "flagEncendido",
    "modo",
    "ia01Aprobada",
    "enHorario",
    "estadoConversacion",
    "callada",
    "asignadaAPersona",
    "personaEscribio",
    "mensajeNuevo",
    "soloPrimerMensaje",
    "respuestasPrevias",
    "respuestas24h",
    "formatoAdmitido",
  ];

  it.each(campos)("sin «%s» pasa a humano y no sigue", (campo) => {
    expect(decidirTurno(foto({ [campo]: null } as Partial<FotoTurno>))).toEqual({ accion: "humano", motivo: "estado_desconocido" });
  });

  it("un modo que no existe pasa a humano", () => {
    expect(decidirTurno(foto({ modo: "turbo" as never }))).toEqual({ accion: "humano", motivo: "estado_desconocido" });
  });

  it("sin lease vigente, a humano antes que nada (aunque esté apagado)", () => {
    expect(decidirTurno(foto({ leaseVigente: false, flagEncendido: false }))).toEqual({ accion: "humano", motivo: "lease_vencido" });
  });

  it("gasto del mes que no se pudo sumar → humano por presupuesto", () => {
    expect(decidirTurno(foto({ gastoMesUsd: null }))).toEqual({ accion: "humano", motivo: "presupuesto" });
  });

  it("Contesta solo sin IA-01 → humano (la base no debería dejarlo)", () => {
    expect(decidirTurno(foto({ modo: "contesta_solo", ia01Aprobada: false }))).toEqual({ accion: "humano", motivo: "contesta_solo_sin_ia01" });
  });
});

describe("decidirTurno: apagado gana", () => {
  it("flag apagado cancela aunque falten datos", () => {
    expect(decidirTurno(foto({ flagEncendido: false, modo: null, gastoMesUsd: null }))).toEqual({ accion: "cancelar", motivo: "flag_apagado" });
  });

  it("modo Apagado cancela aunque falten datos", () => {
    expect(decidirTurno(foto({ modo: "apagado", estadoConversacion: null }))).toEqual({ accion: "cancelar", motivo: "modo_apagado" });
  });
});

describe("decidirTurno: lo que decide una persona cancela en silencio", () => {
  it.each([
    ["resuelta", { estadoConversacion: "resolved" as const }, "resuelta"],
    ["callada por «resolver»", { callada: true }, "callada"],
    ["escribió una persona", { personaEscribio: true }, "escribio_una_persona"],
    ["fuera de horario", { enHorario: false }, "fuera_de_horario"],
    ["solo el primer mensaje, y ya hubo uno", { soloPrimerMensaje: true, respuestasPrevias: 1 }, "solo_primer_mensaje"],
  ])("%s", (_caso, extra, motivo) => {
    expect(decidirTurno(foto(extra))).toEqual({ accion: "cancelar", motivo });
  });

  it("Contesta solo no habla en una conversación asignada a una persona", () => {
    expect(decidirTurno(foto({ modo: "contesta_solo", ia01Aprobada: true, asignadaAPersona: true }))).toEqual({
      accion: "cancelar",
      motivo: "asignada_a_persona",
    });
  });

  it("solo el primer mensaje deja la primera respuesta", () => {
    expect(decidirTurno(foto({ soloPrimerMensaje: true, respuestasPrevias: 0 }))).toEqual({ accion: "seguir", modo: "sugerir" });
  });

  it("una persona que escribió gana al mensaje nuevo del cliente", () => {
    expect(decidirTurno(foto({ personaEscribio: true, mensajeNuevo: true }))).toEqual({ accion: "cancelar", motivo: "escribio_una_persona" });
  });
});

describe("decidirTurno: esperar y frenos", () => {
  it("si el cliente sigue escribiendo, espera", () => {
    expect(decidirTurno(foto({ mensajeNuevo: true }))).toEqual({ accion: "esperar", motivo: "mensaje_nuevo" });
  });

  it("formato no admitido → humano", () => {
    expect(decidirTurno(foto({ formatoAdmitido: false }))).toEqual({ accion: "humano", motivo: "formato_no_admitido" });
  });

  it("tope por conversación → humano", () => {
    expect(decidirTurno(foto({ respuestas24h: 6 }))).toEqual({ accion: "humano", motivo: "tope_conversacion" });
    expect(decidirTurno(foto({ respuestas24h: 5 }))).toEqual({ accion: "seguir", modo: "sugerir" });
  });

  it("presupuesto agotado → humano", () => {
    expect(decidirTurno(foto({ gastoMesUsd: 24.995, costoMaximoLlamada: 0.01 }))).toEqual({ accion: "humano", motivo: "presupuesto" });
    expect(decidirTurno(foto({ gastoMesUsd: 24.99, costoMaximoLlamada: 0.01 }))).toEqual({ accion: "seguir", modo: "sugerir" });
  });
});

describe("canalDeSalida", () => {
  it("Sugerir nunca le escribe al cliente", () => {
    expect(canalDeSalida("sugerir")).toBe("nota_privada");
    expect(canalDeSalida("contesta_solo")).toBe("mensaje");
  });
});
