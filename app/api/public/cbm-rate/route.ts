/**
 * /api/public/cbm-rate · GET — la tarifa pública por CBM, para HTML estático.
 * SDD-0474.
 *
 * La guía de Alibaba (`public/guias/comprar-en-alibaba.html`) es un HTML suelto
 * en `/public`: sin React, sin SSR y sin acceso a `lib/`. Las páginas Next leen
 * la tarifa server-side vía RPC anon (`lib/public/rates-queries.ts`), vía que un
 * archivo estático no tiene — necesita HTTP. Este handler es ese puente.
 *
 * Por qué no cablear el número en la guía: la tarifa se mueve desde
 * `/studio/tarifas`, y la migración `0336_rate_ddp_850_septiembre_2026.sql` ya
 * la subió con pg_cron de $800 a $850. Una cifra copiada al HTML empezaría a
 * mentir sin que nadie lo note.
 *
 * ⚠️ Al vencer la vigencia esta RPC devuelve null y el sitio cae a
 * `CONFIG.tarifaBaseCBM`. Desde SDD-0475 ese respaldo también vale $850, así que
 * el precio **ya no cambiará al vencer** — antes caía a $800 y el salto se veía.
 * El vencimiento dejó de tener síntoma: lo vigilan el cron de
 * `app/api/cron/rate-expiry-alert` (Telegram + email) y el test de vigencia de
 * `__tests__/calculadora-respaldo-alineado.test.ts`.
 *
 * `app/api/**` está fuera de la frontera ESLint público↔ERP, así que puede
 * importar `lib/public/*` (mismo argumento que `app/api/registro/check`).
 *
 * Respuesta: `{ per_cbm, min_charge, valid_until }`, o `{ per_cbm: null }` si no
 * hay tarifa pública vigente. NUNCA 500: la guía tiene su propio fallback y un
 * error acá no puede tumbarle la calculadora.
 */

import { NextResponse } from "next/server";
import { getPublicCbmRate } from "@/lib/public/rates-queries";

export const runtime = "nodejs";
// Mismo horizonte que /tarifas y /tarifas/embed: las actions de /studio/tarifas
// hacen revalidatePath de esas rutas, no de esta, así que el techo son 5 min.
export const revalidate = 300;

export async function GET() {
  // getPublicCbmRate ya no tira nunca (try/catch interno → null). El catch de
  // acá cubre lo que quede: import roto, env ausente al construir el cliente.
  let rate: Awaited<ReturnType<typeof getPublicCbmRate>> = null;
  try {
    rate = await getPublicCbmRate();
  } catch (e) {
    console.error(
      "[api/public/cbm-rate] error inesperado:",
      e instanceof Error ? e.message : String(e),
    );
  }

  return NextResponse.json(
    rate
      ? {
          per_cbm: rate.per_cbm,
          min_charge: rate.min_charge,
          valid_until: rate.valid_until,
        }
      : { per_cbm: null, min_charge: null, valid_until: null },
    {
      status: 200,
      headers: {
        // Cacheable por ser lectura pública sin identificadores: no hace falta
        // el throttle de los POST de `app/api/public/*`.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
