// @vitest-environment node
/**
 * SDD-0566 · Las acciones de contabilidad con un período cerrado: piden la
 * excepción, la usan por la RPC de 0493, dicen cada motivo en palabras de la
 * persona, vuelven al mensaje de antes sin la 0493 y nunca dejan la superclave
 * en un log ni en una respuesta. Lecturas sobre el doble de PostgREST (aplica
 * los filtros); `rpc` y `upsert` son espías.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

const estado = vi.hoisted(() => ({
  tablas: {} as Record<string, Record<string, unknown>[]>,
  rpc: null as unknown as Rpc,
  llamadas: [] as { fn: string; args: Record<string, unknown> }[],
  upserts: [] as { tabla: string; fila: Record<string, unknown> }[],
}));

vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    const { client } = dobleListados(estado.tablas);
    return {
      from: (t: string) => ({
        ...client.from(t),
        upsert: async (fila: Record<string, unknown>) => {
          estado.upserts.push({ tabla: t, fila });
          return { error: null };
        },
      }),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        estado.llamadas.push({ fn, args });
        return estado.rpc(fn, args);
      },
    };
  },
}));

vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => null,
  tenantAdminGate: async () => ({ ok: true, tenantId: "t1", userId: "u1" }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import {
  createJournalEntry,
  fijarSuperclaveAction,
  postEntry,
  restablecerSuperclaveAction,
  setClosingModeAction,
  softDeleteEntry,
  voidEntry,
} from "../actions";

const CLAVE = "Clave-Secreta-77";
const ESTADO_OK = {
  data: { closing_date: "2026-01-31", closing_mode: "superclave", superclave_definida: true, bloqueada_hasta: null },
  error: null,
};
const AVISO =
  "Este período ya cerró contablemente (cierre al 31/01/2026). Para cambiarlo, ingresa la superclave y el motivo.";

function asiento(id: string, code: string, status: string, entry_date: string): Fila {
  return { id, tenant_id: "t1", entry_code: code, status, source: "manual", entry_date, deleted_at: null };
}

/** Las RPC de operación responden `ok` salvo que el caso diga otra cosa. */
function rpcCon(respuestas: Record<string, { data: unknown; error: unknown }> = {}): Rpc {
  return async (fn) => {
    if (fn === "estado_cierre_contable") return respuestas[fn] ?? ESTADO_OK;
    return respuestas[fn] ?? { data: { ok: true, entry_id: "nuevo", entry_code: "A-2026-0099" }, error: null };
  };
}

const operaciones = () => estado.llamadas.filter((l) => l.fn !== "estado_cierre_contable");
let consola: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  estado.llamadas = [];
  estado.upserts = [];
  estado.rpc = rpcCon();
  estado.tablas = {
    user_tenants: [{ tenant_id: "t1" }],
    accounting_settings: [{ tenant_id: "t1", closing_date: "2026-01-31", locked_by: null, locked_at: null, updated_at: null }],
    journal_entries: [
      asiento("e-asentado", "A-2026-0001", "asentado", "2026-01-10"),
      asiento("e-borrador", "A-2026-0002", "borrador", "2026-01-12"),
    ],
    accounts: [
      { id: "caja", tenant_id: "t1", code: "1.1.1", name: "Caja", type: "A", is_postable: true },
      { id: "ventas", tenant_id: "t1", code: "4.1", name: "Ventas", type: "I", is_postable: true },
    ],
  };
  consola = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // La superclave no aparece en ningún log de ninguna prueba.
  const logs = JSON.stringify(consola.mock.calls);
  expect(logs).not.toContain(CLAVE);
  consola.mockRestore();
});

describe("SDD-0566 · asentar, anular y eliminar en período cerrado", () => {
  it("sin la excepción devuelve el aviso y no llama a ninguna RPC de operación", async () => {
    const r = await postEntry("e-borrador");
    expect(r).toEqual({
      error: AVISO,
      cierre: { closingDate: "2026-01-31", modo: "superclave", superclaveDefinida: true },
    });
    expect(operaciones()).toEqual([]);
  });

  it("con la excepción asienta por la RPC, con la clave y el motivo", async () => {
    const r = await postEntry("e-borrador", { superclave: CLAVE, motivo: "  Faltaba asentar  " });
    expect(r).toEqual({ ok: true });
    expect(operaciones()).toEqual([
      { fn: "asentar_asiento_en_cierre", args: { p_entry_id: "e-borrador", p_clave: CLAVE, p_motivo: "Faltaba asentar" } },
    ]);
  });

  it("la clave mala se dice con su consecuencia, y el aviso sigue para reintentar", async () => {
    estado.rpc = rpcCon({ asentar_asiento_en_cierre: { data: { ok: false, motivo: "incorrecta" }, error: null } });
    const r = await postEntry("e-borrador", { superclave: CLAVE, motivo: "Faltaba asentar" });
    expect(r.ok).toBeUndefined();
    expect(r.error).toBe(
      "La superclave no es correcta. Revísala e intenta de nuevo: cada 5 intentos fallidos se bloquea, y cada bloqueo dura el doble que el anterior.",
    );
    expect(r.cierre?.closingDate).toBe("2026-01-31");
  });

  it("un error de la base no se muestra: mensaje genérico y log sin la clave", async () => {
    estado.rpc = rpcCon({
      eliminar_borrador_en_cierre: { data: null, error: { code: "XX000", message: "internal: relation accounting_closing_secrets" } },
    });
    const r = await softDeleteEntry("e-borrador", { superclave: CLAVE, motivo: "Borrador duplicado" });
    expect(r.error).toBe("No se pudo eliminar el borrador. Intenta de nuevo.");
    expect(r.error).not.toContain("accounting_closing_secrets");
  });

  it("los mensajes propios de la 0493 (22023 o 42501, con hint dtd-cierre) sí se muestran", async () => {
    estado.rpc = rpcCon({
      anular_asiento_en_cierre: {
        data: null,
        error: { code: "42501", message: "No tienes permiso para editar la contabilidad.", hint: "dtd-cierre" },
      },
    });
    const r = await voidEntry("e-asentado", "Corrección de enero", CLAVE);
    expect(r.error).toBe("No tienes permiso para editar la contabilidad.");
  });

  it("un 42501 nativo de Postgres, sin el hint, no se muestra (ERR-01)", async () => {
    estado.rpc = rpcCon({
      anular_asiento_en_cierre: {
        data: null,
        error: { code: "42501", message: "permission denied for function anular_asiento_en_cierre" },
      },
    });
    const r = await voidEntry("e-asentado", "Corrección de enero", CLAVE);
    expect(r.error).toBe("No se pudo anular el asiento. Intenta de nuevo.");
    expect(r.error).not.toContain("permission denied");
  });

  it("anular: el primer intento pide la excepción; el segundo usa el motivo de la anulación", async () => {
    const primero = await voidEntry("e-asentado", "Corrección de enero");
    expect(primero.cierre).toBeDefined();
    expect(operaciones()).toEqual([]);
    const segundo = await voidEntry("e-asentado", "Corrección de enero", CLAVE);
    expect(segundo).toEqual({ ok: true });
    expect(operaciones()).toEqual([
      { fn: "anular_asiento_en_cierre", args: { p_entry_id: "e-asentado", p_clave: CLAVE, p_motivo: "Corrección de enero" } },
    ]);
  });

  it("en modo advertencia la superclave va vacía", async () => {
    estado.rpc = rpcCon({
      estado_cierre_contable: { data: { closing_date: "2026-01-31", closing_mode: "advertencia", superclave_definida: false }, error: null },
    });
    const r = await softDeleteEntry("e-borrador", { superclave: null, motivo: "Visto el aviso" });
    expect(r).toEqual({ ok: true });
    expect(operaciones()[0].args.p_clave).toBeNull();
  });

  it("sin la 0493 (la RPC de estado no existe) vuelve al mensaje de antes, sin excepción", async () => {
    estado.rpc = rpcCon({ estado_cierre_contable: { data: null, error: { code: "PGRST202", message: "Could not find the function" } } });
    const r = await postEntry("e-borrador", { superclave: CLAVE, motivo: "Faltaba asentar" });
    expect(r).toEqual({ error: "Período contable cerrado al 2026-01-31: no puedes asentar en período cerrado." });
    expect(operaciones()).toEqual([]);
  });
});

describe("SDD-0566 · crear un asiento con fecha cerrada", () => {
  function formulario(extra: Record<string, string> = {}): FormData {
    const f = new FormData();
    f.set("entry_date", "2026-01-20");
    f.set("memo", "Ajuste de enero");
    f.set("post_on_create", "true");
    f.set(
      "lines",
      JSON.stringify([
        { account_id: "caja", debit: 75, credit: 0, line_memo: null },
        { account_id: "ventas", debit: 0, credit: 75, line_memo: null },
      ]),
    );
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  }

  it("sin los campos de la excepción devuelve el aviso", async () => {
    const r = await createJournalEntry({}, formulario());
    expect(r.cierre).toBeDefined();
    expect(r.error).toBe(AVISO);
    expect(operaciones()).toEqual([]);
  });

  it("con la superclave y el motivo crea por la RPC, con sus líneas y si se asienta", async () => {
    const r = await createJournalEntry({}, formulario({ cierre_superclave: CLAVE, cierre_motivo: "Ajuste que faltaba" }));
    expect(r).toEqual({ ok: true, createdCode: "A-2026-0099" });
    expect(operaciones()).toEqual([
      {
        fn: "crear_asiento_en_cierre",
        args: {
          p_entrada: {
            entry_date: "2026-01-20",
            memo: "Ajuste de enero",
            asentar: true,
            lineas: [
              { account_id: "caja", debit: 75, credit: 0, line_memo: null },
              { account_id: "ventas", debit: 0, credit: 75, line_memo: null },
            ],
          },
          p_clave: CLAVE,
          p_motivo: "Ajuste que faltaba",
        },
      },
    ]);
  });
});

describe("SDD-0566 · el modo y la superclave (admin)", () => {
  it("la confirmación tiene que coincidir y la superclave tener al menos 8 caracteres, antes de llamar a la base", async () => {
    expect((await fijarSuperclaveAction("", CLAVE, "otra-cosa-77")).error).toBe(
      "La confirmación no coincide con la superclave nueva.",
    );
    expect((await fijarSuperclaveAction("", "corta", "corta")).error).toBe(
      "La superclave debe tener entre 8 y 64 caracteres (con muchas tildes o eñes, menos).",
    );
    // bcrypt usa solo 72 bytes: 40 eñes son 80 bytes y se rechazan aunque sean 40 caracteres.
    const enes = "ñ".repeat(40);
    expect((await fijarSuperclaveAction("", enes, enes)).error).toContain("entre 8 y 64 caracteres");
    expect(estado.llamadas).toEqual([]);
  });

  it("definirla manda la actual vacía como null", async () => {
    estado.rpc = async () => ({ data: { ok: true }, error: null });
    expect(await fijarSuperclaveAction("", CLAVE, CLAVE)).toEqual({ ok: true });
    expect(estado.llamadas).toEqual([{ fn: "fijar_superclave_de_cierre", args: { p_actual: null, p_nueva: CLAVE } }]);
  });

  it("de la RPC de la superclave se muestra solo el mensaje propio (con hint), no el 42501 nativo", async () => {
    estado.rpc = async () => ({
      data: null,
      error: { code: "42501", message: "Solo el admin del tenant define la superclave del cierre.", hint: "dtd-cierre" },
    });
    expect((await fijarSuperclaveAction("", CLAVE, CLAVE)).error).toBe("Solo el admin del tenant define la superclave del cierre.");
    estado.rpc = async () => ({
      data: null,
      error: { code: "42501", message: "permission denied for function fijar_superclave_de_cierre" },
    });
    expect((await fijarSuperclaveAction("", CLAVE, CLAVE)).error).toBe("No se pudo guardar la superclave. Intenta de nuevo.");
  });

  it("cambiarla con la actual mala dice que no es correcta", async () => {
    estado.rpc = async () => ({ data: { ok: false, motivo: "incorrecta" }, error: null });
    const r = await fijarSuperclaveAction("mala-actual-1", CLAVE, CLAVE);
    expect(r.error).toBe("La superclave actual no es correcta. Cada 5 intentos fallidos se bloquea, y cada bloqueo dura el doble que el anterior.");
  });

  it("restablecer pide un motivo de al menos 10 caracteres", async () => {
    expect((await restablecerSuperclaveAction(CLAVE, CLAVE, "corto")).error).toBe(
      "Indica el motivo del restablecimiento (al menos 10 caracteres).",
    );
    expect(estado.llamadas).toEqual([]);
  });

  it("el modo solo acepta sus dos valores y se guarda sin tocar la fecha", async () => {
    expect((await setClosingModeAction("cualquiera" as "superclave")).error).toBe("Elige un modo del cierre.");
    expect(await setClosingModeAction("advertencia")).toEqual({ ok: true });
    expect(estado.upserts).toEqual([
      { tabla: "accounting_settings", fila: { tenant_id: "t1", closing_mode: "advertencia", updated_by: "u1" } },
    ]);
  });
});
