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
 * Con las variables presentes, o contra un destino que no es local (un
 * Preview), no hace nada y la prueba corre igual que antes.
 *
 * Qué pruebas la usan y con qué evidencia: e2e/README.md, sección «Sin
 * Supabase público».
 */
export function requiereSupabase(): void {
  const motivo = omisionSinSupabase({ baseURL: test.info().project.use.baseURL });
  test.skip(motivo !== null, motivo ?? undefined);
}
