import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createBrowserClient } from "@supabase/ssr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionCookieName, sessionCookieOptions } from "../session-cookie";

// SDD-0505: el host de Supabase cambia en el servidor propio y, con él, el nombre
// por defecto de la cookie de sesión. Estas pruebas fijan que el nombre se puede
// conservar y que ningún cliente de @supabase/ssr se queda sin la opción.

const CLOUD = "sb-xpfuzqombmjmxvprjgmi-auth-token";
const URL_PROPIA = "https://supabase.dtdcargo.com";
const ANON = "anon-de-prueba";

function storageKey(): string {
  const client = createBrowserClient(URL_PROPIA, ANON, {
    cookieOptions: sessionCookieOptions(),
    isSingleton: false,
  });
  return (client.auth as unknown as { storageKey: string }).storageKey;
}

describe("nombre de la cookie de sesión", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sin la variable no fija nada: queda el nombre de supabase-js", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_AUTH_COOKIE", "");
    expect(sessionCookieName()).toBeUndefined();
    expect(sessionCookieOptions()).toBeUndefined();
  });

  it("solo espacios cuenta como vacía", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_AUTH_COOKIE", "   ");
    expect(sessionCookieOptions()).toBeUndefined();
  });

  it("con la variable devuelve el nombre recortado", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_AUTH_COOKIE", ` ${CLOUD} `);
    expect(sessionCookieOptions()).toEqual({ name: CLOUD });
  });

  it("control: con el host propio y sin fijar, el nombre cambia (todos perderían la sesión)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_AUTH_COOKIE", "");
    expect(storageKey()).toBe("sb-supabase-auth-token");
  });

  it("con el host propio y el nombre fijado, la sesión se lee con el nombre de hoy", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_AUTH_COOKIE", CLOUD);
    expect(storageKey()).toBe(CLOUD);
  });
});

describe("todos los clientes de @supabase/ssr pasan el nombre", () => {
  const raiz = join(__dirname, "..", "..", "..");
  const clientes = ["lib/db/client.ts", "lib/db/server.ts", "proxy.ts"];

  function archivos(dir: string, out: string[] = []): string[] {
    for (const nombre of readdirSync(dir)) {
      if (nombre === "node_modules" || nombre.startsWith(".") || nombre === "__tests__") continue;
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) archivos(ruta, out);
      else if (/\.(ts|tsx)$/.test(nombre)) out.push(ruta);
    }
    return out;
  }

  it.each(clientes)("%s usa sessionCookieOptions()", (rel) => {
    const src = readFileSync(join(raiz, rel), "utf8");
    expect(src).toMatch(/cookieOptions:\s*sessionCookieOptions\(\)/);
  });

  it("no hay otro archivo que cree clientes de @supabase/ssr", () => {
    const usan = [...archivos(join(raiz, "app")), ...archivos(join(raiz, "lib")), join(raiz, "proxy.ts")]
      .filter((f) => /from\s+["']@supabase\/ssr["']/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(raiz.length + 1).replace(/\\/g, "/"))
      .sort();
    expect(usan).toEqual([...clientes].sort());
  });
});
