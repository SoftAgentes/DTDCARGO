// @vitest-environment node
/**
 * SDD-0652 fase 2 · reglas puras y consultas nuevas de la ficha, y la
 * minimización de las solicitudes de registro (N2). Datos sintéticos.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hechosDeEventos,
  motivoValido,
  sugerenciaDeEnlace,
  unirHechos,
  type CandidatoEnlace,
  type EventoFicha,
  type Hecho,
} from "../ficha-empleado";
import { candidatosDeEnlace, eventosDe } from "../ficha-empleado-queries";
import { listRegistrations, REG_LIST_COLUMNS } from "../registration-queries";
import { toRegistrationListItem, toRegistrationReview, type EmployeeRegistration } from "../registration-types";

const EV = (event_type: string, occurred_at: string, actor_id: string | null = null): EventoFicha => ({
  id: `ev-${event_type}-${occurred_at}`,
  entity_type: "nomina_employee_access",
  event_type,
  occurred_at,
  actor_id,
});

describe("eventos de la ficha en la línea de tiempo", () => {
  it("cada evento conocido tiene su título, y dice quién lo hizo si se sabe", () => {
    const hechos = hechosDeEventos(
      [
        EV("user_linked", "2026-11-17T10:00:00Z", "u1"),
        EV("user_unlinked", "2026-11-17T11:00:00Z"),
        EV("photo_set", "2026-11-17T12:00:00Z"),
        EV("photo_removed", "2026-11-17T13:00:00Z"),
        EV("bank_account_revealed", "2026-11-17T14:00:00Z", "u-desconocido"),
        EV("payroll_settlement_voided", "2026-11-17T15:00:00Z"),
      ],
      { u1: "Admin Sintético" },
    );
    expect(hechos.map((h) => h.titulo)).toEqual([
      "Se enlazó con un usuario del Studio",
      "Se quitó el enlace con su usuario",
      "Se cambió la foto",
      "Se quitó la foto",
      "Se consultó la cuenta bancaria completa",
      "Se anuló un finiquito",
    ]);
    expect(hechos[0]!.detalle).toBe("Por Admin Sintético");
    // Un actor sin nombre no se inventa ni se muestra su id.
    expect(hechos[4]!.detalle).toBeUndefined();
    expect(JSON.stringify(hechos)).not.toContain("u-desconocido");
    expect(hechos.every((h) => h.tipo === "evento")).toBe(true);
  });

  it("un evento que no se conoce se dice sin inventar qué fue", () => {
    expect(hechosDeEventos([EV("algo_nuevo", "2026-11-17T10:00:00Z")], {})[0]!.titulo).toBe("Cambio registrado en la ficha");
  });

  it("unirHechos ordena del más reciente al más antiguo, mezclando fechas e instantes", () => {
    const laborales: Hecho[] = [
      { fecha: "2026-01-15", tipo: "ingreso", titulo: "Ingreso", tono: "info" },
      { fecha: "2026-11-18", tipo: "recibo", titulo: "Nómina", tono: "success" },
    ];
    const unidos = unirHechos(laborales, hechosDeEventos([EV("photo_set", "2026-11-17T12:00:00Z")], {}));
    expect(unidos.map((h) => h.titulo)).toEqual(["Nómina", "Se cambió la foto", "Ingreso"]);
  });
});

describe("sugerencia de enlace (§4 punto 3)", () => {
  const candidatos: CandidatoEnlace[] = [
    { userId: "u1", nombre: "Uno", correoAcceso: "Uno@Example.test" },
    { userId: "u2", nombre: "Dos", correoAcceso: "dos@example.test" },
    { userId: "u3", nombre: "Tres", correoAcceso: null },
  ];
  it("propone solo con coincidencia exacta, sin mayúsculas ni espacios", () => {
    expect(sugerenciaDeEnlace("  uno@example.test ", candidatos)?.userId).toBe("u1");
    expect(sugerenciaDeEnlace("uno@example.tes", candidatos)).toBeNull();
    expect(sugerenciaDeEnlace("uno+x@example.test", candidatos)).toBeNull();
  });
  it("sin correo de contacto no propone a quien tampoco tiene correo", () => {
    expect(sugerenciaDeEnlace(null, candidatos)).toBeNull();
    expect(sugerenciaDeEnlace("   ", candidatos)).toBeNull();
  });
  it("con dos candidatos con el mismo correo no propone a ninguno", () => {
    expect(
      sugerenciaDeEnlace("dos@example.test", [...candidatos, { userId: "u4", nombre: "Cuatro", correoAcceso: "DOS@example.test" }]),
    ).toBeNull();
  });
});

describe("motivo", () => {
  it.each([
    ["", false],
    ["   ", false],
    ["abc", false],
    ["  abc  ", false],
    ["abcd", true],
    ["a".repeat(500), true],
    ["a".repeat(501), false],
    [null, false],
  ])("motivoValido(%j) = %s", (motivo, esperado) => {
    expect(motivoValido(motivo as string | null)).toBe(esperado);
  });
});

describe("eventosDe", () => {
  const cliente = (respuesta: { data: unknown; error: { code?: string; message?: string } | null }) => {
    const llamadas: { fn: string; args: Record<string, unknown> }[] = [];
    const supabase = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        llamadas.push({ fn, args });
        return respuesta;
      },
    } as unknown as SupabaseClient;
    return { supabase, llamadas };
  };

  it("llama a la RPC de la ficha con su id y devuelve solo los campos permitidos", async () => {
    const { supabase, llamadas } = cliente({
      data: [{ id: "a", entity_type: "nomina_employee_photo", event_type: "photo_set", occurred_at: "2026-11-17T10:00:00Z", actor_id: "u1", next_cursor: null, payload: { x: 1 } }],
      error: null,
    });
    const r = await eventosDe(supabase, "e1");
    expect(llamadas).toEqual([{ fn: "nomina_employee_timeline_events", args: { p_employee_id: "e1", p_cursor: null, p_limit: 50 } }]);
    expect(r).toEqual({
      ok: true,
      data: [{ id: "a", entity_type: "nomina_employee_photo", event_type: "photo_set", occurred_at: "2026-11-17T10:00:00Z", actor_id: "u1" }],
    });
  });

  it.each(["PGRST202", "42883"])("sin la migración aplicada (%s) no hay eventos y no es un error", async (code) => {
    expect(await eventosDe(cliente({ data: null, error: { code } }).supabase, "e1")).toEqual({ ok: true, data: [] });
  });

  it.each(["42501", "P0002", "57014", undefined])("cualquier otro error (%s) sí es un error", async (code) => {
    expect(await eventosDe(cliente({ data: null, error: { code, message: "x" } }).supabase, "e1")).toEqual({ ok: false });
  });
});

describe("candidatosDeEnlace", () => {
  type Tabla = "user_tenants" | "nomina_employees" | "client_users" | "user_profiles";
  function admin(opts: { fallan?: Tabla[]; correoFalla?: string[] } = {}) {
    const filtros: Record<string, [string, unknown][]> = {};
    const datos: Record<Tabla, unknown[]> = {
      user_tenants: [{ user_id: "u1" }, { user_id: "u2" }, { user_id: "u3" }, { user_id: "u4" }],
      nomina_employees: [{ auth_user_id: "u2" }],
      client_users: [{ auth_user_id: "u3" }],
      user_profiles: [{ user_id: "u1", first_name: "Zeta", last_name: "Uno" }],
    };
    const client = {
      from: (tabla: Tabla) => {
        filtros[tabla] = [];
        const respuesta = opts.fallan?.includes(tabla)
          ? { data: null, error: { message: "falló " + tabla } }
          : { data: datos[tabla], error: null };
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: (c: string, v: unknown) => (filtros[tabla]!.push([c, v]), chain),
          in: (c: string, v: unknown) => (filtros[tabla]!.push([c, v]), chain),
          is: (c: string, v: unknown) => (filtros[tabla]!.push([c, v]), chain),
          limit: () => chain,
          then: (ok: (v: unknown) => unknown) => Promise.resolve(respuesta).then(ok),
        };
        return chain;
      },
      auth: {
        admin: {
          getUserById: async (id: string) =>
            opts.correoFalla?.includes(id)
              ? { data: null, error: { message: "x" } }
              : { data: { user: { email: `${id}@example.test` } }, error: null },
        },
      },
    } as unknown as SupabaseClient;
    return { client, filtros };
  }

  it("ofrece solo miembros activos del tenant sin ficha y que no son clientes del portal", async () => {
    const { client, filtros } = admin();
    const r = await candidatosDeEnlace(client, "t1");
    expect(r.ok && r.data.map((c) => c.userId)).toEqual(["u4", "u1"]); // por nombre: «u4@…» antes que «Zeta Uno»
    expect(r.ok && r.data.find((c) => c.userId === "u1")).toEqual({ userId: "u1", nombre: "Zeta Uno", correoAcceso: "u1@example.test" });
    expect(filtros.user_tenants).toEqual([["tenant_id", "t1"], ["disabled_at", null]]);
    expect(filtros.nomina_employees).toContainEqual(["deleted_at", null]);
  });

  it.each(["user_tenants", "nomina_employees", "client_users", "user_profiles"] as Tabla[])(
    "si falla la lectura de %s no ofrece a nadie (falla cerrado)",
    async (tabla) => {
      expect(await candidatosDeEnlace(admin({ fallan: [tabla] }).client, "t1")).toEqual({ ok: false });
    },
  );

  it("si no se puede leer el correo de acceso, el candidato sale sin correo y no rompe la lista", async () => {
    const r = await candidatosDeEnlace(admin({ correoFalla: ["u4"] }).client, "t1");
    expect(r.ok && r.data.find((c) => c.userId === "u4")).toEqual({ userId: "u4", nombre: "Usuario sin nombre", correoAcceso: null });
  });
});

describe("solicitudes de registro · minimización (N2)", () => {
  const FILA: EmployeeRegistration = {
    id: "r1",
    tenant_id: "t1",
    invite_id: "i1",
    full_name: "Candidata Sintética",
    national_id: "V00000000",
    birth_date: "1990-05-05",
    phone: "0000-0000000",
    email: "candidata@example.test",
    cargo: "Analista",
    start_date: "2026-12-01",
    bank_name: "Banco de prueba",
    bank_account_type: "corriente",
    bank_account: "0102 0000 00 0000009876",
    status: "pendiente",
    reviewed_by: null,
    reviewed_at: null,
    employee_id: null,
    rejection_reason: null,
    created_at: "2026-11-17T00:00:00Z",
    updated_at: "2026-11-17T00:00:00Z",
  };

  it("la lista no pide a la base ni la cédula ni la cuenta", () => {
    const columnas = REG_LIST_COLUMNS.split(",").map((c) => c.trim());
    expect(columnas.sort()).toEqual(["created_at", "email", "full_name", "id", "status"]);
  });

  it("listRegistrations selecciona esas columnas y devuelve solo esos campos aunque la base mande de más", async () => {
    let pedido = "";
    const supabase = {
      from: () => ({
        select: (cols: string) => {
          pedido = cols;
          return { order: async () => ({ data: [FILA], error: null }) };
        },
      }),
    } as unknown as SupabaseClient;
    const filas = await listRegistrations(supabase);
    expect(pedido).toBe(REG_LIST_COLUMNS);
    expect(Object.keys(filas[0]!).sort()).toEqual(["created_at", "email", "full_name", "id", "status"]);
    const texto = JSON.stringify(filas);
    for (const sensible of ["V00000000", "9876", "0000-0000000", "1990-05-05", "Banco de prueba"]) {
      expect(texto).not.toContain(sensible);
    }
  });

  it("toRegistrationListItem no deja pasar un campo nuevo de la fila", () => {
    expect(toRegistrationListItem({ ...FILA, campo_nuevo: "x" } as EmployeeRegistration)).not.toHaveProperty("campo_nuevo");
  });

  it("la revisión lleva la cédula y la cuenta enmascarada; el número completo no viaja", () => {
    const vista = toRegistrationReview(FILA);
    expect(vista.national_id).toBe("V00000000");
    expect(vista.bank_account_masked).toBe("•••• 9876");
    expect(vista).not.toHaveProperty("bank_account");
    expect(vista).not.toHaveProperty("birth_date");
    expect(vista).not.toHaveProperty("tenant_id");
    expect(JSON.stringify(vista)).not.toContain("0000009876");
  });
});
