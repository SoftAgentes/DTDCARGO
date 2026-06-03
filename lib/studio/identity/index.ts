/**
 * Motor de verificación de identidad (SDD-0046 · Slice B).
 *
 * `verifyIdentity` es el corazón del Slice B: rutea por tipo de documento, llama
 * al provider del registro oficial, y compara el nombre devuelto contra el del
 * cliente con `compareNames`. **Nunca tira** — cualquier falla (provider caído,
 * timeout, doc no parseable, vía empresa sin auto todavía) degrada a `unavailable`,
 * que aguas abajo cae al piso manual del asesor.
 *
 *   persona (o classifyDocument(rif)==='persona') → provider CNE.
 *   empresa                                       → SENIAT (Slice C) → hoy unavailable.
 *
 * El resultado es ADVISORY (no bloquea al cliente). Ver SDD-0046 §5.2.
 *
 * El provider CNE se elige por env `IDENTITY_CNE_PROVIDER` (default 'cedulave')
 * vía la factory `getCneProvider()`, que es el punto mockeable en tests
 * (`vi.mock('@/lib/studio/identity', ...)` o spy sobre `getCneProvider`).
 */

import { classifyDocument, parseCedula, type DocumentKind } from "./document";
import { compareNames } from "./name-match";
import type {
  IdentityProvider,
  VerifyIdentityInput,
  VerifyResult,
} from "./types";

export type {
  IdentityProvider,
  VerifyResult,
  VerifyIdentityInput,
  VerifySource,
} from "./types";

/**
 * Resolución del provider CNE, agrupada en un objeto para que sea **interceptable
 * en tests**. `verifyIdentity` llama `providerRegistry.getCneProvider()` (no la
 * función suelta), así un `vi.spyOn(providerRegistry, 'getCneProvider')` —o el
 * helper exportado `__setCneProviderForTests`— sustituye el provider sin tocar
 * red. (Un `vi.spyOn` sobre el export suelto NO funcionaría: el call interno usa
 * el binding local, no el namespace del módulo.)
 */
export const providerRegistry = {
  /**
   * Devuelve el provider CNE según `IDENTITY_CNE_PROVIDER` (default 'cedulave').
   * Factory (no singleton). Los providers se importan dinámicamente para que el
   * `server-only` de las impls no contamine el grafo de import del motor en test.
   */
  async getCneProvider(): Promise<IdentityProvider> {
    const choice = (
      process.env.IDENTITY_CNE_PROVIDER ?? "cedulave"
    ).toLowerCase();
    if (choice === "verifik") {
      const { createVerifikProvider } = await import("./providers/cne-verifik");
      return createVerifikProvider();
    }
    const { createCedulaVeProvider } = await import(
      "./providers/cne-cedulave"
    );
    return createCedulaVeProvider();
  },
};

/** Acceso conveniente a la factory (delegación al registry interceptable). */
export function getCneProvider(): Promise<IdentityProvider> {
  return providerRegistry.getCneProvider();
}

// ── Gating del auto (V1 manual-only) ─────────────────────────────────────────
// La verificación AUTO no está habilitada hasta que haya un provider confiable
// wired. Hoy (2026-06-03): no hay wrapper CNE gratis hosteado utilizable (caído /
// geo-restringido desde Vercel) y SENIAT (Slice C) no se construyó. Estos helpers
// le dicen a la UI si mostrar el botón "Verificar con CNE/SENIAT" o degradar
// directo al piso manual (en vez de ofrecer un botón que siempre falla).
//
// Son funciones (no const) a propósito: el flip a "habilitado" es trivial de
// hacer (setear `IDENTITY_CNE_URL`, o cambiar `isSeniatAutoEnabled`) sin tocar la
// firma. Solo válidas server-side (leen `process.env`).

/** ¿Hay un provider CNE wired? → habilitado solo si `IDENTITY_CNE_URL` está seteada. */
export function isCneAutoEnabled(): boolean {
  return !!process.env.IDENTITY_CNE_URL && process.env.IDENTITY_CNE_URL.trim().length > 0;
}

/**
 * ¿Hay auto-SENIAT (empresa)? Hoy `false` — Slice C (scrape + OCR del CAPTCHA) no
 * se construyó. Función (no const) para flipear fácil cuando exista el provider.
 */
export function isSeniatAutoEnabled(): boolean {
  return false;
}

/**
 * ¿Mostrar el botón de verificación AUTOMÁTICA para este tipo de documento?
 *   - persona / unknown / null → CNE (`isCneAutoEnabled`).
 *   - empresa                  → SENIAT (`isSeniatAutoEnabled`).
 * Si devuelve `false`, la UI degrada al piso manual sin ofrecer el botón auto.
 */
export function isAutoVerifyEnabled(
  docKind: "persona" | "empresa" | null | "unknown",
): boolean {
  if (docKind === "empresa") return isSeniatAutoEnabled();
  return isCneAutoEnabled();
}

/** Resuelve el tipo de documento: el persistido, o inferido del `rif`. */
function resolveDocKind(
  rif: string | null,
  docKind: DocumentKind | null,
): "persona" | "empresa" | "unknown" {
  if (docKind === "persona" || docKind === "empresa") return docKind;
  return classifyDocument(rif);
}

/**
 * Verifica la identidad del cliente contra el registro oficial.
 *
 * Garantías:
 *  - Nunca lanza (todo error/timeout/provider-null → `unavailable`).
 *  - persona → CNE; empresa → SENIAT (Slice C, hoy `unavailable`).
 *  - cédula no parseable → `unavailable` (no se le pega al CNE con basura).
 *  - provider devuelve nombre → `compareNames(name, registryName)` decide el verdict.
 */
export async function verifyIdentity(
  input: VerifyIdentityInput,
): Promise<VerifyResult> {
  const kind = resolveDocKind(input.rif, input.docKind);

  // Vía empresa: el auto-SENIAT es Slice C (gated por spike). Hoy la empresa cae
  // al piso manual de B2 → reportamos unavailable con source seniat.
  if (kind === "empresa") {
    return { status: "unavailable", source: "seniat" };
  }

  // Cualquier otro caso (persona explícita, inferida, o unknown) se intenta por
  // CNE: el ruteo es por cédula. Si el doc no parsea como cédula → unavailable.
  const cedula = parseCedula(input.rif);
  if (!cedula) {
    return { status: "unavailable", source: "cne" };
  }

  let lookup: { registryName: string } | null;
  try {
    const provider = await providerRegistry.getCneProvider();
    lookup = await provider.lookup(cedula.number);
  } catch {
    // El provider tiró (red, timeout sin tragar, stub no configurado, etc.).
    return { status: "unavailable", source: "cne" };
  }

  if (!lookup || !lookup.registryName) {
    // No se encontró la cédula / el registro no respondió útil.
    return { status: "unavailable", source: "cne" };
  }

  const { score, verdict } = compareNames(input.name, lookup.registryName);
  return {
    status: verdict, // 'ok' | 'mismatch'
    source: "cne",
    registryName: lookup.registryName,
    score,
  };
}
