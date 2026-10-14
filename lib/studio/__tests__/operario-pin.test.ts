// @vitest-environment node
/**
 * SDD-0513 · Generador y validador del PIN de operario.
 *
 * Lo que se afirma es comportamiento, no texto:
 *  - el generador real (crypto.randomInt) nunca produce un PIN que la base
 *    rechazaría, en muchas corridas;
 *  - el sorteo es por RECHAZO: con una fuente controlada, cada valor válido
 *    sale tal cual y cada valor inválido se descarta (no se «corrige»), así
 *    que la distribución sobre los 9.976 PIN válidos queda uniforme;
 *  - pide el rango completo (0, 10000) con máximo exclusivo: con (0, 9999) el
 *    9999 no saldría nunca, pero tampoco el 9998, el 9997…;
 *  - una fuente rota falla cerrado en vez de devolver un PIN débil;
 *  - no toca Math.random.
 *
 * La equivalencia con la función SQL real está en
 * operario-pin.migration.test.ts (PGlite).
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OPERARIO_PIN_BLACKLIST,
  OPERARIO_PIN_IN_USE_CODE,
  OPERARIO_PIN_IN_USE_MESSAGE,
  OPERARIO_PIN_MAX_ATTEMPTS,
  OPERARIO_PIN_MAX_DRAWS,
  OPERARIO_PIN_PROBLEM_MESSAGE,
  drawOperarioPin,
  isOperarioPinInUse,
  isValidOperarioPin,
  operarioPinProblem,
  saveWithFreshOperarioPin,
  OPERARIO_MOTIVO_CODE,
  OPERARIO_MOTIVO_MESSAGE,
  OPERARIO_MOTIVOS,
  OPERARIO_PASSWORD_CODE,
  OPERARIO_PASSWORD_FAILURE_MESSAGE,
  OPERARIO_PASSWORD_MESSAGE,
  OPERARIO_PIN_LEGACY_MESSAGE,
  isOperarioMotivoRejected,
  isOperarioPasswordRequired,
  operarioLoginLabel,
  operarioLoginUrl,
  operarioMotivoProblem,
  operarioRolLabel,
} from "../operario-pin";
import { generateOperarioPin, saveWithGeneratedOperarioPin } from "../operario-pin-generator";

const pad = (n: number) => String(n).padStart(4, "0");

/** Fuente que devuelve una secuencia fija y registra con qué rango la llaman. */
function sequence(values: number[]) {
  const calls: Array<[number, number]> = [];
  let i = 0;
  const fn = (min: number, max: number) => {
    calls.push([min, max]);
    if (i >= values.length) throw new Error("secuencia agotada");
    return values[i++];
  };
  return { fn, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("operarioPinProblem", () => {
  it("acepta 4 dígitos fuera de la lista de comunes", () => {
    for (const pin of ["4827", "0429", "9998", "0001", "7310"]) {
      expect(operarioPinProblem(pin), pin).toBeNull();
    }
  });

  it("rechaza por formato lo que no son exactamente 4 dígitos ASCII", () => {
    for (const pin of ["", "123", "12345", "12a4", " 123", "123 ", "１２３４", "-123", "12.3"]) {
      expect(operarioPinProblem(pin), JSON.stringify(pin)).toBe("format");
    }
  });

  it("rechaza por común los 24 de la lista, y solo esos", () => {
    expect(OPERARIO_PIN_BLACKLIST.size).toBe(24);
    let common = 0;
    for (let n = 0; n < 10_000; n++) {
      if (operarioPinProblem(pad(n)) === "common") common++;
    }
    expect(common).toBe(24);
    for (const pin of OPERARIO_PIN_BLACKLIST) {
      expect(operarioPinProblem(pin), pin).toBe("common");
    }
  });

  it("los mensajes van en tuteo, sin voseo", () => {
    // La base dice «Elegí uno menos predecible» (voseo); el Studio no lo repite.
    const all = Object.values(OPERARIO_PIN_PROBLEM_MESSAGE).join(" ");
    expect(all).not.toMatch(/elegí|usá|tenés|podés|querés|probá|escribí|generá/i);
  });
});

describe("drawOperarioPin (muestreo de rechazo)", () => {
  it("pide el rango completo con máximo exclusivo: (0, 10000)", () => {
    const src = sequence([4827]);
    expect(drawOperarioPin(src.fn)).toBe("4827");
    expect(src.calls).toEqual([[0, 10_000]]);
  });

  it("rellena con ceros a la izquierda", () => {
    expect(drawOperarioPin(sequence([7]).fn)).toBe("0007");
    expect(drawOperarioPin(sequence([42]).fn)).toBe("0042");
  });

  it("descarta los comunes y sigue sorteando hasta uno válido", () => {
    const src = sequence([1234, 0, 1111, 2580, 4827]);
    expect(drawOperarioPin(src.fn)).toBe("4827");
    expect(src.calls).toHaveLength(5);
  });

  it("cada valor válido sale tal cual en el primer sorteo (sin sesgo ni mapeo)", () => {
    for (let n = 0; n < 10_000; n++) {
      const expected = pad(n);
      const src = sequence(isValidOperarioPin(expected) ? [n] : [n, 4827]);
      const got = drawOperarioPin(src.fn);
      if (isValidOperarioPin(expected)) {
        expect(got).toBe(expected);
        expect(src.calls).toHaveLength(1);
      } else {
        expect(got).toBe("4827");
        expect(src.calls).toHaveLength(2);
      }
    }
  });

  it("una fuente rota que solo da comunes falla cerrado tras el tope", () => {
    const calls: number[] = [];
    const stuck = () => {
      calls.push(1);
      return 1234;
    };
    expect(() => drawOperarioPin(stuck)).toThrow(/No se pudo generar un PIN válido/);
    expect(calls).toHaveLength(OPERARIO_PIN_MAX_DRAWS);
  });
});

describe("generateOperarioPin (crypto.randomInt real)", () => {
  it("en 20.000 corridas nunca sale un PIN inválido y no usa Math.random", () => {
    const mathRandom = vi.spyOn(Math, "random");
    const seen = new Set<string>();
    for (let i = 0; i < 20_000; i++) {
      const pin = generateOperarioPin();
      expect(operarioPinProblem(pin), pin).toBeNull();
      seen.add(pin);
    }
    expect(mathRandom).not.toHaveBeenCalled();
    // 20.000 sorteos uniformes sobre 9.976 valores cubren ~86 %; un generador
    // degenerado (constante, o con pocos valores) queda muy por debajo.
    expect(seen.size).toBeGreaterThan(8_000);
  });
});

// ─── SDD-0515 · PIN repetido en el tenant y la región (migr 0475) ───────────

type DbError = { code?: string; message: string };
const IN_USE: DbError = { code: OPERARIO_PIN_IN_USE_CODE, message: OPERARIO_PIN_IN_USE_MESSAGE };

/** `draw` que devuelve una secuencia fija de PIN y falla si se agota. */
function pins(values: string[]) {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error("secuencia de PIN agotada");
    return values[i++];
  };
}

/** `save` que contesta con una secuencia de errores (null = guardó) y registra cada PIN. */
function base(replies: (DbError | null)[]) {
  const saved: string[] = [];
  const save = async (pin: string) => {
    saved.push(pin);
    if (saved.length > replies.length) throw new Error("la base recibió más llamadas de las previstas");
    return { error: replies[saved.length - 1] };
  };
  return { save, saved };
}

describe("isOperarioPinInUse", () => {
  it("sólo el P0018 de 0475 es «PIN repetido»", () => {
    expect(isOperarioPinInUse(IN_USE)).toBe(true);
    for (const error of [{ code: "P0010" }, { code: "P0013" }, { code: "P0014" }, { code: "23505" },
      { code: "42501" }, {}, null, undefined]) {
      expect(isOperarioPinInUse(error), JSON.stringify(error)).toBe(false);
    }
  });

  it("el copy es el mismo texto que da la base, en tuteo", () => {
    const sql = readFileSync(new URL("../../../supabase/migrations/0475_pin_operarios_endurecer.sql", import.meta.url), "utf8")
      .replace(/\r\n/g, "\n");
    expect(sql).toContain(`raise exception '${OPERARIO_PIN_IN_USE_MESSAGE}'\n      using errcode = '${OPERARIO_PIN_IN_USE_CODE}';`);
    expect(OPERARIO_PIN_IN_USE_MESSAGE).not.toMatch(/usá|generá|elegí|probá/i);
  });
});

describe("saveWithFreshOperarioPin (reintento ante PIN repetido)", () => {
  it("si la base lo guarda a la primera, no reintenta", async () => {
    const db = base([null]);
    const result = await saveWithFreshOperarioPin(pins(["4827"]), db.save);
    expect(result).toEqual({ pin: "4827", error: null, attempts: 1 });
    expect(db.saved).toEqual(["4827"]);
  });

  it("si la base dice que está repetido, guarda otro PIN distinto", async () => {
    const db = base([IN_USE, null]);
    const result = await saveWithFreshOperarioPin(pins(["4827", "6083"]), db.save);
    expect(result).toEqual({ pin: "6083", error: null, attempts: 2 });
    expect(db.saved).toEqual(["4827", "6083"]);
  });

  it("no vuelve a proponer un PIN que la base ya rechazó", async () => {
    const db = base([IN_USE, null]);
    const result = await saveWithFreshOperarioPin(pins(["4827", "4827", "4827", "6083"]), db.save);
    expect(result.pin).toBe("6083");
    expect(db.saved).toEqual(["4827", "6083"]);
  });

  it(`se rinde tras ${OPERARIO_PIN_MAX_ATTEMPTS} repetidos y devuelve el rechazo, sin PIN`, async () => {
    const db = base(Array.from({ length: OPERARIO_PIN_MAX_ATTEMPTS }, () => IN_USE));
    const candidates = ["4827", "6083", "7310", "5291", "3846", "9152"];
    const result = await saveWithFreshOperarioPin(pins(candidates), db.save);
    expect(result).toEqual({ pin: null, error: IN_USE, attempts: OPERARIO_PIN_MAX_ATTEMPTS });
    expect(db.saved).toEqual(candidates.slice(0, OPERARIO_PIN_MAX_ATTEMPTS));
  });

  it("cualquier otro rechazo corta en el acto: un 42501 no se vuelve N llamadas", async () => {
    const denied = { code: "42501", message: "No tienes permiso para realizar esta acción" };
    const db = base([denied]);
    const result = await saveWithFreshOperarioPin(pins(["4827", "6083"]), db.save);
    expect(result).toEqual({ pin: null, error: denied, attempts: 1 });
    expect(db.saved).toEqual(["4827"]);
  });

  it("una fuente que sólo repite el PIN rechazado falla cerrado", async () => {
    const db = base([IN_USE]);
    const stuck = () => "4827";
    await expect(saveWithFreshOperarioPin(stuck, db.save)).rejects.toThrow(/No se pudo generar un PIN distinto/);
    expect(db.saved).toEqual(["4827"]);
  });

  it("rechaza un tope de intentos que no sea un entero positivo", async () => {
    for (const max of [0, -1, 1.5, Number.NaN]) {
      await expect(saveWithFreshOperarioPin(pins(["4827"]), base([null]).save, max)).rejects.toThrow(/entero positivo/);
    }
  });
});

describe("saveWithGeneratedOperarioPin (crypto.randomInt real)", () => {
  it("ante un repetido guarda otro PIN generado, distinto y válido", async () => {
    const db = base([IN_USE, null]);
    const result = await saveWithGeneratedOperarioPin(db.save);
    expect(result.error).toBeNull();
    expect(db.saved).toHaveLength(2);
    expect(new Set(db.saved).size).toBe(2);
    for (const pin of db.saved) expect(operarioPinProblem(pin), pin).toBeNull();
    expect(result.pin).toBe(db.saved[1]);
  });
});

// ─── SDD-0515 · motivo de la lista ──────────────────────────────────────────

const SQL_0475 = () =>
  readFileSync(new URL("../../../supabase/migrations/0475_pin_operarios_endurecer.sql", import.meta.url), "utf8")
    .replace(/\r\n/g, "\n");

describe("operarioMotivoProblem (espejo de operario_motivo_valido)", () => {
  it("la lista es la de Sam, en su orden", () => {
    expect(OPERARIO_MOTIVOS.map((m) => [m.value, m.label])).toEqual([
      ["olvido", "Se le olvidó"],
      ["empleado_nuevo", "Empleado nuevo"],
      ["revision_seguridad", "Revisión de seguridad"],
      ["otro", "Otro"],
    ]);
  });

  it("acepta cada código de la lista, sin mayúsculas ni espacios alrededor", () => {
    for (const { value } of OPERARIO_MOTIVOS.filter((m) => m.value !== "otro")) {
      expect(operarioMotivoProblem(value)).toBeNull();
      expect(operarioMotivoProblem(`  ${value.toUpperCase()}  `)).toBeNull();
    }
  });

  it("rechaza lo que no está en la lista, incluido el texto libre de antes", () => {
    for (const codigo of [null, undefined, "", "   ", "inventado", "olvidó", "olvido ya", "El operario olvidó su PIN"]) {
      expect(operarioMotivoProblem(codigo)).toBe("codigo");
    }
  });

  it("un código fijo ignora el texto, aunque lleve el PIN", () => {
    expect(operarioMotivoProblem("olvido", "Le puse 4827", "4827")).toBeNull();
    expect(operarioMotivoProblem("empleado_nuevo", "abc")).toBeNull();
  });

  it("«Otro» pide de 4 a 200 caracteres", () => {
    expect(operarioMotivoProblem("otro")).toBe("length");
    expect(operarioMotivoProblem("otro", "abc")).toBe("length");
    expect(operarioMotivoProblem("otro", "abcd")).toBeNull();
    expect(operarioMotivoProblem("otro", "x".repeat(200))).toBeNull();
    expect(operarioMotivoProblem("otro", "x".repeat(201))).toBe("length");
  });

  it("en «Otro» recorta sólo espacios, como btrim(), y cuenta caracteres, como char_length()", () => {
    expect(operarioMotivoProblem("otro", "   abc   ")).toBe("length");
    expect(operarioMotivoProblem("otro", "  abcd  ")).toBeNull();
    // Un tab no es espacio para btrim(): cuenta como carácter.
    expect(operarioMotivoProblem("otro", "\tabc")).toBeNull();
    // Dos emojis son 2 caracteres para la base aunque sean 4 unidades UTF-16.
    expect("😀😀".length).toBe(4);
    expect(operarioMotivoProblem("otro", "😀😀")).toBe("length");
    expect(operarioMotivoProblem("otro", "😀".repeat(200))).toBeNull();
  });

  it("en «Otro» no deja el PIN cuando se conoce", () => {
    expect(operarioMotivoProblem("otro", "Le puse 4827 a pedido", "4827")).toBe("contains_pin");
    expect(operarioMotivoProblem("otro", "Le puse otro a pedido", "4827")).toBeNull();
    expect(operarioMotivoProblem("otro", "Le puse 4827 a pedido")).toBeNull();
    expect(operarioMotivoProblem("otro", "Le puse 4827 a pedido", null)).toBeNull();
  });

  it("los mensajes son los de la base, en tuteo, y sólo P0020 es «motivo»", () => {
    const sql = SQL_0475();
    for (const message of Object.values(OPERARIO_MOTIVO_MESSAGE)) {
      expect(sql).toContain(`raise exception '${message}' using errcode = '${OPERARIO_MOTIVO_CODE}';`);
    }
    const all = [...Object.values(OPERARIO_MOTIVO_MESSAGE), OPERARIO_PIN_LEGACY_MESSAGE].join(" ");
    expect(all).not.toMatch(/escribí|restablecé|usá|elegí|podés/i);
    expect(isOperarioMotivoRejected({ code: OPERARIO_MOTIVO_CODE })).toBe(true);
    for (const error of [{ code: "P0018" }, { code: "P0010" }, { code: "42501" }, { code: OPERARIO_PASSWORD_CODE }, null]) {
      expect(isOperarioMotivoRejected(error)).toBe(false);
    }
  });
});

// ─── SDD-0515 · «Ver PIN» pide la contraseña ────────────────────────────────

describe("contraseña de «Ver PIN»", () => {
  it("el mensaje y el código son los de la base", () => {
    expect(SQL_0475()).toMatch(
      new RegExp(`raise exception '${OPERARIO_PASSWORD_MESSAGE}'\\s+using errcode = '${OPERARIO_PASSWORD_CODE}';`),
    );
    expect(isOperarioPasswordRequired({ code: OPERARIO_PASSWORD_CODE })).toBe(true);
    for (const error of [{ code: OPERARIO_MOTIVO_CODE }, { code: "42501" }, null, undefined]) {
      expect(isOperarioPasswordRequired(error)).toBe(false);
    }
  });

  it("los avisos están en tuteo", () => {
    const all = [OPERARIO_PASSWORD_MESSAGE, ...Object.values(OPERARIO_PASSWORD_FAILURE_MESSAGE)].join(" ");
    expect(all).not.toMatch(/escribí|revisala|intentá|salí|volvé|hablá|confirmá/i);
  });
});

// ─── Por qué app entra cada operario (región) ───────────────────────────────

describe("operarioLoginUrl / operarioLoginLabel", () => {
  it.each([
    ["cn", "https://dtdcargo.com/m/cn/login", "dtdcargo.com/m/cn/login"],
    ["ve", "https://dtdcargo.com/m/ve/login", "dtdcargo.com/m/ve/login"],
  ] as const)("región %s → %s", (region, url, label) => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com");
    expect(operarioLoginUrl(region)).toBe(url);
    expect(operarioLoginLabel(region)).toBe(label);
  });

  it("sin la variable, o vacía, usa dtdcargo.com; con barra final, no la duplica", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(operarioLoginUrl("cn")).toBe("https://dtdcargo.com/m/cn/login");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dtdcargo.com/");
    expect(operarioLoginUrl("ve")).toBe("https://dtdcargo.com/m/ve/login");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(operarioLoginUrl("ve")).toBe("http://localhost:3000/m/ve/login");
    expect(operarioLoginLabel("ve")).toBe("localhost:3000/m/ve/login");
  });

  it("las dos rutas existen en la app", () => {
    for (const region of ["cn", "ve"]) {
      expect(() => readFileSync(new URL(`../../../app/m/${region}/login/page.tsx`, import.meta.url))).not.toThrow();
    }
  });
});

// ─── Rótulo del rol ──────────────────────────────────────────────────────────

describe("operarioRolLabel", () => {
  it("nombra los cuatro roles de la base, no sólo supervisor", () => {
    expect(operarioRolLabel("operario")).toBe("Operario");
    expect(operarioRolLabel("supervisor")).toBe("Supervisor");
    expect(operarioRolLabel("bodeguero")).toBe("Bodeguero");
    expect(operarioRolLabel("camionero")).toBe("Camionero");
  });

  it("los cuatro son los de operario_pins_role_check", () => {
    const sql = readFileSync(new URL("../../../supabase/migrations/0025_operario_roles_extend.sql", import.meta.url), "utf8");
    expect(sql).toContain("check (role in ('operario', 'supervisor', 'bodeguero', 'camionero'))");
  });

  it("uno desconocido se muestra tal cual, no como «Operario»", () => {
    expect(operarioRolLabel("chofer")).toBe("chofer");
  });
});
