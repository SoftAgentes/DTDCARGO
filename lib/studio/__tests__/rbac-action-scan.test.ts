// @vitest-environment node
/**
 * Pruebas del analizador de gates por acción — SDD-0500.
 *
 * El contrato de RBAC vale lo que valga ESTE analizador: si acepta un guard que
 * no domina, el contrato queda en verde con la puerta abierta, que es
 * exactamente el estado del que esta tarea viene. Por eso cada disposición
 * INFELIZ tiene su caso: guard después del acceso, guard en la acción de al
 * lado, guard dentro de un `if`, de un `try`, de un callback, detrás de un
 * `&&`. Un fixture feliz no probaría nada.
 */
import { describe, it, expect } from "vitest";
import { scanActionsFile, type ActionReport } from "./rbac-action-scan";

const solo = (src: string, nombre: string): ActionReport => {
  const r = scanActionsFile(src).find((a) => a.name === nombre);
  if (!r) throw new Error(`el analizador no encontró ${nombre} en:\n${src}`);
  return r;
};

const CABECERA = `"use server";
import { createClient } from "@/lib/db/server";
import { moduleEditDenial, moduleEditGate, tenantAdminGate } from "@/lib/studio/rbac-guard";
`;

describe("el caso feliz y su negación", () => {
  it("guard antes del acceso → gateada", () => {
    const r = solo(
      `${CABECERA}
export async function okAction() {
  const supabase = await createClient();
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };
  await supabase.from("shipments").update({ x: 1 });
}`,
      "okAction",
    );
    expect(r.gated).toBe(true);
    expect(r.problem).toBeNull();
    expect(r.guard?.name).toBe("moduleEditDenial");
    expect(r.firstAccess?.kind).toBe("write");
  });

  it("guard DESPUÉS del acceso → no domina (el defecto 3)", () => {
    const r = solo(
      `${CABECERA}
export async function tardeAction() {
  const supabase = await createClient();
  await supabase.from("shipments").delete().eq("id", 1);
  const denial = await moduleEditDenial(supabase, "tracking");
  if (denial) return { error: denial };
}`,
      "tardeAction",
    );
    expect(r.gated).toBe(false);
    expect(r.problem).toContain("no lo domina");
  });

  it("guard en la acción de AL LADO no gatea a la vecina (el defecto 1)", () => {
    const src = `${CABECERA}
export async function conGate() {
  const supabase = await createClient();
  const d = await moduleEditDenial(supabase, "accounting");
  if (d) return { error: d };
  await supabase.from("a").insert({});
}
export async function sinGate() {
  const supabase = await createClient();
  await supabase.from("accounting_settings").upsert({});
}`;
    expect(solo(src, "conGate").gated).toBe(true);
    const abierta = solo(src, "sinGate");
    expect(abierta.gated).toBe(false);
    expect(abierta.problem).toContain("sin ningún guard");
  });

  it("guard y acceso en la MISMA línea se ordenan por offset, no por línea", () => {
    const r = solo(
      `${CABECERA}
export async function mismaLinea(supabase: any) {
  await supabase.from("a").insert({}); const d = await moduleEditDenial(supabase, "a"); if (d) return;
}`,
      "mismaLinea",
    );
    expect(r.gated).toBe(false);
    expect(r.guard?.line).toBe(r.firstAccess?.line);
  });
});

describe("un guard sólo cuenta donde se ejecuta sí o sí", () => {
  const cuerpo = (guard: string) => `${CABECERA}
export async function x(supabase: any, cond: boolean) {
  ${guard}
  await supabase.from("t").insert({});
}`;

  const NO_DOMINAN: [string, string][] = [
    ["dentro de un if", `if (cond) { const d = await moduleEditDenial(supabase, "t"); if (d) return; }`],
    ["dentro de un else", `if (cond) { return; } else { await moduleEditDenial(supabase, "t"); }`],
    ["dentro del catch", `try { cond = !cond; } catch { await moduleEditDenial(supabase, "t"); }`],
    ["dentro del finally", `try { cond = !cond; } finally { await moduleEditDenial(supabase, "t"); }`],
    ["dentro de un for", `for (const i of [1]) { await moduleEditDenial(supabase, "t"); }`],
    ["dentro de un while", `while (cond) { await moduleEditDenial(supabase, "t"); }`],
    ["dentro de un switch", `switch (cond) { case true: await moduleEditDenial(supabase, "t"); }`],
    ["dentro de un callback", `[1].forEach(async () => { await moduleEditDenial(supabase, "t"); });`],
    ["detrás de un &&", `const d = cond && (await moduleEditDenial(supabase, "t"));`],
    ["detrás de un ??", `const d = (cond as any) ?? (await moduleEditDenial(supabase, "t"));`],
    ["en una rama de ?:", `const d = cond ? await moduleEditDenial(supabase, "t") : null;`],
  ];

  for (const [donde, guard] of NO_DOMINAN) {
    it(`${donde} → NO cuenta`, () => {
      const r = solo(cuerpo(guard), "x");
      expect(r.gated).toBe(false);
      expect(r.guard).toBeNull();
    });
  }

  it("al tope de un try SÍ cuenta: domina el resto del bloque", () => {
    // Patrón real de `facturacion/payment-report-actions.ts`: el guard abre el
    // try y el catch devuelve el error. Rechazarlo forzaría a reescribir código
    // que sí gatea, que es el otro modo de mentir de un contrato.
    const r = solo(
      `${CABECERA}
export async function x(supabase: any) {
  try {
    const d = await moduleEditDenial(supabase, "t");
    if (d) return { error: d };
    await supabase.from("t").insert({});
  } catch {
    return { error: "falló" };
  }
}`,
      "x",
    );
    expect(r.gated).toBe(true);
  });

  it("en la CONDICIÓN de un if sí cuenta: se evalúa siempre", () => {
    const r = solo(cuerpo(`if (await moduleEditDenial(supabase, "t")) return { error: "no" };`), "x");
    expect(r.gated).toBe(true);
    expect(r.guard?.name).toBe("moduleEditDenial");
  });

  it("en la condición de un if con negación también cuenta", () => {
    const r = solo(
      `${CABECERA}
export async function x(supabase: any) {
  const g = await moduleEditGate(supabase, "t");
  if (!g.ok) return { error: g.denied };
  await supabase.from("t").insert({ tenant_id: g.tenantId });
}`,
      "x",
    );
    expect(r.gated).toBe(true);
  });
});

describe("un acceso cuenta esté donde esté", () => {
  const conAccesoEn = (acceso: string) => `${CABECERA}
export async function x(supabase: any, cond: boolean) {
  ${acceso}
  const d = await moduleEditDenial(supabase, "t");
  if (d) return { error: d };
}`;

  const ESCONDIDOS: [string, string][] = [
    ["dentro de un if", `if (cond) { await supabase.from("t").delete(); }`],
    ["dentro de un try", `try { await supabase.from("t").update({}); } catch {}`],
    ["dentro de un for", `for (const i of [1]) { await supabase.from("t").insert({}); }`],
    ["dentro de un callback", `await Promise.all([1].map((i) => supabase.from("t").insert({ i })));`],
    ["en una rama de ?:", `const q = cond ? supabase.from("t").delete() : null;`],
  ];

  for (const [donde, acceso] of ESCONDIDOS) {
    it(`${donde} → el guard posterior no lo domina`, () => {
      const r = solo(conAccesoEn(acceso), "x");
      expect(r.gated).toBe(false);
      expect(r.problem).toContain("no lo domina");
    });
  }
});

describe("qué es y qué no es un acceso a datos", () => {
  const sinGate = (cuerpo: string) => `${CABECERA}
export async function x(supabase: any) {
  ${cuerpo}
}`;

  it("Array.from NO es acceso a datos", () => {
    const r = solo(sinGate(`const xs = Array.from([1, 2]); return xs.length;`), "x");
    expect(r.firstAccess).toBeNull();
    // Sigue sin gate, pero por «no llama a ningún guard», no por tocar datos.
    expect(r.problem).toBe("no llama a ningún guard incondicional");
  });

  it("Buffer.from tampoco", () => {
    const r = solo(sinGate(`return Buffer.from("x", "utf8");`), "x");
    expect(r.firstAccess).toBeNull();
  });

  it("supabase.auth.getUser() NO es acceso a datos de negocio", () => {
    const r = solo(sinGate(`const { data } = await supabase.auth.getUser(); return data;`), "x");
    expect(r.firstAccess).toBeNull();
  });

  it("supabase.auth.admin.* SÍ lo es", () => {
    const r = solo(sinGate(`await supabase.auth.admin.deleteUser("u");`), "x");
    expect(r.firstAccess).toMatchObject({ kind: "write", label: "auth.admin.deleteUser" });
  });

  it("supabase.auth.updateUser() también: cambia credenciales", () => {
    // El default bajo `auth` es ESCRITURA. Lo que hay que defender es la lista
    // de exentas; si fuera al revés, cada método nuevo del SDK entraría gratis.
    const r = solo(sinGate(`await supabase.auth.updateUser({ password: "x" });`), "x");
    expect(r.firstAccess).toMatchObject({ kind: "write", label: "auth.updateUser" });
  });

  it("supabase.auth.signOut() no lo es: es la sesión de quien llama", () => {
    const r = solo(sinGate(`await supabase.auth.signOut();`), "x");
    expect(r.firstAccess).toBeNull();
  });

  it("storage.remove() es escritura: el objeto no vuelve", () => {
    const r = solo(sinGate(`await supabase.storage.from("shipment-docs").remove(["a/b"]);`), "x");
    expect(r.firstAccess).toMatchObject({ kind: "write", label: "storage…remove" });
  });

  it("storage.download() es lectura", () => {
    const r = solo(sinGate(`await supabase.storage.from("b").download("a");`), "x");
    expect(r.firstAccess?.kind).toBe("read");
  });

  it("rpc() cuenta como escritura (no se sabe qué hace adentro)", () => {
    const r = solo(sinGate(`await supabase.rpc("next_markbox", {});`), "x");
    expect(r.firstAccess).toMatchObject({ kind: "write", label: 'rpc("next_markbox")' });
  });

  it("select() es lectura e igual exige guard", () => {
    const r = solo(sinGate(`const { data } = await supabase.from("clients").select("*");`), "x");
    expect(r.firstAccess).toMatchObject({ kind: "read", label: 'from("clients").select' });
    expect(r.gated).toBe(false);
  });

  it("un .from() sin método reconocible se asume escritura", () => {
    const r = solo(sinGate(`const q = supabase.from("t"); await q;`), "x");
    expect(r.firstAccess?.kind).toBe("write");
  });
});

describe("helpers locales del archivo", () => {
  it("el guard llega a través de un helper local (patrón carrier-actions)", () => {
    const r = solo(
      `${CABECERA}
async function resolveTenantAdmin(supabase: any) {
  const gate = await tenantAdminGate(supabase, { denied: "solo admin" });
  if (!gate.ok) return { ok: false as const, error: gate.denied };
  return { ok: true as const, tenantId: gate.tenantId };
}
export async function saveCarrierAction(supabase: any) {
  const who = await resolveTenantAdmin(supabase);
  if (!who.ok) return { error: who.error };
  await supabase.from("freight_carriers").upsert({ tenant_id: who.tenantId });
}`,
      "saveCarrierAction",
    );
    expect(r.gated).toBe(true);
    expect(r.guard).toMatchObject({ name: "tenantAdminGate", viaHelper: "resolveTenantAdmin" });
  });

  it("el guard del helper se reporta en la línea del CALL SITE, no en la del helper", () => {
    const r = solo(
      `${CABECERA}
async function gate(supabase: any) {
  return await tenantAdminGate(supabase);
}
export async function x(supabase: any) {
  const g = await gate(supabase);
  if (!g.ok) return;
  await supabase.from("t").insert({});
}`,
      "x",
    );
    // El helper vive arriba; si se reportara su línea, el guard parecería
    // anterior a cualquier acceso de CUALQUIER acción del archivo.
    expect(r.guard!.line).toBeGreaterThan(r.line);
  });

  it("un helper local SIN guard no gatea nada", () => {
    const r = solo(
      `${CABECERA}
async function resolverTenant(supabase: any) {
  const { data } = await supabase.from("user_tenants").select("tenant_id").maybeSingle();
  return data?.tenant_id ?? null;
}
export async function x(supabase: any) {
  const t = await resolverTenant(supabase);
  await supabase.from("t").insert({ tenant_id: t });
}`,
      "x",
    );
    expect(r.gated).toBe(false);
    // Y el acceso que se le imputa es el del helper, en la línea de la llamada.
    expect(r.firstAccess?.label).toContain("resolverTenant→");
  });

  it("el acceso dentro de un helper local cuenta ANTES del guard posterior", () => {
    const r = solo(
      `${CABECERA}
async function leer(supabase: any) {
  return await supabase.from("t").select("*");
}
export async function x(supabase: any) {
  const filas = await leer(supabase);
  const d = await moduleEditDenial(supabase, "t");
  if (d) return { error: d };
  return filas;
}`,
      "x",
    );
    expect(r.gated).toBe(false);
    expect(r.problem).toContain("no lo domina");
  });

  it("recursión mutua entre helpers no cuelga", () => {
    const r = solo(
      `${CABECERA}
async function a(s: any): Promise<any> { return b(s); }
async function b(s: any): Promise<any> { return a(s); }
export async function x(s: any) {
  await a(s);
  await s.from("t").insert({});
}`,
      "x",
    );
    expect(r.gated).toBe(false);
  });
});

describe("qué se considera una acción", () => {
  it("una función NO exportada no es una acción", () => {
    const src = `${CABECERA}
async function interna(supabase: any) {
  await supabase.from("t").insert({});
}
export async function publica(supabase: any) {
  const d = await moduleEditDenial(supabase, "t");
  if (d) return;
  await interna(supabase);
}`;
    expect(scanActionsFile(src).map((a) => a.name)).toEqual(["publica"]);
  });

  it("una función exportada NO async no es una acción", () => {
    const src = `${CABECERA}
export function helper() { return 1; }
export async function accion(supabase: any) {
  const d = await moduleEditDenial(supabase, "t");
  if (d) return;
}`;
    expect(scanActionsFile(src).map((a) => a.name)).toEqual(["accion"]);
  });

  it("una flecha async exportada sí lo es", () => {
    const src = `${CABECERA}
export const accionFlecha = async (supabase: any) => {
  await supabase.from("t").insert({});
};`;
    const [r] = scanActionsFile(src);
    expect(r.name).toBe("accionFlecha");
    expect(r.gated).toBe(false);
  });

  it("un barrel de re-exports no declara acciones", () => {
    const src = `export { createPoAction, deletePoAction } from "@/lib/studio/purchase-orders/actions";`;
    expect(scanActionsFile(src)).toEqual([]);
  });

  it("tipos y constantes exportados no son acciones", () => {
    const src = `${CABECERA}
export type State = { ok?: boolean };
export const MAX = 10;
export async function accion(supabase: any) {
  const d = await moduleEditDenial(supabase, "t");
  if (d) return;
}`;
    expect(scanActionsFile(src).map((a) => a.name)).toEqual(["accion"]);
  });
});

describe("gate de vista contra gate de edición (regla B)", () => {
  const VISTA = `"use server";
import { moduleViewDenial, moduleEditDenial } from "@/lib/studio/rbac-guard";
`;

  it("una acción de SÓLO LECTURA se conforma con moduleViewDenial", () => {
    // Es el patrón que SDD-0497 le puso a los lectores del Studio
    // (`searchKommoContactsAction`, `exportRecoverySmsCsvAction`). Exigirles un
    // gate de edición pondría en rojo un candado correcto.
    const r = solo(
      `${VISTA}
export async function leerAction(supabase: any) {
  const d = await moduleViewDenial(supabase, "kommo");
  if (d) return { error: d };
  return await supabase.from("kommo_contacts").select("*");
}`,
      "leerAction",
    );
    expect(r.gated).toBe(true);
    expect(r.guard?.clase).toBe("view");
    expect(r.firstWrite).toBeNull();
  });

  it("si además MUTA, el gate de vista no alcanza", () => {
    const r = solo(
      `${VISTA}
export async function mixtaAction(supabase: any) {
  const d = await moduleViewDenial(supabase, "t");
  if (d) return { error: d };
  const filas = await supabase.from("t").select("*");
  await supabase.from("t").delete().eq("id", 1);
  return filas;
}`,
      "mixtaAction",
    );
    expect(r.gated).toBe(false);
    expect(r.problem).toContain("un gate de vista no habilita una mutación");
    // La regla A pasó: el gate de vista sí domina la LECTURA. Falla la B.
    expect(r.guard).not.toBeNull();
    expect(r.editGuard).toBeNull();
  });

  it("el gate de edición tiene que dominar la ESCRITURA, no sólo la lectura", () => {
    const r = solo(
      `${VISTA}
export async function ordenAction(supabase: any) {
  const v = await moduleViewDenial(supabase, "t");
  if (v) return { error: v };
  await supabase.from("t").update({ x: 1 });
  const e = await moduleEditDenial(supabase, "t");
  if (e) return { error: e };
}`,
      "ordenAction",
    );
    expect(r.gated).toBe(false);
    expect(r.problem).toContain("no la domina");
  });

  it("vista para leer y edición antes de mutar sí pasa", () => {
    const r = solo(
      `${VISTA}
export async function correctaAction(supabase: any) {
  const v = await moduleViewDenial(supabase, "t");
  if (v) return { error: v };
  const filas = await supabase.from("t").select("*");
  const e = await moduleEditDenial(supabase, "t");
  if (e) return { error: e };
  await supabase.from("t").update({ x: 1 });
  return filas;
}`,
      "correctaAction",
    );
    expect(r.gated).toBe(true);
    expect(r.guard?.clase).toBe("view");
    expect(r.editGuard?.clase).toBe("edit");
  });

  it("una escritura escondida en un if tampoco se salva con gate de vista", () => {
    const r = solo(
      `${VISTA}
export async function escondidaAction(supabase: any, cond: boolean) {
  const d = await moduleViewDenial(supabase, "t");
  if (d) return { error: d };
  if (cond) { await supabase.from("t").delete(); }
}`,
      "escondidaAction",
    );
    expect(r.gated).toBe(false);
    expect(r.firstWrite?.label).toBe('from("t").delete');
  });
});

describe("qué NO vale como guard", () => {

  it("una lectura a mano de user_tenants no es un guard", () => {
    const r = solo(
      `"use server";
export async function x(supabase: any) {
  const { data: link } = await supabase.from("user_tenants").select("tenant_id").maybeSingle();
  if (!link) return { error: "sin tenant" };
  await supabase.from("t").insert({ tenant_id: link.tenant_id });
}`,
      "x",
    );
    expect(r.gated).toBe(false);
    expect(r.firstAccess?.label).toBe('from("user_tenants").select');
  });

  it("una función que se LLAMA igual que un guard pero es local sí cuenta sólo si envuelve uno", () => {
    // El helper se llama `capabilityDenial` pero no llama a ningún guard real.
    const r = solo(
      `"use server";
async function requireAdmin(supabase: any) {
  const { data } = await supabase.from("user_tenants").select("role").maybeSingle();
  return data?.role === "admin";
}
export async function x(supabase: any) {
  if (!(await requireAdmin(supabase))) return { error: "no" };
  await supabase.from("t").insert({});
}`,
      "x",
    );
    expect(r.gated).toBe(false);
  });
});
