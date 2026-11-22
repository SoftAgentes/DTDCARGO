// @vitest-environment node
/**
 * SDD-0652 fase 2 · las acciones de la ficha: enlazar, quitar enlace, foto y
 * «Mostrar» la cuenta.
 *
 * El control de rol es el real (`getFichaEmpleadoAccess`) con `getStudioAccess`
 * doblado. La base está doblada: la RLS y las RPC se miden en el contrato de la
 * migración 0555. Aquí se mide lo que la acción decide ANTES de llamar a la
 * base, qué le manda y qué hace cuando la base rechaza. Datos sintéticos.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "admin" as string | null,
  tenantId: "t1" as string | null,
  editDenial: null as string | null,
  rpcs: [] as { fn: string; args: Record<string, unknown> }[],
  rpcResp: { data: null, error: null } as { data: unknown; error: { code?: string; message?: string } | null },
  ficha: { id: "", employee_code: "EMP-0007", status: "activo" } as Record<string, unknown> | null,
  fichaError: false,
  fichaFiltros: [] as [string, unknown][],
  subidas: [] as { bucket: string; ruta: string; bytes: number; opts: Record<string, unknown> }[],
  subidaError: false,
  borradas: [] as string[],
  procesada: { ok: true, webp: Buffer.from("webp-sintetico") } as { ok: true; webp: Buffer } | { ok: false; error: string },
  procesos: 0,
  revalidadas: [] as string[],
}));

vi.mock("next/cache", () => ({ revalidatePath: (p: string) => void state.revalidadas.push(p) }));
vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => state.editDenial,
  getStudioAccess: async () => ({
    role: state.role,
    tenantId: state.tenantId,
    userId: "u-mira",
    warehouseScope: "all",
    overrides: {},
    grants: {},
  }),
}));
vi.mock("@/lib/db/server", () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      state.rpcs.push({ fn, args });
      return state.rpcResp;
    },
    from: () => {
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: (c: string, v: unknown) => (state.fichaFiltros.push([c, v]), chain),
        is: (c: string, v: unknown) => (state.fichaFiltros.push([c, v]), chain),
        maybeSingle: async () =>
          state.fichaError ? { data: null, error: { message: "x" } } : { data: state.ficha, error: null },
      };
      return chain;
    },
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: async (ruta: string, cuerpo: Buffer, opts: Record<string, unknown>) => {
          state.subidas.push({ bucket, ruta, bytes: cuerpo.length, opts });
          return { error: state.subidaError ? { message: "x" } : null };
        },
        remove: async (rutas: string[]) => {
          state.borradas.push(...rutas);
          return { error: null };
        },
      }),
    },
  }),
}));
vi.mock("@/lib/studio/nomina/employee-photo", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/studio/nomina/employee-photo")>();
  return {
    ...orig,
    // El procesado real (sharp, EXIF) se mide en employee-photo.test.ts.
    procesarFotoEmpleado: async () => {
      state.procesos += 1;
      return state.procesada;
    },
  };
});

import {
  linkEmployeeUserAction,
  removeEmployeePhotoAction,
  revealBankAccountAction,
  unlinkEmployeeUserAction,
  uploadEmployeePhotoAction,
} from "../[codigo]/actions";

const T1 = "10000000-0000-4000-8000-000000000001";
const E1 = "30000000-0000-4000-8000-000000000001";
const U3 = "20000000-0000-4000-8000-000000000003";
const SIN_PERMISO = "No tienes permiso para hacer esto en la ficha.";

function foto(bytes = 100, nombre = "foto.jpg", tipo = "image/jpeg"): FormData {
  const fd = new FormData();
  fd.set("foto", new File([new Uint8Array(bytes)], nombre, { type: tipo }));
  return fd;
}

beforeEach(() => {
  state.role = "admin";
  state.tenantId = T1;
  state.editDenial = null;
  state.rpcs = [];
  state.rpcResp = { data: null, error: null };
  state.ficha = { id: E1, employee_code: "EMP-0007", status: "activo" };
  state.fichaError = false;
  state.fichaFiltros = [];
  state.subidas = [];
  state.subidaError = false;
  state.borradas = [];
  state.procesada = { ok: true, webp: Buffer.from("webp-sintetico") };
  state.procesos = 0;
  state.revalidadas = [];
});

describe("la puerta del módulo va primero en todas", () => {
  it("si el módulo niega la edición, ninguna acción llama a la base ni al bucket", async () => {
    state.editDenial = "No tienes permiso para editar Nómina.";
    const resultados = await Promise.all([
      linkEmployeeUserAction(E1, U3, "Es la misma persona"),
      unlinkEmployeeUserAction(E1, "Ya no corresponde"),
      uploadEmployeePhotoAction(E1, foto()),
      removeEmployeePhotoAction(E1),
      revealBankAccountAction(E1, "Pago de la quincena"),
    ]);
    for (const r of resultados) expect(r).toEqual({ error: "No tienes permiso para editar Nómina." });
    expect(state.rpcs).toEqual([]);
    expect(state.subidas).toEqual([]);
    expect(state.procesos).toBe(0);
  });
});

describe("enlazar y quitar el enlace: solo admin", () => {
  it.each(["accounting", "commercial", "support", null])("con rol %s no se enlaza ni se desenlaza, y la base no se toca", async (role) => {
    state.role = role;
    expect(await linkEmployeeUserAction(E1, U3, "Es la misma persona")).toEqual({ error: SIN_PERMISO });
    expect(await unlinkEmployeeUserAction(E1, "Ya no corresponde")).toEqual({ error: SIN_PERMISO });
    expect(state.rpcs).toEqual([]);
  });

  it("admin enlaza: manda ficha, usuario y el motivo sin espacios sobrantes, y revalida lista y ficha", async () => {
    expect(await linkEmployeeUserAction(E1, U3, "  Es la misma persona  ")).toEqual({ ok: true });
    expect(state.rpcs).toEqual([
      { fn: "nomina_link_employee_user", args: { p_employee_id: E1, p_user_id: U3, p_reason: "Es la misma persona" } },
    ]);
    expect(state.revalidadas).toEqual(["/studio/nomina", "/studio/nomina/empleados/EMP-0007"]);
  });

  it.each([
    ["sin usuario", E1, "", "Es la misma persona"],
    ["usuario que no es uuid", E1, "u3", "Es la misma persona"],
    ["ficha que no es uuid", "e1", U3, "Es la misma persona"],
    ["motivo de 3 caracteres", E1, U3, "abc"],
    ["motivo en blanco", E1, U3, "     "],
    ["motivo de 501 caracteres", E1, U3, "a".repeat(501)],
  ])("no llama a la base con %s", async (_caso, emp, usr, motivo) => {
    const r = await linkEmployeeUserAction(emp, usr, motivo);
    expect("error" in r).toBe(true);
    expect(state.rpcs).toEqual([]);
  });

  it.each([
    ["23505", "nomina: ese usuario ya está enlazado a otra ficha", "Ese usuario ya está enlazado a otra ficha."],
    ["22023", "nomina: esa cuenta es de un cliente del portal", "Esa cuenta es de un cliente del portal."],
    ["42501", "nomina: no tienes permiso para esta ficha", SIN_PERMISO],
    ["P0002", "nomina: la ficha no existe", "La ficha no existe o ya no está disponible."],
    ["PGRST202", "Could not find the function", "Esta función todavía no está disponible. Avísale a quien administra el sistema."],
    ["57014", "canceling statement due to statement timeout", "No se pudo enlazar. Intenta de nuevo."],
  ])("si la base rechaza con %s, dice algo que se entiende y no revalida", async (code, message, esperado) => {
    state.rpcResp = { data: null, error: { code, message } };
    expect(await linkEmployeeUserAction(E1, U3, "Es la misma persona")).toEqual({ error: esperado });
    expect(state.revalidadas).toEqual([]);
  });

  it("admin quita el enlace con su motivo", async () => {
    expect(await unlinkEmployeeUserAction(E1, "Se enlazó a otra persona")).toEqual({ ok: true });
    expect(state.rpcs).toEqual([{ fn: "nomina_unlink_employee_user", args: { p_employee_id: E1, p_reason: "Se enlazó a otra persona" } }]);
    expect(await unlinkEmployeeUserAction(E1, "no")).toEqual({ error: "Escribe el motivo (entre 4 y 500 caracteres)." });
    expect(state.rpcs).toHaveLength(1);
  });
});

describe("«Mostrar» la cuenta: admin y Contabilidad, con motivo (D9)", () => {
  it.each(["admin", "accounting"])("%s recibe la cuenta que devuelve la RPC, y nada se revalida ni se guarda", async (role) => {
    state.role = role;
    state.rpcResp = { data: "00000000000000005501", error: null };
    expect(await revealBankAccountAction(E1, " Pago de la quincena ")).toEqual({ ok: true, cuenta: "00000000000000005501" });
    expect(state.rpcs).toEqual([{ fn: "nomina_reveal_bank_account", args: { p_employee_id: E1, p_reason: "Pago de la quincena" } }]);
    expect(state.revalidadas).toEqual([]);
  });

  it.each(["commercial", "support", "operations", null])("con rol %s no se pide la cuenta", async (role) => {
    state.role = role;
    expect(await revealBankAccountAction(E1, "Pago de la quincena")).toEqual({ error: SIN_PERMISO });
    expect(state.rpcs).toEqual([]);
  });

  it("sin motivo no se pide la cuenta", async () => {
    expect(await revealBankAccountAction(E1, "")).toEqual({ error: "Escribe el motivo (entre 4 y 500 caracteres)." });
    expect(state.rpcs).toEqual([]);
  });

  it("si la RPC falla o no devuelve texto, no sale ninguna cuenta", async () => {
    state.rpcResp = { data: "00000000000000005501", error: { code: "23503", message: "audit: entity_type inexistente o inactivo" } };
    const fallo = await revealBankAccountAction(E1, "Pago de la quincena");
    expect(fallo).toEqual({ error: "No se pudo mostrar la cuenta. Intenta de nuevo." });
    expect(JSON.stringify(fallo)).not.toContain("5501");
    state.rpcResp = { data: null, error: null };
    expect(await revealBankAccountAction(E1, "Pago de la quincena")).toEqual({ error: "No se pudo mostrar la cuenta. Intenta de nuevo." });
  });
});

describe("foto: admin y Contabilidad (D5)", () => {
  it.each(["admin", "accounting"])("%s sube: procesa, guarda en el bucket privado con ruta de tenant y ficha, y deja la referencia", async (role) => {
    state.role = role;
    expect(await uploadEmployeePhotoAction(E1, foto())).toEqual({ ok: true });
    expect(state.fichaFiltros).toEqual([["tenant_id", T1], ["id", E1], ["deleted_at", null]]);
    expect(state.subidas).toHaveLength(1);
    const subida = state.subidas[0]!;
    expect(subida.bucket).toBe("employee-photos");
    expect(subida.ruta).toMatch(new RegExp(`^${T1}/${E1}/[0-9a-f-]{36}[.]webp$`));
    expect(subida.opts).toEqual({ contentType: "image/webp", upsert: false });
    expect(subida.bytes).toBe(Buffer.from("webp-sintetico").length);
    expect(state.rpcs).toEqual([{ fn: "nomina_set_employee_photo", args: { p_employee_id: E1, p_photo_path: subida.ruta } }]);
    expect(state.borradas).toEqual([]);
    expect(state.revalidadas).toEqual(["/studio/nomina", "/studio/nomina/empleados/EMP-0007"]);
  });

  it.each(["commercial", "support", null])("con rol %s no se procesa ni se sube nada", async (role) => {
    state.role = role;
    expect(await uploadEmployeePhotoAction(E1, foto())).toEqual({ error: SIN_PERMISO });
    expect(await removeEmployeePhotoAction(E1)).toEqual({ error: SIN_PERMISO });
    expect(state.procesos).toBe(0);
    expect(state.subidas).toEqual([]);
    expect(state.rpcs).toEqual([]);
  });

  it("sin archivo, vacío o de más de 2 MB: no se lee la ficha ni se sube", async () => {
    expect(await uploadEmployeePhotoAction(E1, new FormData())).toEqual({ error: "Elige una foto." });
    expect(await uploadEmployeePhotoAction(E1, foto(0))).toEqual({ error: "Elige una foto." });
    expect(await uploadEmployeePhotoAction(E1, foto(2 * 1024 * 1024 + 1))).toEqual({ error: "La foto pesa más de 2 MB." });
    expect(state.fichaFiltros).toEqual([]);
    expect(state.subidas).toEqual([]);
  });

  it("ficha de otro tenant, borrada o inexistente: no se sube", async () => {
    state.ficha = null;
    expect(await uploadEmployeePhotoAction(E1, foto())).toEqual({ error: "La ficha no existe o ya no está disponible." });
    expect(state.procesos).toBe(0);
    expect(state.subidas).toEqual([]);
  });

  it("si la ficha no se pudo leer, se dice y no se sube", async () => {
    state.fichaError = true;
    expect(await uploadEmployeePhotoAction(E1, foto())).toEqual({ error: "No se pudo leer la ficha. Intenta de nuevo." });
    expect(state.subidas).toEqual([]);
  });

  it("en una ficha egresada la foto no se cambia", async () => {
    state.ficha = { id: E1, employee_code: "EMP-0007", status: "egresado" };
    expect(await uploadEmployeePhotoAction(E1, foto())).toEqual({ error: "La foto de una ficha egresada no se cambia." });
    expect(state.procesos).toBe(0);
    expect(state.subidas).toEqual([]);
  });

  it("si el archivo no es una imagen válida, el servidor lo rechaza y no sube", async () => {
    state.procesada = { ok: false, error: "El archivo no es una imagen JPG, PNG o WebP." };
    expect(await uploadEmployeePhotoAction(E1, foto(100, "foto.jpg", "image/jpeg"))).toEqual({
      error: "El archivo no es una imagen JPG, PNG o WebP.",
    });
    expect(state.subidas).toEqual([]);
    expect(state.rpcs).toEqual([]);
  });

  it("si el bucket rechaza la subida, no se cambia la referencia", async () => {
    state.subidaError = true;
    expect(await uploadEmployeePhotoAction(E1, foto())).toEqual({ error: "No se pudo guardar la foto. Intenta de nuevo." });
    expect(state.rpcs).toEqual([]);
  });

  it("si la referencia no se pudo cambiar, el archivo recién subido se borra y no se revalida", async () => {
    state.rpcResp = { data: null, error: { code: "42501", message: "nomina: no tienes permiso para esta ficha" } };
    expect(await uploadEmployeePhotoAction(E1, foto())).toEqual({ error: SIN_PERMISO });
    expect(state.borradas).toEqual([state.subidas[0]!.ruta]);
    expect(state.revalidadas).toEqual([]);
  });

  it("quitar la foto manda la referencia en null y no toca el bucket", async () => {
    expect(await removeEmployeePhotoAction(E1)).toEqual({ ok: true });
    expect(state.rpcs).toEqual([{ fn: "nomina_set_employee_photo", args: { p_employee_id: E1, p_photo_path: null } }]);
    expect(state.borradas).toEqual([]);
    expect(state.subidas).toEqual([]);
  });
});
