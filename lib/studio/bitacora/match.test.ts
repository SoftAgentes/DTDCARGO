import { describe, it, expect } from "vitest";
import { resolveName, resolveActa } from "./match";
import type { RawActa } from "./extract";
import type { AssignableProfile } from "./bitacora-queries";

const PROFILES: AssignableProfile[] = [
  { user_id: "u-ana", display_name: "Ana Pérez" },
  { user_id: "u-jose", display_name: "José Rodríguez" },
  { user_id: "u-mari", display_name: "María Fernanda López" },
];

function emptyRaw(over: Partial<RawActa> = {}): RawActa {
  return {
    resumen: "",
    puntos: [],
    hablaron: [],
    decisiones: [],
    pendientes: [],
    tareas: [],
    entregables_cliente: [],
    ...over,
  };
}

describe("resolveName (SDD-0146 · matching sin acentos, 3 niveles)", () => {
  it("(a) match exacto", () => {
    expect(resolveName("Ana Pérez", PROFILES)).toBe("u-ana");
  });

  it("(a) match exacto sin acentos (normaliza NFD)", () => {
    expect(resolveName("jose rodriguez", PROFILES)).toBe("u-jose");
    expect(resolveName("ANA PEREZ", PROFILES)).toBe("u-ana");
  });

  it("(b) contención bidireccional: primer nombre contenido en el full_name", () => {
    expect(resolveName("Ana", PROFILES)).toBe("u-ana");
    expect(resolveName("María", PROFILES)).toBe("u-mari");
  });

  it("(c) primer token del nombre presente como palabra del full_name", () => {
    // "Jose Gonzalez" no contiene ni está contenido en "José Rodríguez",
    // pero el primer token "jose" sí es palabra del display_name.
    expect(resolveName("Jose Gonzalez", PROFILES)).toBe("u-jose");
  });

  it("sin match → null (regla de oro: nunca se inventa)", () => {
    expect(resolveName("Pedro Ramírez", PROFILES)).toBeNull();
    expect(resolveName("Zoraida", PROFILES)).toBeNull();
  });

  it("nombre vacío / nulo → null", () => {
    expect(resolveName("", PROFILES)).toBeNull();
    expect(resolveName(null, PROFILES)).toBeNull();
    expect(resolveName(undefined, PROFILES)).toBeNull();
    expect(resolveName("   ", PROFILES)).toBeNull();
  });
});

describe("resolveActa · tareas del equipo (SDD-0146)", () => {
  it("matchea el responsable y marca matched=true, suggestedName=null", () => {
    const acta = resolveActa(
      emptyRaw({
        tareas: [{ titulo: "Enviar packing list", responsable_nombre: "Ana" }],
      }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.tasks).toHaveLength(1);
    const t = acta.tasks[0];
    expect(t.assignee_user_id).toBe("u-ana");
    expect(t.matched).toBe(true);
    expect(t.suggestedName).toBeNull();
    expect(t.responsable_nombre).toBe("Ana");
    expect(t.tipo).toBe("empleado");
  });

  it("sin match → sin asignar, conserva el nombre crudo y lo sugiere en ámbar", () => {
    const acta = resolveActa(
      emptyRaw({
        tareas: [{ titulo: "Cotizar flete", responsable_nombre: "Carlos Bracho" }],
      }),
      PROFILES,
      { tipo: "interna" },
    );
    const t = acta.tasks[0];
    expect(t.assignee_user_id).toBeNull();
    expect(t.matched).toBe(false);
    expect(t.suggestedName).toBe("Carlos Bracho");
    expect(t.responsable_nombre).toBe("Carlos Bracho");
  });

  it("fechas: solo ^\\d{4}-\\d{2}-\\d{2}$ reales pasan, el resto → null", () => {
    const acta = resolveActa(
      emptyRaw({
        tareas: [
          { titulo: "A", due_date: "2026-07-10" },
          { titulo: "B", due_date: "mañana" },
          { titulo: "C", due_date: "2026-13-40" }, // fecha imposible
          { titulo: "D", due_date: "2026-2-5" }, // sin zero-pad
        ],
      }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.tasks.map((t) => t.due_date)).toEqual([
      "2026-07-10",
      null,
      null,
      null,
    ]);
  });

  it("prioridad fuera de enum → 'media'", () => {
    const acta = resolveActa(
      emptyRaw({
        tareas: [
          { titulo: "A", prioridad: "urgente" },
          { titulo: "B", prioridad: "alta" },
          { titulo: "C" },
        ],
      }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.tasks.map((t) => t.prioridad)).toEqual(["media", "alta", "media"]);
  });

  it("descarta tareas con título en blanco", () => {
    const acta = resolveActa(
      emptyRaw({ tareas: [{ titulo: "  " }, { titulo: "Real" }] }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.tasks.map((t) => t.titulo)).toEqual(["Real"]);
  });

  it("checklist se limpia (trim + sin vacíos)", () => {
    const acta = resolveActa(
      emptyRaw({
        tareas: [{ titulo: "A", checklist: [" uno ", "", "dos"] }],
      }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.tasks[0].checklist).toEqual(["uno", "dos"]);
  });
});

describe("resolveActa · entregables del cliente (SDD-0146)", () => {
  it("→ tarea entregable_cliente, título 'Recibir de {cliente}: …', dueño resuelto", () => {
    const acta = resolveActa(
      emptyRaw({
        entregables_cliente: [
          { descripcion: "el logo en vector", responsable_seguimiento: "Ana" },
        ],
      }),
      PROFILES,
      { tipo: "cliente", clienteNombre: "Importadora Sol" },
    );
    expect(acta.tasks).toHaveLength(1);
    const t = acta.tasks[0];
    expect(t.tipo).toBe("entregable_cliente");
    expect(t.titulo).toBe("Recibir de Importadora Sol: el logo en vector");
    expect(t.assignee_user_id).toBe("u-ana");
    expect(t.matched).toBe(true);
    expect(t.prioridad).toBe("media");
    expect(t.checklist).toEqual([]);
  });

  it("seguimiento sin match → cae a quien registró el acta", () => {
    const acta = resolveActa(
      emptyRaw({
        entregables_cliente: [
          { descripcion: "el adelanto", responsable_seguimiento: "Alguien" },
        ],
      }),
      PROFILES,
      { tipo: "cliente", clienteNombre: "Sol", quienRegistroId: "u-jose" },
    );
    const t = acta.tasks[0];
    expect(t.assignee_user_id).toBe("u-jose");
    expect(t.matched).toBe(true);
  });

  it("sin seguimiento y sin quienRegistró → sin asignar", () => {
    const acta = resolveActa(
      emptyRaw({ entregables_cliente: [{ descripcion: "las medidas" }] }),
      PROFILES,
      { tipo: "cliente", clienteNombre: "Sol" },
    );
    const t = acta.tasks[0];
    expect(t.assignee_user_id).toBeNull();
    expect(t.matched).toBe(false);
  });

  it("sin nombre de cliente usa 'Recibir del cliente: …'", () => {
    const acta = resolveActa(
      emptyRaw({ entregables_cliente: [{ descripcion: "la aprobación" }] }),
      PROFILES,
      { tipo: "cliente" },
    );
    expect(acta.tasks[0].titulo).toBe("Recibir del cliente: la aprobación");
  });
});

describe("resolveActa · cabecera del acta", () => {
  it("copia y limpia resumen/puntos/decisiones/pendientes/próxima", () => {
    const acta = resolveActa(
      emptyRaw({
        resumen: "  Se cerró el pedido.  ",
        puntos: ["punto 1", "  ", "punto 2"],
        decisiones: ["decisión"],
        pendientes: ["pendiente"],
        proxima_reunion: { fecha: "2026-07-15", foco: "revisar pago" },
      }),
      PROFILES,
      { tipo: "interna", fechaISO: "2026-07-04" },
    );
    expect(acta.resumen).toBe("Se cerró el pedido.");
    expect(acta.puntos).toEqual(["punto 1", "punto 2"]);
    expect(acta.decisiones).toEqual(["decisión"]);
    expect(acta.pendientes).toEqual(["pendiente"]);
    expect(acta.proxima_reunion).toEqual({ fecha: "2026-07-15", foco: "revisar pago" });
    expect(acta.titulo).toBe("Reunión · 2026-07-04");
  });

  it("próxima con fecha no-ISO → fecha null", () => {
    const acta = resolveActa(
      emptyRaw({ proxima_reunion: { fecha: "el viernes", foco: "" } }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.proxima_reunion).toEqual({ fecha: null, foco: null });
  });

  it("título por defecto para conversación con cliente", () => {
    const acta = resolveActa(emptyRaw(), PROFILES, {
      tipo: "cliente",
      clienteNombre: "Sol",
      fechaISO: "2026-07-04",
    });
    expect(acta.titulo).toBe("Conversación con Sol · 2026-07-04");
  });
});

describe("resolveActa · hilos y dudas de clasificación (SDD-0150 Fase A)", () => {
  it("acta sin hilos/dudas → arrays vacíos (actas viejas siguen válidas)", () => {
    const acta = resolveActa(emptyRaw(), PROFILES, { tipo: "interna" });
    expect(acta.hilos).toEqual([]);
    expect(acta.dudas_clasificacion).toEqual([]);
  });

  it("hilos: normaliza estado_final null y contradiccion default false; descarta sin tema", () => {
    const acta = resolveActa(
      emptyRaw({
        hilos: [
          { tema: "entrega Maracaibo", estado_final: "10 días", contradiccion_sin_resolver: true },
          { tema: "pago proveedor" }, // sin estado_final → null, contradiccion false
          { tema: "  " }, // sin tema real → se descarta
        ],
      }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.hilos).toEqual([
      { tema: "entrega Maracaibo", estado_final: "10 días", contradiccion_sin_resolver: true },
      { tema: "pago proveedor", estado_final: null, contradiccion_sin_resolver: false },
    ]);
  });

  it("dudas: conserva texto/opciones, hablante null si falta; descarta sin texto", () => {
    const acta = resolveActa(
      emptyRaw({
        dudas_clasificacion: [
          { texto: "¿González es cliente o del equipo?", hablante: "González", opciones: ["cliente", "equipo"] },
          { texto: "duda sin hablante" },
          { texto: "   " }, // se descarta
        ],
      }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.dudas_clasificacion).toEqual([
      { texto: "¿González es cliente o del equipo?", hablante: "González", opciones: ["cliente", "equipo"] },
      { texto: "duda sin hablante", hablante: null, opciones: [] },
    ]);
  });
});

describe("resolveActa · vínculo con cliente (SDD-0150 Fase B)", () => {
  it("sin externo → nombre null, no necesita confirmar, sin sugerencia de match", () => {
    const acta = resolveActa(emptyRaw(), PROFILES, { tipo: "interna" });
    expect(acta.vinculo_cliente).toEqual({
      nombre_detectado: null,
      tipo_externo: null,
      posible_cliente_nuevo: false,
      client_id_sugerido: null,
      cliente_nombre_sugerido: null,
      confianza: "baja",
      necesita_confirmar: false,
    });
  });

  it("con externo detectado → necesita_confirmar=true, client_id_sugerido null (el match es server-side)", () => {
    const acta = resolveActa(
      emptyRaw({
        vinculo_cliente: {
          nombre_detectado: "González de Valencia",
          tipo_externo: "cliente",
          posible_cliente_nuevo: false,
          confianza: "media",
        },
      }),
      PROFILES,
      { tipo: "cliente" },
    );
    expect(acta.vinculo_cliente).toEqual({
      nombre_detectado: "González de Valencia",
      tipo_externo: "cliente",
      posible_cliente_nuevo: false,
      client_id_sugerido: null,
      cliente_nombre_sugerido: null,
      confianza: "media",
      necesita_confirmar: true,
    });
  });

  it("tipo_externo inválido con nombre → 'indeterminado'; confianza inválida → 'baja'", () => {
    const acta = resolveActa(
      emptyRaw({
        vinculo_cliente: {
          nombre_detectado: "Julio (transporte)",
          tipo_externo: "banana",
          confianza: "altísima",
        },
      }),
      PROFILES,
      { tipo: "interna" },
    );
    expect(acta.vinculo_cliente.tipo_externo).toBe("indeterminado");
    expect(acta.vinculo_cliente.confianza).toBe("baja");
    expect(acta.vinculo_cliente.necesita_confirmar).toBe(true);
  });
});
