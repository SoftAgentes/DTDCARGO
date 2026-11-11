/**
 * /studio/marketing/noticias-web/publicadas · Server Actions — SDD-0625.
 *
 * Corregir, retirar y volver a publicar una noticia que ya está en /noticias.
 *
 *  - guardarEdicion   · UPDATE de titular, bajada, cuerpo, categoría y SEO.
 *                        El slug, `published` y el origen NO se escriben.
 *  - retirarNoticia   · `news_retirar` (0518): motivo obligatorio de §4.11.
 *  - volverAPublicar  · `news_volver_a_publicar` (0518).
 *
 * Todas exigen admin ACTIVO (`tenantAdminGate`, igual que publishPost): las
 * policies de `news_posts` (0055) no miran `disabled_at`. Quién y cuándo queda
 * en `entity_audit_log` por el disparador de la migración 0532, en la misma
 * transacción; la acción no escribe bitácora a mano.
 *
 * El sitio público revalida cada 300 s (ISR). Además se llama a
 * `revalidatePath` como publishPost: si Studio y sitio comparten despliegue, el
 * cambio se ve en el siguiente pedido; si no, tarda hasta 5 minutos.
 */

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import { tenantAdminGate } from "@/lib/studio/rbac-guard";
import type { NewsTipo } from "@/lib/news/categories";
import { validarEdicion, type EdicionNoticia } from "@/lib/news/edicion";
import { validarRetiro, type ErrorRetiro } from "@/lib/news/autopublicar/motivos";

const ADMIN_MSG = "Solo un admin puede cambiar noticias publicadas";

export type ResultadoNoticia = { ok: true; slug: string } | { ok: false; error: string };

const MENSAJE_RETIRO: Record<ErrorRetiro, string> = {
  motivo_obligatorio: "Elige el motivo del retiro",
  nota_obligatoria: "Con «Otro» la nota es obligatoria",
  nota_larga: "La nota pasa de 1000 caracteres",
  nota_con_datos_personales:
    "La nota parece traer datos personales (teléfono, correo, cédula, RIF o dirección): quítalos",
};

/** Traduce el error de la base sin mostrar el texto crudo de Postgres. */
function errorDeBase(error: { code?: string; message?: string } | null, accion: string): string {
  switch (error?.code) {
    case "42501":
      return ADMIN_MSG;
    case "P0002":
      return accion === "volver"
        ? "Esa noticia ya no está retirada"
        : "Esa noticia ya no está publicada";
    case "23514":
      return "Quedan marcas [VERIFICAR] sin resolver: corrígelas antes de publicar";
    case "22023":
      return "Revisa el motivo y la nota del retiro";
    default:
      return `No se pudo ${accion === "volver" ? "volver a publicar" : accion === "retirar" ? "retirar" : "guardar"} la noticia. Intenta de nuevo.`;
  }
}

function revalidarSitio(slug: string) {
  revalidatePath("/noticias");
  revalidatePath(`/noticias/${slug}`);
  revalidatePath("/sitemap.xml");
  revalidatePath("/studio/marketing/noticias-web/publicadas");
}

async function gateAdmin() {
  const supabase = await createClient();
  const gate = await tenantAdminGate(supabase, { denied: ADMIN_MSG, noTenant: ADMIN_MSG });
  return { supabase, gate };
}

const esUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function guardarEdicion(
  id: string,
  input: EdicionNoticia,
): Promise<ResultadoNoticia> {
  const { supabase, gate } = await gateAdmin();
  if (!gate.ok) return { ok: false, error: gate.denied };
  if (!esUuid(id)) return { ok: false, error: "Noticia inválida" };

  // El tipo sale de la fila guardada, no del formulario.
  const { data: actual, error: errLectura } = await supabase
    .from("news_posts")
    .select("id, tipo, slug")
    .eq("id", id)
    .eq("tenant_id", gate.tenantId)
    .eq("published", true)
    .maybeSingle<{ id: string; tipo: NewsTipo; slug: string }>();
  if (errLectura) return { ok: false, error: errorDeBase(errLectura, "guardar") };
  if (!actual) return { ok: false, error: "Esa noticia ya no está publicada" };

  const validacion = validarEdicion(input, actual.tipo);
  if (!validacion.ok) return validacion;

  const { data: guardada, error } = await supabase
    .from("news_posts")
    .update(validacion.cambios)
    .eq("id", id)
    .eq("tenant_id", gate.tenantId)
    .eq("published", true)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) return { ok: false, error: errorDeBase(error, "guardar") };
  if (!guardada) return { ok: false, error: "Esa noticia ya no está publicada" };

  // El slug es el de la fila leída: la edición nunca lo cambia.
  revalidarSitio(actual.slug);
  return { ok: true, slug: actual.slug };
}

export async function retirarNoticia(
  id: string,
  motivo: string,
  nota: string,
): Promise<ResultadoNoticia> {
  const { supabase, gate } = await gateAdmin();
  if (!gate.ok) return { ok: false, error: gate.denied };
  if (!esUuid(id)) return { ok: false, error: "Noticia inválida" };

  const invalido = validarRetiro(motivo, nota);
  if (invalido) return { ok: false, error: MENSAJE_RETIRO[invalido] };

  const { data: slug, error } = await supabase.rpc("news_retirar", {
    p_post_id: id,
    p_motivo: motivo,
    p_nota: nota.trim(),
  });
  if (error || typeof slug !== "string") return { ok: false, error: errorDeBase(error, "retirar") };

  revalidarSitio(slug);
  return { ok: true, slug };
}

export async function volverAPublicar(id: string): Promise<ResultadoNoticia> {
  const { supabase, gate } = await gateAdmin();
  if (!gate.ok) return { ok: false, error: gate.denied };
  if (!esUuid(id)) return { ok: false, error: "Noticia inválida" };

  // El CHECK news_posts_sin_marca_verificar (0518) rechaza volver a publicar un
  // texto con marcas: la fila retirada no se puede leer desde aquí (la policy de
  // lectura de 0055 solo deja ver las publicadas).
  const { data: slug, error } = await supabase.rpc("news_volver_a_publicar", { p_post_id: id });
  if (error || typeof slug !== "string") return { ok: false, error: errorDeBase(error, "volver") };

  revalidarSitio(slug);
  return { ok: true, slug };
}
