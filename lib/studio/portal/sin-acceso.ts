/**
 * "Eres cliente, pero tu acceso al portal no está activo" (SDD-0279).
 *
 * De los clientes vivos del ERP, la mayoría **no tiene ninguna fila en
 * `client_users`**: nunca fueron invitados al portal. Cuando uno de ellos pide
 * el enlace en `/entrar`, el flujo de SDD-0278 no encuentra su fila de acceso y
 * responde la pantalla genérica — correcta contra enumeración, pero el cliente
 * queda esperando un correo que no va a llegar nunca.
 *
 * 🔴 **Y mandarlo a `/registro` NO es la salida.** Se midió el 2026-08-23 contra
 * el código, y falla de dos maneras distintas:
 *
 *  - **Con documento cargado** → el alta choca con `clients_tenant_doc_unique` y
 *    responde "Este documento ya tiene una cuenta … Entra con tu Shipping Mark",
 *    que lo devuelve a `/entrar`, que es donde no le llega nada. Bucle cerrado.
 *  - **Sin documento** → ese índice es PARCIAL (`where rif is not null and
 *    btrim(rif) <> ''`), así que no lo cubre: el alta procede y le emite un
 *    **cliente nuevo con un Shipping Mark nuevo**. Sus envíos y sus facturas
 *    quedan colgando del markbox viejo.
 *
 * Por eso el acceso lo devuelve un **humano** por el flujo de invitación que ya
 * existe, y lo que hace este módulo es encontrar al cliente para poder avisar a
 * las dos partes (ver `sin-acceso-aviso.ts`).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { emailIlikePattern, sameEmail } from "@/lib/shared/email-literal";

export interface ClienteSinAcceso {
  id: string;
  tenant_id: string;
  /** Interno. NUNCA viaja al correo del cliente — ver `sin-acceso-aviso.ts`. */
  markbox: string;
  name: string;
}

/**
 * Busca un cliente VIVO del ERP por su email.
 *
 * Sólo lo llama `/entrar` después de que la búsqueda en `client_users` falló, así
 * que "lo encontró acá" ya significa "es cliente y no tiene acceso".
 *
 * `deleted_at is null` no es cosmético: al fusionar dos clientes, la fila
 * perdedora queda soft-deleted como alias del mismo humano. Avisar sobre ella
 * mandaría al equipo a habilitar un registro muerto.
 *
 * Best-effort: NUNCA tira. `null` = no hay nada que avisar.
 */
export async function findClienteSinAcceso(
  supabaseAdmin: SupabaseClient,
  email: string,
): Promise<ClienteSinAcceso | null> {
  const clean = email.trim();
  if (!clean) return null;

  try {
    // `.limit(1)` antes de `.maybeSingle()`: el email NO es único en `clients`
    // (dos filas pueden compartirlo), y sin el tope `maybeSingle` trataría el
    // segundo resultado como error y devolvería null justo cuando SÍ hay a quién
    // avisar.
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("id, tenant_id, markbox, name, email")
      .ilike("email", emailIlikePattern(clean))
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle<ClienteSinAcceso & { email: string | null }>();
    // SDD-0597 · `sameEmail` porque `*` no se puede escapar (ver `email-literal.ts`).
    // Sin esto, escribir `%@dominio` o un parecido le avisaría al equipo de un
    // cliente que nadie nombró.
    if (error || !data || !sameEmail(data.email, clean)) return null;
    return data;
  } catch {
    return null;
  }
}
