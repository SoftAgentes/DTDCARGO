import { test } from "@playwright/test";
import { omisionSinSupabase } from "./supabase-publico.cjs";

/**
 * SDD-0470 · Declara que la prueba en curso necesita Supabase público en el
 * `next dev` local.
 *
 * Va en la PRIMERA línea del cuerpo del test, antes de navegar. Si faltan
 * `NEXT_PUBLIC_SUPABASE_URL` o `NEXT_PUBLIC_SUPABASE_ANON_KEY` (en el entorno
 * o en los `.env*` que carga Next), `proxy.ts` no puede crear su cliente y la
 * ruta responde error. Entonces la prueba se OMITE con un motivo que empieza
 * por `MARCA_SIN_SUPABASE`, y `pnpm verify` la cuenta y declara el e2e con
 * COBERTURA PARCIAL. Nunca pasa en falso ni se reintenta por la ausencia.
 *
 * SDD-0479 · Si Playwright levantó su `next dev` contra el Supabase sintético
 * deny-only (`metadata.supabaseE2E.modo === "sintetico"` en
 * `playwright.config.ts`), ese servidor sí tiene URL y anon key: la prueba
 * corre. El proceso del worker no las ve en su entorno, por eso se lee el modo.
 *
 * Con las variables presentes, o contra un destino que no es local (un
 * Preview), no hace nada y la prueba corre igual que antes.
 *
 * Qué pruebas la usan y con qué evidencia: e2e/README.md, sección «Sin
 * Supabase público».
 */
export function requiereSupabase(): void {
  if (modoSupabaseE2E() === "sintetico") return;
  const motivo = omisionSinSupabase({ baseURL: test.info().project.use.baseURL });
  test.skip(motivo !== null, motivo ?? undefined);
}

/** El modo que decidió `playwright.config.ts` para esta corrida, o `null`. */
function modoSupabaseE2E(): string | null {
  const supabaseE2E = (test.info().config.metadata as { supabaseE2E?: { modo?: unknown } } | undefined)
    ?.supabaseE2E;
  return typeof supabaseE2E?.modo === "string" ? supabaseE2E.modo : null;
}
