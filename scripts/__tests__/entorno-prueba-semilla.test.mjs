// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * SDD-0540 · Fase 1 · semilla sintética del entorno de prueba (§2.3, decisión D2).
 *
 * Vigila el ARCHIVO; el bloque final de la semilla vigila la BASE con las mismas
 * reglas. Correos solo en dominios reservados (.test, .invalid), teléfonos solo en
 * +1 202 555 0100–0199 (rango de ficción del plan norteamericano), ninguna clave
 * escrita, idempotente y con los cinco roles que se prueban.
 */
const SEMILLA = readFileSync(resolve("infra/ops/staging/semilla-prueba.sql"), "utf8");
const PLATAFORMA = readFileSync(resolve("infra/ops/staging/plataforma-prueba.sql"), "utf8");
const STUBS = readFileSync(resolve("supabase/tests/_supabase-platform-stubs.supabase.sql"), "utf8");
const SETS = readFileSync(resolve("infra/ops/staging/prueba.sets"), "utf8");
const EJEMPLO = readFileSync(resolve("infra/dtd-cargo/.env.example"), "utf8");

const sinComentarios = (sql) => sql.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

/** Correos con parte local cuyo dominio no es .test ni .invalid. */
function correosFuera(sql) {
  const correos = [...sinComentarios(sql).matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g)].map((m) => m[0]);
  return correos.filter((c) => !/@([a-z0-9-]+\.)*(test|invalid)$/i.test(c));
}

/** Teléfonos de 10 a 15 dígitos (con o sin espacios) fuera de +1 202 555 0100–0199. */
function telefonosFuera(sql) {
  const candidatos = [...sinComentarios(sql).matchAll(/\+\d[\d ().-]{8,20}\d/g)].map((m) => m[0]);
  return candidatos
    .map((t) => ({ t, d: t.replace(/\D/g, "") }))
    .filter(({ d }) => d.length >= 10 && d.length <= 15)
    .filter(({ d }) => !/^120255501\d{2}$/.test(d))
    .map(({ t }) => t);
}

/** Bloque de default privileges del rol postgres en public, normalizado. */
function bloqueDefaults(sql) {
  return [...sinComentarios(sql).matchAll(/alter default privileges for role postgres in schema public[^;]*;/gi)]
    .map((m) => m[0].replace(/\s+/g, " ").trim());
}

describe("SDD-0540 · semilla sintética", () => {
  it("solo usa correos de dominios reservados y teléfonos del rango de ficción", () => {
    expect(correosFuera(SEMILLA)).toEqual([]);
    expect(telefonosFuera(SEMILLA)).toEqual([]);
    expect(correosFuera(PLATAFORMA)).toEqual([]);
    expect(telefonosFuera(PLATAFORMA)).toEqual([]);
    // Lo que sí trae: los tres correos y los tres teléfonos de la semilla.
    expect(SEMILLA).toMatch(/admin@prueba\.example\.test/);
    expect(SEMILLA).toMatch(/cliente@prueba\.example\.test/);
    expect(SEMILLA).toMatch(/proveedor@prueba\.example\.test/);
    expect(SEMILLA.match(/\+120255501\d{2}/g)?.length).toBeGreaterThanOrEqual(3);
  });

  // Control rojo: los detectores sí ven un correo o un teléfono reales.
  it.each([
    ["un correo de gmail", "insert into x values ('ana.perez@gmail.com');", correosFuera],
    ["un correo .com.ve", "update clients set email = 'compras@demosa.com.ve';", correosFuera],
    ["un teléfono venezolano con espacios", "insert into x values ('+58 414 1234567');", telefonosFuera],
    ["un teléfono venezolano sin espacios", "insert into x values ('+584121234567');", telefonosFuera],
    ["un 555 fuera del bloque 0100–0199", "insert into x values ('+12025550200');", telefonosFuera],
    ["un teléfono chino", "insert into x values ('+86 138 0013 8000');", telefonosFuera],
  ])("detecta %s", (_n, sql, detector) => {
    expect(detector(SEMILLA + "\n" + sql).length).toBe(1);
  });

  it("no escribe claves: las cuentas usan las variables de sembrar-prueba.sh", () => {
    expect(SEMILLA).toMatch(/crypt\(:'clave_admin'/);
    expect(SEMILLA).toMatch(/:'pin_ve'/);
    expect(SEMILLA).toMatch(/:'pin_cn'/);
    expect(SEMILLA).not.toMatch(/crypt\('/);
    expect(SEMILLA).not.toMatch(/encrypted_password\s*=\s*'/);
    // Las variables de psql no se expanden dentro de $$: ninguna puede quedar ahí.
    for (const bloque of SEMILLA.matchAll(/\$(\w*)\$[\s\S]*?\$\1\$/g)) {
      expect(bloque[0]).not.toMatch(/:'(clave_admin|pin_ve|pin_cn)'/);
    }
  });

  it("es idempotente: cada insert tiene on conflict y los UUID son fijos", () => {
    const inserts = [...SEMILLA.matchAll(/insert into[\s\S]*?;/gi)].map((m) => m[0]);
    expect(inserts.length).toBeGreaterThanOrEqual(9);
    for (const ins of inserts) expect(ins, ins.slice(0, 60)).toMatch(/on conflict/i);
    expect(SEMILLA).not.toMatch(/gen_random_uuid\(\)/);
    expect(new Set(SEMILLA.match(/05400000-0000-4000-8000-\d{12}/g)).size).toBeGreaterThanOrEqual(9);
  });

  it("cubre admin, operario VE, operario CN, cliente del Portal y proveedor CN", () => {
    expect(SEMILLA).toMatch(/insert into public\.user_tenants[\s\S]*?'admin'/);
    expect(SEMILLA).toMatch(/'ve'::public\.operario_region/);
    expect(SEMILLA).toMatch(/'cn'::public\.operario_region/);
    expect(SEMILLA).toMatch(/insert into public\.client_users[\s\S]*?'active'/);
    expect(SEMILLA).toMatch(/insert into public\.suppliers_cn/);
    expect(SEMILLA).toMatch(/insert into public\.prealertas[\s\S]*?share_token/);
    expect(SEMILLA).toMatch(/PRUEBA/);
  });

  it("deja Kommo apagado y comprueba la base al final", () => {
    expect(SEMILLA).not.toMatch(/insert into public\.kommo_connections/i);
    expect(SEMILLA).not.toMatch(/vault\.create_secret/);
    expect(SEMILLA).toMatch(/semilla: quedan correos o teléfonos fuera de lo reservado/);
    expect(SEMILLA).toMatch(/kommo_connections tiene % filas/);
  });

  it("empieza con ON_ERROR_STOP y va en una transacción", () => {
    const util = SEMILLA.split("\n").find((l) => l.trim() && !l.trim().startsWith("--"));
    expect(util).toBe("\\set ON_ERROR_STOP on");
    expect(SEMILLA).toMatch(/^begin;$/m);
    expect(SEMILLA.trimEnd().endsWith("commit;")).toBe(true);
  });
});

describe("SDD-0540 · plataforma y .env de prueba", () => {
  it("los default privileges de la plataforma son los mismos que los del rebuild (y que producción)", () => {
    const deLaPlataforma = bloqueDefaults(PLATAFORMA);
    expect(deLaPlataforma).toHaveLength(6);
    expect(deLaPlataforma).toEqual(bloqueDefaults(STUBS));
  });

  it("la plataforma no pisa objetos de GoTrue ni de storage-api", () => {
    expect(PLATAFORMA).not.toMatch(/^create or replace function auth\./im);
    expect(PLATAFORMA).not.toMatch(/^create table (if not exists )?(auth|storage)\./im);
    expect(PLATAFORMA).toMatch(/to_regclass\('auth\.sessions'\) is null/);
    expect(PLATAFORMA).toMatch(/to_regclass\('storage\.buckets'\) is null/);
    expect(PLATAFORMA).toMatch(/add column if not exists created_by text/);
  });

  it("prueba.sets: entorno, registro y hosts de prueba; ninguna integración ni secreto", () => {
    const sets = Object.fromEntries(
      SETS.split("\n").filter((l) => /^[A-Z_][A-Z0-9_]*=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
    expect(sets.APP_ENV).toBe("staging");
    expect(sets.DISABLE_SIGNUP).toBe("true");
    expect(sets.ENABLE_ANONYMOUS_USERS).toBe("false");
    expect(sets.DTD_WEB_HOST).toBe("prueba.dtdcargo.com");
    expect(sets.SUPABASE_PUBLIC_HOST).toBe("supabase-prueba.dtdcargo.com");
    expect(sets.NEXT_PUBLIC_SUPABASE_URL).toBe("https://supabase-prueba.dtdcargo.com");
    expect(sets.NEXT_PUBLIC_SUPABASE_AUTH_COOKIE).not.toMatch(/xpfuzqombmjmxvprjgmi/);
    for (const v of Object.values(sets)) {
      expect(v).not.toMatch(/(^|\/\/|\.)supabase\.dtdcargo\.com|xpfuzqombmjmxvprjgmi/);
      expect(v).not.toBe("");
    }
    // Ninguna clave del bloque de integraciones del .env.example.
    const bloque = EJEMPLO.split("# ── Integraciones de la app")[1].split(/^#{4,}/m)[0];
    const integraciones = [...bloque.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((m) => m[1]);
    expect(integraciones.length).toBeGreaterThan(40);
    expect(Object.keys(sets).filter((k) => integraciones.includes(k))).toEqual([]);
    expect(Object.keys(sets).filter((k) => /(KEY|SECRET|TOKEN|PASSWORD)$/.test(k))).toEqual([]);
  });
});
