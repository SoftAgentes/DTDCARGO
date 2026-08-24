/**
 * Anti-drift de RBAC en LECTURA (SDD-0286): todo route handler de
 * `app/api/studio/**` que exporte `GET` debe llamar `moduleViewDenial(...)`,
 * porque los endpoints son invocables directo y **RLS filtra por TENANT pero
 * es ciega al ROL**: sin el guard, un usuario del tenant sin el módulo en su
 * alcance lee el endpoint igual, aunque el módulo no le aparezca en el sidebar.
 *
 * Es el gemelo de `rbac-actions-guard.test.ts` (SDD-0085), que vigila el lado
 * de MUTACIÓN con `moduleEditDenial`. Medido el 2026-08-18, antes de esta
 * spec: de 14 GET, sólo 2 tenían gate de módulo.
 *
 * Si agregás un GET nuevo: agregá el guard. Si de verdad NO lo necesita
 * (autorización propia más fina / abierto por diseño), documentá la excepción
 * acá con su razón. Mantené la lista CORTA — cada entrada es una excepción de
 * seguridad que alguien debería poder defender en un review.
 */
import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * ⏱️ I/O-BOUND: recorre el árbol de archivos, igual que los otros contratos.
 * Ver la nota larga en `rbac-actions-guard.test.ts` — el timeout se sube ACÁ
 * y no en `vitest.config.ts` para no relajar los ~5.000 tests restantes.
 */
vi.setConfig({ testTimeout: 120_000 });

const STUDIO_API = join(process.cwd(), "app", "api", "studio");

// path relativo (con "/") -> razón de por qué su GET NO lleva moduleViewDenial.
const ALLOWLIST: Record<string, string> = {
  "bugs/route.ts": "Bug Reporter: cualquier miembro del staff lista sus bugs (abierto por diseño, igual que bugs/actions.ts en SDD-0085).",
  "bugs/[id]/route.ts": "Bug Reporter: abierto por diseño.",
  "bugs/[id]/messages/route.ts": "Bug Reporter: abierto por diseño.",
  "bugs/[id]/prompt/route.ts": "Bug Reporter: abierto por diseño.",
  "bugs/[id]/replay/route.ts": "Bug Reporter: abierto por diseño.",
  "attachments/[id]/download/route.ts":
    "Autorización propia por adjunto: `authorizeAttachmentDownload` resuelve el documento con el cliente CON RLS y exige scan_status limpio, bucket e identidad canónica de object_key, más `requireAttachmentsPilot()`. Un gate de módulo fijo sería además incorrecto: el adjunto es polimórfico y su módulo depende de la entidad dueña, no del endpoint.",
  "comercial/export/route.ts":
    "Gate propio por TIPO de export, no por endpoint: `canAccessModule(role, \"quotes\", overrides)` para estimados e `invoices` para facturas, con los overrides del SDD-0085. Un moduleViewDenial fijo elegiría el módulo equivocado en una de las dos ramas.",
  "audit/export/route.ts":
    "Autorización propia por request: la RPC `audit_authorize_export_download` decide con el cliente CON RLS y devuelve 403 si no autoriza — más fina que un gate de módulo. El admin client sólo firma la URL ya autorizada.",
};

function findRoutes(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      findRoutes(full, acc);
    } else if (entry === "route.ts") {
      acc.push(full);
    }
  }
  return acc;
}

/** Sólo nos importan los handlers que de verdad exponen lectura. */
function exportsGet(src: string): boolean {
  return /^export\s+(?:async\s+)?function\s+GET\b/m.test(src);
}

describe("RBAC anti-drift · GET de la API del Studio (SDD-0286)", () => {
  const files = findRoutes(STUDIO_API);
  const withGet = files.filter((f) => exportsGet(readFileSync(f, "utf8")));

  it("encuentra los route handlers con GET (sanity)", () => {
    // Si el escaneo se rompe, 0 archivos darían 0 tests y el contrato saldría
    // verde sin haber medido nada. El número importa, no el color.
    expect(files.length).toBeGreaterThan(15);
    expect(withGet.length).toBeGreaterThan(10);
  });

  for (const file of withGet) {
    const rel = relative(STUDIO_API, file).split(sep).join("/");
    it(`${rel} llama moduleViewDenial o está en la allowlist`, () => {
      const src = readFileSync(file, "utf8");
      const hasGuard = src.includes("moduleViewDenial");
      const allowed = rel in ALLOWLIST;

      if (!hasGuard && !allowed) {
        throw new Error(
          `${rel} expone GET sin moduleViewDenial y no está en la ALLOWLIST. ` +
            `Agregá el guard (SDD-0286) tras validar la sesión, o documentá la excepción en ALLOWLIST.`,
        );
      }
      if (hasGuard && allowed) {
        throw new Error(
          `${rel} ya tiene moduleViewDenial → quitá su entrada obsoleta de la ALLOWLIST.`,
        );
      }
    });
  }

  it("la ALLOWLIST no tiene entradas muertas", () => {
    const reales = new Set(withGet.map((f) => relative(STUDIO_API, f).split(sep).join("/")));
    const muertas = Object.keys(ALLOWLIST).filter((k) => !reales.has(k));
    expect(muertas, `entradas de ALLOWLIST que ya no existen: ${muertas.join(", ")}`).toEqual([]);
  });
});
