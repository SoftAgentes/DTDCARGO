import { describe, it, expect } from "vitest";

import {
  validateAliadoPrefix,
  validateAliadoInput,
  prefixChain,
  parentOptions,
  PREFIJOS_RESERVADOS,
  type AliadoOption,
} from "../aliado-types";

/** DC (raíz) → FA (cuelga de DC) → XY (cuelga de FA). HR aparte, raíz. */
const ALIADOS: AliadoOption[] = [
  { id: "dc", prefix: "DC", tradeName: "Dynasty Cargo", parentAliadoId: null, status: "activo" },
  { id: "fa", prefix: "FA", tradeName: "Sub de Dynasty", parentAliadoId: "dc", status: "activo" },
  { id: "xy", prefix: "XY", tradeName: "Sub del sub", parentAliadoId: "fa", status: "activo" },
  { id: "hr", prefix: "HR", tradeName: "Herneka", parentAliadoId: null, status: "activo" },
];

describe("validateAliadoPrefix", () => {
  it("acepta 2 a 4 letras y normaliza a mayúsculas", () => {
    expect(validateAliadoPrefix("hr").value).toBe("HR");
    expect(validateAliadoPrefix(" dc ").value).toBe("DC");
    expect(validateAliadoPrefix("abcd").value).toBe("ABCD");
  });

  it("rechaza una sola letra — ésas eran las series de VENDEDOR del legado", () => {
    // DTD-A101, DTD-J044… eran códigos de vendedor (A=Darilis, J=José…), no de
    // aliado. Un prefijo de una letra se confundiría con ellos.
    expect(validateAliadoPrefix("A").error).toBeTruthy();
  });

  it("rechaza más de 4 letras, números y espacios", () => {
    expect(validateAliadoPrefix("HERNEKA").error).toBeTruthy();
    expect(validateAliadoPrefix("H1").error).toBeTruthy();
    expect(validateAliadoPrefix("H R").error).toBeTruthy();
  });

  it("rechaza vacío", () => {
    expect(validateAliadoPrefix("").error).toBeTruthy();
    expect(validateAliadoPrefix(null).error).toBeTruthy();
    expect(validateAliadoPrefix(undefined).error).toBeTruthy();
  });

  it("rechaza TODOS los prefijos reservados", () => {
    // Espejo del constraint aliados_prefix_reservado de la migr 0362.
    for (const r of PREFIJOS_RESERVADOS) {
      expect(validateAliadoPrefix(r).error, `${r} debería estar reservado`).toBeTruthy();
      expect(validateAliadoPrefix(r.toLowerCase()).error).toBeTruthy();
    }
  });
});

describe("validateAliadoInput", () => {
  function fd(campos: Record<string, string>): FormData {
    const f = new FormData();
    for (const [k, v] of Object.entries(campos)) f.append(k, v);
    return f;
  }

  it("arma el input con el prefijo normalizado", () => {
    const r = validateAliadoInput(
      fd({ clientId: "c1", prefix: "hr", tradeName: "Herneka", parentAliadoId: "", agreementNotes: "" }),
    );
    expect(r.error).toBeUndefined();
    expect(r.value).toMatchObject({
      clientId: "c1",
      prefix: "HR",
      tradeName: "Herneka",
      parentAliadoId: null,
      agreementNotes: null,
      status: "activo",
    });
  });

  it("convierte el padre vacío en null (aliado raíz)", () => {
    const r = validateAliadoInput(fd({ clientId: "c1", prefix: "HR", tradeName: "X", parentAliadoId: "" }));
    expect(r.value?.parentAliadoId).toBeNull();
  });

  it("exige cliente, insignia y nombre comercial", () => {
    expect(validateAliadoInput(fd({ prefix: "HR", tradeName: "X" })).error).toBeTruthy();
    expect(validateAliadoInput(fd({ clientId: "c1", tradeName: "X" })).error).toBeTruthy();
    expect(validateAliadoInput(fd({ clientId: "c1", prefix: "HR", tradeName: "  " })).error).toBeTruthy();
  });

  it("ignora un estado inventado y cae en 'activo'", () => {
    const r = validateAliadoInput(
      fd({ clientId: "c1", prefix: "HR", tradeName: "X", status: "inventado" }),
    );
    expect(r.value?.status).toBe("activo");
  });
});

describe("prefixChain", () => {
  it("un aliado raíz es sólo su prefijo", () => {
    expect(prefixChain(ALIADOS, "dc")).toBe("DC");
    expect(prefixChain(ALIADOS, "hr")).toBe("HR");
  });

  it("⭐ un sub-aliado arrastra la cadena desde la raíz", () => {
    expect(prefixChain(ALIADOS, "fa")).toBe("DC-FA");
    expect(prefixChain(ALIADOS, "xy")).toBe("DC-FA-XY");
  });

  it("es el espejo de aliado_prefix_chain() de la migr 0362", () => {
    // El SQL compone de raíz a hoja con string_agg(... order by nivel desc).
    expect(prefixChain(ALIADOS, "fa").split("-")).toEqual(["DC", "FA"]);
  });

  it("devuelve vacío para un id desconocido", () => {
    expect(prefixChain(ALIADOS, "no-existe")).toBe("");
  });

  it("no se cuelga si los datos traen un ciclo", () => {
    // El trigger anti-ciclo lo impide en la base, pero un render colgado sería
    // peor que una cadena rara.
    const ciclo: AliadoOption[] = [
      { id: "a", prefix: "AA", tradeName: "A", parentAliadoId: "b", status: "activo" },
      { id: "b", prefix: "BB", tradeName: "B", parentAliadoId: "a", status: "activo" },
    ];
    const r = prefixChain(ciclo, "a");
    expect(r.split("-").length).toBeLessThanOrEqual(10);
  });
});

describe("parentOptions", () => {
  it("con cliente que aún no es aliado, ofrece todos", () => {
    expect(parentOptions(ALIADOS, null).map((a) => a.id)).toEqual(["dc", "fa", "xy", "hr"]);
  });

  it("⭐ excluye al propio aliado y a TODOS sus descendientes", () => {
    // Ofrecer DC como padre de DC, o FA/XY (que cuelgan de él), haría un ciclo:
    // el trigger aliados_guard_sin_ciclo_t lo rechazaría, así que ni se ofrece.
    expect(parentOptions(ALIADOS, "dc").map((a) => a.id)).toEqual(["hr"]);
  });

  it("excluye al nieto, no sólo al hijo directo", () => {
    expect(parentOptions(ALIADOS, "fa").map((a) => a.id)).toEqual(["dc", "hr"]);
  });

  it("una hoja sólo se excluye a sí misma", () => {
    expect(parentOptions(ALIADOS, "xy").map((a) => a.id)).toEqual(["dc", "fa", "hr"]);
  });
});
