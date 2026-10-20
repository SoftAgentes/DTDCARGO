/**
 * SDD-0567 · Las acciones de Fidelización sin UPDATE directo de referrals.
 *
 * Acreditar a mano y avanzar de paso van por las RPC de la migración 0494
 * (`acreditar_referido_con_motivo` y `avanzar_referido`): la regla vive en la
 * base y acá se prueba lo que hace la acción antes y después de llamarla. Solo se
 * muestran los mensajes propios de la 0494 (hint 'dtd-referidos'), nunca un error
 * nativo de Postgres (ERR-01). Lo que hace la base lo prueba el contrato
 * `supabase/tests/0494_credito_referido_candado.test.sql`.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/studio/rbac-guard", () => ({ moduleEditDenial: vi.fn(async () => null) }));

type Respuesta = { data: unknown; error: { code?: string; message?: string; hint?: string } | null };
let llamadas: { fn: string; args?: Record<string, unknown> }[] = [];
let escrituras: string[] = [];
let respuesta: Respuesta = { data: { ok: true }, error: null };

vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      llamadas.push({ fn, args });
      return respuesta;
    },
    from: (table: string) => ({
      update: () => {
        escrituras.push(table);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

const { accreditReferral, updateReferralStatus } = await import("../actions");

beforeEach(() => {
  llamadas = [];
  escrituras = [];
  respuesta = { data: { ok: true }, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("accreditReferral · acreditar sin venta (solo admin, con motivo)", () => {
  it("llama a la RPC con el motivo, sin UPDATE directo", async () => {
    expect(await accreditReferral("ref-1", "  Venta acordada fuera del sistema  ")).toEqual({ ok: true });
    expect(llamadas).toEqual([
      { fn: "acreditar_referido_con_motivo", args: { p_referral_id: "ref-1", p_motivo: "Venta acordada fuera del sistema" } },
    ]);
    expect(escrituras).toEqual([]);
  });

  it("un motivo corto no llega a la base", async () => {
    expect(await accreditReferral("ref-1", "corto")).toEqual({ error: "El motivo debe tener entre 10 y 1000 caracteres." });
    expect(llamadas).toEqual([]);
  });

  it("muestra el mensaje propio de la base (hint dtd-referidos)", async () => {
    respuesta = {
      data: null,
      error: { code: "42501", message: "Solo el admin acredita un referido sin venta.", hint: "dtd-referidos" },
    };
    expect(await accreditReferral("ref-1", "Venta acordada fuera del sistema")).toEqual({
      error: "Solo el admin acredita un referido sin venta.",
    });
  });

  it("un 42501 nativo, sin el hint, no se muestra (ERR-01)", async () => {
    respuesta = { data: null, error: { code: "42501", message: "permission denied for function acreditar_referido_con_motivo" } };
    const r = await accreditReferral("ref-1", "Venta acordada fuera del sistema");
    expect(r).toEqual({ error: "No se pudo acreditar el referido. Intenta de nuevo." });
  });

  it("sin la 0494 (la RPC no existe) devuelve el mensaje genérico", async () => {
    respuesta = { data: null, error: { code: "PGRST202", message: "Could not find the function" } };
    expect(await accreditReferral("ref-1", "Venta acordada fuera del sistema")).toEqual({
      error: "No se pudo acreditar el referido. Intenta de nuevo.",
    });
  });
});

describe("updateReferralStatus · avanzar a mano", () => {
  it("a registrado, con el markbox del cliente", async () => {
    expect(await updateReferralStatus("ref-1", "registrado", " DTD-5452 ")).toEqual({ ok: true });
    expect(llamadas).toEqual([
      { fn: "avanzar_referido", args: { p_referral_id: "ref-1", p_estado: "registrado", p_markbox: "DTD-5452" } },
    ]);
    expect(escrituras).toEqual([]);
  });

  it("a registrado sin markbox no llega a la base", async () => {
    expect(await updateReferralStatus("ref-1", "registrado", "  ")).toEqual({
      error: "Para marcarlo registrado, indica el markbox de un cliente activo.",
    });
    expect(llamadas).toEqual([]);
  });

  it("a primer embarque, sin markbox", async () => {
    expect(await updateReferralStatus("ref-1", "primer-embarque")).toEqual({ ok: true });
    expect(llamadas[0].args).toEqual({ p_referral_id: "ref-1", p_estado: "primer-embarque", p_markbox: null });
  });

  it("acreditar o aplicar no son pasos que se marquen", async () => {
    expect(await updateReferralStatus("ref-1", "acreditado")).toEqual({ error: "Ese paso no se marca a mano." });
    expect(await updateReferralStatus("ref-1", "aplicado")).toEqual({ error: "Ese paso no se marca a mano." });
    expect(llamadas).toEqual([]);
  });

  it("un error de la base sin el hint no se muestra", async () => {
    respuesta = { data: null, error: { code: "XX000", message: "internal: relation referrals" } };
    const r = await updateReferralStatus("ref-1", "primer-embarque");
    expect(r).toEqual({ error: "No se pudo cambiar el estado. Intenta de nuevo." });
  });
});
