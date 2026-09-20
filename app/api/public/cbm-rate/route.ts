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
 * QUÉ PASA CUANDO LA TARIFA VENCE: el sitio sigue cotizando el mismo precio.
 * Desde la migración 0458 (SDD-0476, aplicada a producción el 2026-09-18,
 * ledger `20260918040814`) la vigencia no es filtro de lectura: la RPC sirve el
 * último precio de la base aunque `valid_until` ya haya pasado. La respuesta
 * `{ per_cbm: null }` queda para cuando de verdad no hay tarifa: Supabase caído,
 * borrador, `is_public` sin marcar o `valid_from` a futuro. Sólo en esos casos
 * las páginas Next caen a `CONFIG.tarifaBaseCBM`, una constante del código.
 *
 * Decisión del founder (2026-09-17): «aunque la tarifa se venza o esté vencida,
 * se mantiene el precio anterior; lo que leemos acá es la base de datos». La
 * 0458 la cumple por diseño. El vencimiento lo vigilan el cron
 * `app/api/cron/rate-expiry-alert` (Telegram + email) y el badge de
 * `/studio/tarifas`.
 *
 * Quien quiera distinguir vigente de vencida lo deriva de `valid_until`. El
 * handler no agrega señal propia: la calcularía al construir la respuesta y el
 * `s-maxage=300` la dejaría congelada, mientras que la fecha no caduca.
 *
 * `app/api/**` está fuera de la frontera ESLint público↔ERP, así que puede
 * importar `lib/public/*` (mismo argumento que `app/api/registro/check`).
 *
 * Al 2026-09-17 devolvía
 * `{ per_cbm: 850, min_charge: 50, valid_until: "2026-11-29" }`.
 *
 * Respuesta: `{ per_cbm, min_charge, valid_until }`, o `{ per_cbm: null }` si la
 * RPC no devolvió tarifa (cuándo pasa eso, arriba). NUNCA 500: la guía tiene su
 * propio fallback y un error acá no puede tumbarle la calculadora.
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
