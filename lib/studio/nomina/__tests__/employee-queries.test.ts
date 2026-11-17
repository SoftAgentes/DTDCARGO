// @vitest-environment node
/**
 * SDD-0652 F1 · `getEmployeeByCode` contra un cliente falso, sin doblar el módulo.
 *
 * La prueba de la página reemplaza `employee-queries` entero, así que no veía
 * la validación del código: con un `\d` roto, la ficha daba 404 a todos. Aquí
 * se mide la función real: qué códigos acepta, que filtra por tenant y que
 * distingue encontrada, no existe y error. Datos sintéticos.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEmployeeByCode } from "../employee-queries";

type Respuesta = { data: Record<string, unknown> | null; error: { message: string } | null };

function clienteFalso(respuesta: Respuesta) {
  const filtros: [string, string, unknown][] = [];
  let consultas = 0;
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      filtros.push(["eq", col, val]);
      return chain;
    },
    is: (col: string, val: unknown) => {
      filtros.push(["is", col, val]);
      return chain;
    },
    maybeSingle: async () => respuesta,
  };
  const client = {
    from: (tabla: string) => {
      consultas += 1;
      expect(tabla).toBe("nomina_employees");
      return chain;
    },
  } as unknown as SupabaseClient;
  return { client, filtros, consultas: () => consultas };
}

const FILA = {
  id: "e1",
  tenant_id: "t1",
  employee_code: "EMP-0007",
  full_name: "Persona Sintética",
  salary_usd: "321.50",
  auth_user_id: null,
};

let falso: ReturnType<typeof clienteFalso>;
beforeEach(() => {
  falso = clienteFalso({ data: FILA, error: null });
});

describe("getEmployeeByCode (SDD-0652 F1)", () => {
  it.each(["EMP-0007", "emp-0007", "  EMP-0007  ", "EMP-1", "EMP-123456789"])(
    "acepta %j y consulta con el código en mayúsculas y sin espacios",
    async (codigo) => {
      const r = await getEmployeeByCode(falso.client, "t1", codigo);
      expect(r.kind).toBe("found");
      expect(falso.consultas()).toBe(1);
      const codigoConsultado = falso.filtros.find(([, col]) => col === "employee_code")?.[2];
      expect(codigoConsultado).toBe(codigo.trim().toUpperCase());
    },
  );

  it.each(["", "EMP-", "EMPd", "EMP-dd", "EMP-12a", "DTD-0007", "EMP-1234567890", "EMP-00 07", "x EMP-0007"])(
    "rechaza %j sin consultar",
    async (codigo) => {
      expect(await getEmployeeByCode(falso.client, "t1", codigo)).toEqual({ kind: "not_found" });
      expect(falso.consultas()).toBe(0);
    },
  );

  it("filtra por el tenant que le pasan y por fichas vivas", async () => {
    await getEmployeeByCode(falso.client, "t-del-que-mira", "EMP-0007");
    expect(falso.filtros).toEqual([
      ["eq", "tenant_id", "t-del-que-mira"],
      ["eq", "employee_code", "EMP-0007"],
      ["is", "deleted_at", null],
    ]);
  });

  it("encontrada: devuelve la ficha con el sueldo como número y auth_user_id", async () => {
    const r = await getEmployeeByCode(falso.client, "t1", "EMP-0007");
    expect(r.kind).toBe("found");
    if (r.kind !== "found") return;
    expect(r.employee.salary_usd).toBe(321.5);
    expect(r.employee.auth_user_id).toBeNull();
  });

  it("no existe: not_found", async () => {
    const f = clienteFalso({ data: null, error: null });
    expect(await getEmployeeByCode(f.client, "t1", "EMP-0007")).toEqual({ kind: "not_found" });
  });

  it("error de lectura: error, no not_found", async () => {
    const f = clienteFalso({ data: null, error: { message: "sin red" } });
    expect(await getEmployeeByCode(f.client, "t1", "EMP-0007")).toEqual({ kind: "error" });
  });
});
