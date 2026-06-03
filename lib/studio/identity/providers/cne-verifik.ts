/**
 * Provider CNE pago (Verifik) — STUB documentado (SDD-0046 · Slice B).
 *
 * Hueco para el swap al provider PAGO (Verifik u otro) cuando el wrapper gratis
 * (`cne-cedulave`) no rinda o se quiera más confiabilidad. Hoy NO está cableado:
 * se elige con `IDENTITY_CNE_PROVIDER=verifik` (default es `cedulave`).
 *
 * Sigue la regla del founder "arrancar gratis": el pago queda diferido y
 * swappeable por el adapter, sin tocar el motor ni la server action.
 *
 * Cuando se implemente: leer la API key de Verifik por env, hacer el `fetch`
 * autenticado a su consulta por cédula, mapear su respuesta a `{ registryName }`.
 */

import "server-only";
import type { IdentityProvider } from "../types";

export function createVerifikProvider(): IdentityProvider {
  return {
    async lookup(): Promise<{ registryName: string } | null> {
      throw new Error(
        "IDENTITY: Verifik provider no configurado (stub) — usá IDENTITY_CNE_PROVIDER=cedulave o implementá el swap pago.",
      );
    },
  };
}
