// @vitest-environment node
/**
 * SDD-0626 · «Oficina_Virtual» (Sam, 2026-11-20). La oficina de agentes se llama así en pantalla, con guion bajo, y
 * vive en `/studio/admin/oficina-virtual`. La dirección vieja `/studio/admin/oficina` (la de los avisos de Discord
 * ya enviados y los marcadores) redirige con un 308 permanente, con sus subrutas y el query string.
 *
 * Lo interno NO cambia de nombre: `lib/studio/oficina/`, las tablas `office_*`, las variables `OFICINA_*`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { NextConfig } from "next";
import { getPathMatch } from "next/dist/shared/lib/router/utils/path-match";
import { describe, expect, it, vi } from "vitest";

import { RUTA_REVISION, avisoDePendientes } from "../aviso-pendientes";

const ROOT = resolve(__dirname, "..", "..", "..", "..");
const CARPETA = "app/studio/(app)/admin/oficina-virtual";

type Redireccion = { source: string; destination: string; permanent?: boolean; has?: unknown[]; missing?: unknown[] };

/** Las reglas que aplican en dtdcargo.com: fuera las que dependen del host (la red de seguridad de doortudoor.com). */
async function redirecciones(): Promise<Redireccion[]> {
  vi.resetModules();
  const mod = (await import("../../../../next.config")) as { default: NextConfig };
  const todas = ((await mod.default.redirects?.()) ?? []) as Redireccion[];
  return todas.filter((r) => !r.has?.length && !r.missing?.length);
}

/** A dónde manda Next una ruta: la primera regla que calza, como hace el servidor. Null si ninguna calza. */
function destinoDe(reglas: Redireccion[], ruta: string): { destino: string; permanente: boolean } | null {
  for (const regla of reglas) {
    const params = getPathMatch(regla.source)(ruta);
    if (!params) continue;
    const destino = regla.destination.replace(/\/:(\w+)\*/g, (_m, nombre: string) => {
      const valor = (params as Record<string, string | string[] | undefined>)[nombre];
      const partes = Array.isArray(valor) ? valor : valor ? [valor] : [];
      return partes.length ? `/${partes.join("/")}` : "";
    });
    return { destino, permanente: regla.permanent === true };
  }
  return null;
}

describe("Oficina_Virtual · la dirección vieja redirige", () => {
  it("/studio/admin/oficina → /studio/admin/oficina-virtual, permanente", async () => {
    expect(destinoDe(await redirecciones(), "/studio/admin/oficina")).toEqual({
      destino: "/studio/admin/oficina-virtual",
      permanente: true,
    });
  });

  it("las subrutas también: /vista → /studio/admin/oficina-virtual/vista", async () => {
    expect(destinoDe(await redirecciones(), "/studio/admin/oficina/vista")).toEqual({
      destino: "/studio/admin/oficina-virtual/vista",
      permanente: true,
    });
  });

  it("la dirección nueva no redirige (sin bucle) y la mesa de Administración tampoco", async () => {
    const reglas = await redirecciones();
    expect(destinoDe(reglas, "/studio/admin/oficina-virtual")).toBeNull();
    expect(destinoDe(reglas, "/studio/admin/oficina-virtual/vista")).toBeNull();
    expect(destinoDe(reglas, "/studio/admin")).toBeNull();
  });

  it("la carpeta vieja ya no existe y la nueva tiene la revisión y la mini-vista", () => {
    expect(existsSync(resolve(ROOT, "app/studio/(app)/admin/oficina"))).toBe(false);
    expect(existsSync(resolve(ROOT, CARPETA, "page.tsx"))).toBe(true);
    expect(existsSync(resolve(ROOT, CARPETA, "vista/page.tsx"))).toBe(true);
    expect(existsSync(resolve(ROOT, CARPETA, "layout.tsx"))).toBe(true);
  });
});

describe("Oficina_Virtual · el nombre en pantalla", () => {
  const leer = (f: string) => readFileSync(resolve(ROOT, CARPETA, f), "utf8");

  it("los títulos de página y los encabezados dicen Oficina_Virtual, tal cual (sin mayúsculas forzadas)", () => {
    for (const f of ["page.tsx", "vista/page.tsx"]) {
      const codigo = leer(f);
      expect(codigo).toMatch(/title: "Oficina_Virtual · /);
      expect(codigo).toContain('<span style={{ textTransform: "none" }}>Oficina_Virtual</span> · SDD-0626');
      expect(codigo).not.toMatch(/^\s*Oficina · SDD-0626/m);
    }
  });

  it("revalidatePath y los enlaces apuntan a la ruta nueva", () => {
    expect(leer("actions.ts")).toContain('const RUTA = "/studio/admin/oficina-virtual";');
    expect(leer("page.tsx")).toContain('href="/studio/admin/oficina-virtual/vista"');
    expect(leer("vista/page.tsx")).toContain('href="/studio/admin/oficina-virtual"');
  });

  it("el aviso de Discord dice Oficina_Virtual y enlaza la ruta nueva", () => {
    expect(RUTA_REVISION).toBe("/studio/admin/oficina-virtual");
    expect(avisoDePendientes(2, "https://dtdcargo.com/").titulo).toBe("Oficina_Virtual: hay 2 borradores pendientes de revisión");
    expect(avisoDePendientes(2, "https://dtdcargo.com/").url).toBe("https://dtdcargo.com/studio/admin/oficina-virtual");
  });
});
