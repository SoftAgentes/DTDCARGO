// @vitest-environment node
/**
 * SDD-0565 · Ninguna cuenta queda huérfana, como PROPIEDAD de las acciones del plan de cuentas
 * (decisión del Director, 2026-10-19). Se ejercen `createAccount` y `deleteAccount` de verdad,
 * sobre el doble de PostgREST (`dobleListados`, que aplica los filtros) con `insert` y `delete`
 * que escriben en las mismas tablas:
 *  - no se crea una subcuenta sin su cuenta padre;
 *  - no se borra una cuenta con subcuentas, por código ni por `parent_id`;
 *  - el camino feliz sigue: padre, después hija; se borra la hija y después el padre.
 *
 * Sin la regla, `1.1.2.9.1` sin `1.1.2.9` no sube su saldo a 1.1.2 (`computeBalances` sube una
 * cuenta solo a su padre directo), y borrar una cuenta que otra apunta por `parent_id` se la
 * llevaría en silencio (`on delete cascade`, 0078). Producción tenía 0 huérfanas en 91 cuentas
 * (medido por el Director, solo el catálogo).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dobleListados, type Fila } from "@/lib/studio/__tests__/listados-double";

const estado = vi.hoisted(() => ({
  tablas: {} as Record<string, Record<string, unknown>[]>,
  secuencia: 0,
  /** La lectura del plan falla con un texto de la base, que no debe llegar a la persona. */
  falla: false,
}));

const FALLA_DE_LA_BASE = "permission denied for table accounts (SQLSTATE 42501)";

vi.mock("@/lib/db/server", () => ({
  createClient: async () => {
    const { client } = dobleListados(estado.tablas);
    return {
      from(t: string) {
        if (estado.falla && t === "accounts") {
          return {
            select: () => ({ order: () => ({ range: async () => ({ data: null, error: { message: FALLA_DE_LA_BASE } }) }) }),
          };
        }
        return {
          ...client.from(t),
          insert: async (fila: Fila) => {
            estado.secuencia += 1;
            estado.tablas[t] = [...(estado.tablas[t] ?? []), { id: `${t}-${estado.secuencia}`, ...fila }];
            return { error: null };
          },
          delete: () => ({
            eq: async (col: string, val: unknown) => {
              const filas = estado.tablas[t] ?? [];
              const borrar = new Set(filas.filter((f) => f[col] === val).map((f) => f.id));
              // Como la base: `parent_id ... on delete cascade` (0078_contabilidad.sql:28) se lleva,
              // en cadena, a las cuentas que apuntan a una borrada. Sin la regla de la SDD-0565, la
              // hija desaparece y la prueba lo ve.
              if (t === "accounts") {
                let crecio = true;
                while (crecio) {
                  crecio = false;
                  for (const f of filas) {
                    if (!borrar.has(f.id) && borrar.has(f.parent_id)) {
                      borrar.add(f.id);
                      crecio = true;
                    }
                  }
                }
              }
              estado.tablas[t] = filas.filter((f) => !borrar.has(f.id));
              return { error: null };
            },
          }),
        };
      },
    };
  },
}));

vi.mock("@/lib/studio/rbac-guard", () => ({
  moduleEditDenial: async () => null,
  tenantAdminGate: async () => null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { planDeCuentas } from "@/lib/studio/account-queries";
import { createAccount, deleteAccount } from "../actions";

const cuenta = (id: string, code: string, parent_id: string | null = null): Fila => ({
  id,
  tenant_id: "t1",
  code,
  name: "CENTINELA",
  type: "A",
  parent_id,
  is_postable: true,
});

function formulario(code: string): FormData {
  const f = new FormData();
  f.set("code", code);
  f.set("name", "CENTINELA-NUEVA");
  f.set("type", "A");
  f.set("is_postable", "true");
  return f;
}

const codigos = () => (estado.tablas.accounts ?? []).map((a) => String(a.code)).sort();
const idDe = (code: string) => String((estado.tablas.accounts ?? []).find((a) => a.code === code)?.id);

beforeEach(() => {
  estado.secuencia = 0;
  estado.falla = false;
  estado.tablas = {
    user_tenants: [{ tenant_id: "t1" }],
    accounts: [cuenta("a-1", "1"), cuenta("a-11", "1.1"), cuenta("a-112", "1.1.2", "a-11")],
    journal_lines: [],
  };
});

describe("SDD-0565 · el plan de cuentas no deja cuentas huérfanas", () => {
  it("no crea una subcuenta sin su cuenta padre, y dice cuál falta", async () => {
    const r = await createAccount({}, formulario("1.1.2.9.1"));
    expect(r.fieldErrors?.code).toBe("Primero crea la cuenta 1.1.2.9: es la cuenta padre de 1.1.2.9.1.");
    expect(r.ok).toBeUndefined();
    expect(codigos()).toEqual(["1", "1.1", "1.1.2"]);
  });

  it("crea el padre y después la hija; no borra el padre mientras tenga la hija", async () => {
    expect((await createAccount({}, formulario("1.1.2.9"))).ok).toBe(true);
    expect((await createAccount({}, formulario("1.1.2.9.1"))).ok).toBe(true);
    expect(codigos()).toEqual(["1", "1.1", "1.1.2", "1.1.2.9", "1.1.2.9.1"]);

    const r = await deleteAccount(idDe("1.1.2.9"));
    expect(r.error).toBe(
      "No se puede eliminar la cuenta 1.1.2.9: tiene subcuentas (1.1.2.9.1). Elimina primero las subcuentas.",
    );
    expect(codigos()).toContain("1.1.2.9");

    // El camino de vuelta: primero la hija, después el padre.
    expect((await deleteAccount(idDe("1.1.2.9.1"))).ok).toBe(true);
    expect((await deleteAccount(idDe("1.1.2.9"))).ok).toBe(true);
    expect(codigos()).toEqual(["1", "1.1", "1.1.2"]);
  });

  it("borrar el padre no se lleva a las hijas: ni por código ni por parent_id (on delete cascade)", async () => {
    // 5.7 tiene una hija por código (5.7.1, que la apunta por parent_id) y otra solo por parent_id (8.1).
    estado.tablas.accounts.push(cuenta("a-57", "5.7"), cuenta("a-571", "5.7.1", "a-57"), cuenta("a-81", "8.1", "a-57"));
    const r = await deleteAccount("a-57");
    expect(r.error).toBe(
      "No se puede eliminar la cuenta 5.7: tiene subcuentas (5.7.1, 8.1). Elimina primero las subcuentas.",
    );
    expect(codigos()).toEqual(expect.arrayContaining(["5.7", "5.7.1", "8.1"]));
  });

  it("control del doble: sin subcuentas propias, borrar sigue el cascade de la base", async () => {
    // Una cuenta sin hijas se borra; el doble aplica el cascade como la base, así que la prueba
    // de arriba sí vería desaparecer a 5.7.1 y 8.1 si la regla no estuviera.
    estado.tablas.accounts.push(cuenta("a-61", "6.1"));
    expect((await deleteAccount("a-61")).ok).toBe(true);
    expect(codigos()).not.toContain("6.1");
  });

  it("con muchas subcuentas nombra tres y cuenta el resto", async () => {
    for (const n of [1, 2, 3, 4, 5]) estado.tablas.accounts.push(cuenta(`a-sub${n}`, `1.1.2.${n}`, "a-112"));
    const r = await deleteAccount("a-112");
    expect(r.error).toBe(
      "No se puede eliminar la cuenta 1.1.2: tiene subcuentas (1.1.2.1, 1.1.2.2, 1.1.2.3 y 2 más). Elimina primero las subcuentas.",
    );
  });

  it("un plan que no llega completo no se usa: planDeCuentas lanza en vez de dejar pasar una huérfana", async () => {
    // Un servidor que siempre devuelve la página llena: fetchAllPaged agota sus páginas sin terminar.
    const sinFin = {
      from: () => ({
        select: () => ({
          order: () => ({
            range: async (d: number, h: number) => ({
              data: Array.from({ length: h - d + 1 }, (_, i) => ({ id: `x${d + i}`, code: `7.${d + i}`, parent_id: null })),
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as Parameters<typeof planDeCuentas>[0];
    await expect(planDeCuentas(sinFin)).rejects.toThrow("El plan de cuentas supera el tope de lectura");
  });

  it("si no se puede leer el plan, no crea ni borra, y no muestra el texto de la base (ERR-01)", async () => {
    estado.falla = true;
    const creada = await createAccount({}, formulario("1.1.3"));
    expect(creada.error).toBe("No se pudo crear la cuenta: no se pudo leer el plan de cuentas. Intenta de nuevo.");
    const borrada = await deleteAccount("a-112");
    expect(borrada.error).toBe("No se pudo eliminar la cuenta: no se pudo leer el plan de cuentas. Intenta de nuevo.");
    expect(`${creada.error} ${borrada.error}`).not.toContain("SQLSTATE");
    estado.falla = false;
    expect(codigos()).toEqual(["1", "1.1", "1.1.2"]);
  });

  it("control: una cuenta sin subcuentas ni movimientos se borra, y una que no existe no se toca", async () => {
    estado.tablas.accounts.push(cuenta("a-99", "9.9"));
    expect((await deleteAccount("a-99")).ok).toBe(true);
    expect(codigos()).not.toContain("9.9");
    expect((await deleteAccount("no-existe")).error).toBe("Cuenta no encontrada.");
    expect(codigos()).toEqual(["1", "1.1", "1.1.2"]);
  });
});
