// @vitest-environment node
/**
 * SDD-0529 · Editar operarios: lo que la app hace con la regla de la base.
 *
 * La regla del rol vive en `operario_roles_por_region()` (migr 0480); la app
 * sólo valida la forma de lo que llega, arma las opciones del cajón y traduce
 * los rechazos de `admin_update_operario` al campo que toca. Que la base y el
 * cajón coincidan rol por rol lo prueba operarios-editar-por-region.migration.test.ts
 * contra la función SQL real.
 */
import { describe, expect, it } from "vitest";
import {
  OPERARIO_REGION,
  OPERARIO_UPDATE_FIELD_BY_CODE,
  operarioRolOpciones,
  operarioUpdateField,
  parseOperarioRolesPorRegion,
} from "@/lib/studio/operario-edicion";
import { getOperarioRolesPorRegion } from "@/lib/studio/operario-queries";

const BASE = { cn: ["operario", "supervisor"], ve: ["bodeguero", "camionero", "supervisor"] };

describe("parseOperarioRolesPorRegion · la respuesta de la base, validada", () => {
  it("acepta la forma de operario_roles_por_region() y conserva el orden", () => {
    expect(parseOperarioRolesPorRegion(BASE)).toEqual(BASE);
    expect(parseOperarioRolesPorRegion({ cn: ["supervisor", "operario"], ve: ["camionero"] }))
      .toEqual({ cn: ["supervisor", "operario"], ve: ["camionero"] });
  });

  it("devuelve copias: tocar el resultado no toca lo que llegó", () => {
    const input = { cn: ["operario"], ve: ["camionero"] };
    const out = parseOperarioRolesPorRegion(input)!;
    (out.cn as string[]).push("supervisor");
    expect(input.cn).toEqual(["operario"]);
  });

  it("una región de más se ignora (el tipo sólo conoce cn y ve)", () => {
    expect(parseOperarioRolesPorRegion({ ...BASE, co: ["camionero"] })).toEqual(BASE);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["un texto", "cn"],
    ["una lista", [["operario"]]],
    ["sin Venezuela", { cn: ["operario"] }],
    ["sin China", { ve: ["camionero"] }],
    ["una región vacía", { cn: [], ve: ["camionero"] }],
    ["una región que no es lista", { cn: "operario", ve: ["camionero"] }],
    ["un rol que no existe", { cn: ["operario", "jefe"], ve: ["camionero"] }],
    ["un rol con mayúsculas", { cn: ["Operario"], ve: ["camionero"] }],
    ["un rol que no es texto", { cn: [1], ve: ["camionero"] }],
    ["un rol repetido", { cn: ["operario", "operario"], ve: ["camionero"] }],
    ["un rol heredado del prototipo", { cn: ["toString"], ve: ["camionero"] }],
  ])("con %s devuelve null: el cajón no inventa una lista", (_label, data) => {
    expect(parseOperarioRolesPorRegion(data)).toBeNull();
  });
});

describe("operarioRolOpciones · lo que ofrece el cajón", () => {
  const roles = parseOperarioRolesPorRegion(BASE);

  it("los roles de la región del operario, en el orden de la base", () => {
    expect(operarioRolOpciones(roles, "ve", "camionero")).toEqual({
      opciones: ["bodeguero", "camionero", "supervisor"],
      actualValido: true,
    });
    expect(operarioRolOpciones(roles, "cn", "supervisor")).toEqual({
      opciones: ["operario", "supervisor"],
      actualValido: true,
    });
  });

  it("un rol de hoy que no es de su región no vale: hay que elegir", () => {
    expect(operarioRolOpciones(roles, "ve", "operario").actualValido).toBe(false);
    expect(operarioRolOpciones(roles, "cn", "camionero").actualValido).toBe(false);
    expect(operarioRolOpciones(roles, "cn", "").actualValido).toBe(false);
  });

  it("sin la respuesta de la base no hay opciones", () => {
    expect(operarioRolOpciones(null, "ve", "camionero")).toEqual({ opciones: [], actualValido: false });
  });
});

describe("operarioUpdateField · cada rechazo de admin_update_operario a su campo", () => {
  it.each([
    ["P0011", "display_name"],
    ["P0013", "display_name"],
    ["P0012", "role"],
    ["P0023", "warehouse_id"],
  ])("%s va a %s", (code, field) => {
    expect(operarioUpdateField({ code })).toBe(field);
  });

  it.each([["42501"], ["P0014"], ["23514"], [""], ["toString"], ["constructor"]])(
    "%s es un error general", (code) => {
      expect(operarioUpdateField({ code })).toBeNull();
    });

  it("sin error o sin código, nada", () => {
    expect(operarioUpdateField(null)).toBeNull();
    expect(operarioUpdateField(undefined)).toBeNull();
    expect(operarioUpdateField({})).toBeNull();
  });

  it("son los códigos que lanza la migración, y nada más", () => {
    expect(Object.keys(OPERARIO_UPDATE_FIELD_BY_CODE).sort()).toEqual(["P0011", "P0012", "P0013", "P0023"]);
  });
});

describe("OPERARIO_REGION", () => {
  it("nombra las dos regiones y qué hace allá el operario", () => {
    expect(OPERARIO_REGION).toEqual({
      cn: { label: "China", ambito: "almacén" },
      ve: { label: "Venezuela", ambito: "despacho" },
    });
  });
});

describe("getOperarioRolesPorRegion · lee la regla de la base", () => {
  const client = (result: { data: unknown; error: { message: string } | null }) => {
    const calls: unknown[][] = [];
    return {
      calls,
      supabase: {
        rpc: async (...args: unknown[]) => {
          calls.push(args);
          return result;
        },
      } as unknown as Parameters<typeof getOperarioRolesPorRegion>[0],
    };
  };

  it("llama a operario_roles_por_region sin argumentos y devuelve lo validado", async () => {
    const { calls, supabase } = client({ data: BASE, error: null });
    expect(await getOperarioRolesPorRegion(supabase)).toEqual(BASE);
    expect(calls).toEqual([["operario_roles_por_region"]]);
  });

  it("si la base no responde (p. ej. sin 0480), null y no lanza", async () => {
    const { supabase } = client({ data: null, error: { message: "Could not find the function" } });
    await expect(getOperarioRolesPorRegion(supabase)).resolves.toBeNull();
  });

  it("si responde con otra forma, null", async () => {
    const { supabase } = client({ data: { cn: ["operario"] }, error: null });
    expect(await getOperarioRolesPorRegion(supabase)).toBeNull();
  });
});
