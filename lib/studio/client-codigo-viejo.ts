/**
 * Buscar un cliente por un Shipping Mark que ya no es el suyo (SDD-0664).
 *
 * Un cliente puede haber tenido otros códigos:
 *   - renombrado (SDD-0258): el viejo queda en `client_markbox_history` (0367).
 *     Es el caso de los clientes del legado que hoy son `DTD-8xxx`;
 *   - fusión (SDD-0246): la ficha absorbida queda eliminada, con su código y
 *     `merged_into_client_id` apuntando a la que sobrevive (0341).
 *
 * La mercancía sigue llegando rotulada con el código de antes. Esto encuentra a
 * qué cliente VIVO lleva un código viejo, siguiendo la cadena de fusiones.
 *
 * Aislamiento: no hay filtro de tenant propio. Lo hace la RLS de las dos tablas
 * (`client_markbox_history by tenant`, 0367; `clients by tenant`, 0456), igual
 * que en el resto de `client-queries`. Como segunda barrera, un código del
 * historial solo vale si su tenant es el del cliente al que apunta.
 *
 * Privacidad (SDD-0531): solo lee y devuelve Shipping Marks e ids, no nombres.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Tope de saltos de la cadena de fusiones, el mismo de `resolve_markbox` (0341/0367). */
const MAX_SALTOS_FUSION = 10;

/** Tope de códigos viejos por búsqueda: un fragmento corto no arma una lista enorme. */
export const TOPE_CODIGOS_VIEJOS = 50;

/**
 * La parte del texto que identifica un código, sin el prefijo «DTD», sin
 * espacios ni guiones: «dtd z901», «DTD-Z901» y «z901» dan «z901» o «Z901», tal
 * como se escribió (la comparación no distingue mayúsculas).
 *
 * `null` si el texto no parece un código: sin dígitos, de menos de dos
 * caracteres o demasiado largo. Así un nombre no gasta una consulta.
 */
export function nucleoDeCodigo(q: string | null | undefined): string | null {
  const limpio = (q ?? "").replace(/[*,()]/g, " ").replace(/\s+/g, " ").trim();
  if (!limpio) return null;
  const sinPrefijo = /^dtd[\s-]*(.*)$/i.exec(limpio);
  const nucleo = (sinPrefijo ? sinPrefijo[1] : limpio).replace(/[\s-]+/g, "");
  if (nucleo.length < 2 || nucleo.length > 16) return null;
  if (!/\d/.test(nucleo)) return null;
  if (!/^[\p{L}\p{N}]+$/u.test(nucleo)) return null;
  return nucleo;
}

/** Escapa los comodines de `.ilike()`: el texto se busca tal cual. */
function literal(texto: string): string {
  return texto.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** ¿`codigo` es `nucleo` con o sin el prefijo «DTD-»? Sin distinguir mayúsculas. */
function esElMismoCodigo(codigo: string, nucleo: string): boolean {
  const c = codigo.trim().toLowerCase().replace(/[\s-]+/g, "");
  const n = nucleo.toLowerCase();
  return c === n || c === `dtd${n}`;
}

type FilaCliente = {
  id: string;
  tenant_id: string | null;
  markbox: string | null;
  merged_into_client_id: string | null;
  deleted_at: string | null;
};

/**
 * Clientes VIVOS a los que lleva un código viejo que coincide con `q`.
 * Devuelve `id del cliente vivo → código viejo que coincidió`.
 *
 * `modo`:
 *   - `contiene` (buscadores): el código viejo contiene el texto;
 *   - `exacto` (resolver una URL): es ese código, con o sin «DTD-».
 *
 * Lanza si una lectura falla: quien llama decide, como en `client-queries`.
 */
export async function clientesPorCodigoViejo(
  supabase: SupabaseClient,
  q: string | null | undefined,
  modo: "contiene" | "exacto" = "contiene",
): Promise<Map<string, string>> {
  const resultado = new Map<string, string>();
  const nucleo = nucleoDeCodigo(q);
  if (!nucleo) return resultado;
  const patron = `%${literal(nucleo)}%`;
  const coincide = (codigo: string) => modo === "contiene" || esElMismoCodigo(codigo, nucleo);

  // 1. Códigos retirados por renombrado.
  const historial = await supabase
    .from("client_markbox_history")
    .select("client_id, tenant_id, markbox")
    .ilike("markbox", patron)
    .limit(TOPE_CODIGOS_VIEJOS);
  if (historial.error) throw historial.error;

  // 2. Códigos de fichas absorbidas en una fusión.
  const absorbidas = await supabase
    .from("clients")
    .select("id, tenant_id, markbox, merged_into_client_id, deleted_at")
    .ilike("markbox", patron)
    .not("merged_into_client_id", "is", null)
    .limit(TOPE_CODIGOS_VIEJOS);
  if (absorbidas.error) throw absorbidas.error;

  /** Punto de partida de cada código: la ficha que lo tuvo. */
  const origenes: { clientId: string; tenantId: string | null; codigo: string }[] = [];
  for (const h of (historial.data ?? []) as {
    client_id: string | null;
    tenant_id: string | null;
    markbox: string | null;
  }[]) {
    if (h.client_id && h.markbox && coincide(h.markbox)) {
      origenes.push({ clientId: h.client_id, tenantId: h.tenant_id, codigo: h.markbox.trim() });
    }
  }
  const fichas = new Map<string, FilaCliente>();
  for (const c of (absorbidas.data ?? []) as FilaCliente[]) {
    fichas.set(c.id, c);
    if (c.markbox && coincide(c.markbox)) {
      origenes.push({ clientId: c.id, tenantId: c.tenant_id, codigo: c.markbox.trim() });
    }
  }
  if (origenes.length === 0) return resultado;

  // 3. Leer las fichas de partida y seguir la cadena de fusiones hasta la viva.
  let porLeer = [
    ...new Set([
      ...origenes.map((o) => o.clientId),
      ...[...fichas.values()].map((c) => c.merged_into_client_id ?? ""),
    ]),
  ].filter((id) => id !== "" && !fichas.has(id));
  for (let salto = 0; salto <= MAX_SALTOS_FUSION && porLeer.length > 0; salto++) {
    const { data, error } = await supabase
      .from("clients")
      .select("id, tenant_id, markbox, merged_into_client_id, deleted_at")
      .in("id", porLeer);
    if (error) throw error;
    for (const c of (data ?? []) as FilaCliente[]) fichas.set(c.id, c);
    porLeer = [
      ...new Set(
        [...fichas.values()]
          .map((c) => c.merged_into_client_id)
          .filter((id): id is string => !!id && !fichas.has(id)),
      ),
    ];
  }

  for (const o of origenes) {
    let ficha = fichas.get(o.clientId);
    // Un código del historial solo vale dentro de su propio tenant.
    if (!ficha || (o.tenantId && ficha.tenant_id && o.tenantId !== ficha.tenant_id)) continue;
    const vistos = new Set<string>([ficha.id]);
    while (ficha?.merged_into_client_id && vistos.size <= MAX_SALTOS_FUSION) {
      const siguiente = fichas.get(ficha.merged_into_client_id);
      if (!siguiente || vistos.has(siguiente.id)) {
        ficha = undefined;
        break;
      }
      vistos.add(siguiente.id);
      ficha = siguiente;
    }
    // Solo llega a un cliente vivo: ni eliminado ni a medio fusionar.
    if (!ficha || ficha.deleted_at || ficha.merged_into_client_id) continue;
    // El código vigente no es «viejo» para su propio dueño.
    if (ficha.markbox && ficha.markbox.trim().toLowerCase() === o.codigo.toLowerCase()) continue;
    if (!resultado.has(ficha.id)) resultado.set(ficha.id, o.codigo);
  }
  return resultado;
}

/**
 * Shipping Mark vigente del cliente al que lleva un código viejo, o `null`.
 * Para redirigir `/studio/clientes/<código viejo>` a la ficha vigente. Si el
 * código lleva a más de un cliente (no debería: el historial es único por
 * tenant), no adivina.
 */
export async function markboxVigenteDeCodigoViejo(
  supabase: SupabaseClient,
  codigo: string,
): Promise<string | null> {
  const mapa = await clientesPorCodigoViejo(supabase, codigo, "exacto");
  if (mapa.size !== 1) return null;
  const [id] = [...mapa.keys()];
  const { data, error } = await supabase
    .from("clients")
    .select("markbox")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<{ markbox: string | null }>();
  if (error) throw error;
  return data?.markbox ?? null;
}
