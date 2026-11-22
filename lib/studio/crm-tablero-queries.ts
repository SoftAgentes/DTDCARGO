/**
 * Lecturas del tablero del CRM propio (SDD-0587 · paso 6.3).
 *
 * Todo pasa por la sesión del usuario: la RLS de la 0506 deja leer solo a
 * admin y commercial de su tenant. El único dato que se resuelve con la llave
 * de servicio es el nombre de los asesores, porque la RLS de `user_tenants` no
 * deja a un comercial ver a sus compañeros (igual que `listTenantAdvisors` en
 * la ficha del cliente).
 *
 * Minimización: no se lee `phone_last10` ni el BSUID; el tablero no los pinta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllByIds } from "@/lib/db/paginate";
import { esCanalUnion, logoDeCanalUnion } from "@/lib/studio/chatwoot/canal-union";
import { canalDeTarjeta, type CrmCanal } from "@/lib/studio/crm-canal";
import {
  CRM_TABLERO_CAP,
  diasDesde,
  esSegmento,
  ubicarTarjeta,
  type CrmEtapa,
  type CrmRastro,
  type CrmSegmento,
  type CrmTarjetaFila,
  type CrmTarjetaTablero,
} from "@/lib/studio/crm-tablero";

const COLS_TARJETA =
  "id, client_id, nombre_visible, etapa_leads, etapa_leads_at, etapa_clientes, etapa_clientes_at, asesor_id, fuente, utm_source, ultima_actividad_at";

/** Lote para la RPC de segmentos: el arreglo viaja en el cuerpo, no en la URL. */
const SEGMENTO_LOTE = 500;

export interface CrmFicha {
  id: string;
  name: string | null;
  markbox: string | null;
  deleted_at: string | null;
}

export type CrmTableroDatos =
  | {
      ok: true;
      etapas: CrmEtapa[];
      tarjetas: CrmTarjetaTablero[];
      /** Tarjetas escondidas porque su ficha está borrada (en suave o ya no se ve). */
      ocultas: number;
      /** ¿Se llegó al tope de tarjetas? */
      recortado: boolean;
    }
  | { ok: false; motivo: "sin_modelo" | "error" };

/**
 * ¿El error dice que la tabla o la función no existen? Es el caso de un
 * entorno donde la 0506 todavía no se aplicó: la pantalla lo dice en vez de
 * romperse.
 */
export function esModeloAusente(err: { code?: string | null } | null | undefined): boolean {
  const code = err?.code ?? "";
  return code === "42P01" || code === "42883" || code === "PGRST205" || code === "PGRST202";
}

/**
 * Separa las tarjetas que se pintan de las que no.
 *
 * Una tarjeta con ficha se esconde si la ficha está borrada en suave (0455) o si
 * no vuelve en la lectura (purgada o fuera de la vista de quien mira). Es el
 * pendiente que dejó 6.2: la tarjeta queda en la base y el segmento la da como
 * `lead_nuevo`, así que sin este filtro reaparecería en Leads como un lead sin
 * nombre.
 */
export function separarVisibles<T extends Pick<CrmTarjetaFila, "client_id">>(
  tarjetas: readonly T[],
  fichas: ReadonlyMap<string, CrmFicha>,
): { visibles: T[]; ocultas: number } {
  const visibles: T[] = [];
  let ocultas = 0;
  for (const t of tarjetas) {
    if (t.client_id == null) {
      visibles.push(t);
      continue;
    }
    const f = fichas.get(t.client_id);
    if (!f || f.deleted_at != null) ocultas += 1;
    else visibles.push(t);
  }
  return { visibles, ocultas };
}

/** Rastro por tarjeta a partir de las filas del historial. */
export function rastrosDesdeHistorial(
  filas: readonly { tarjeta_id: string; tablero: string; ocurrio_at: string }[],
): Map<string, CrmRastro> {
  const out = new Map<string, CrmRastro>();
  for (const h of filas) {
    const r = out.get(h.tarjeta_id) ?? { clientesAt: null, enLeads: false };
    if (h.tablero === "leads") r.enLeads = true;
    if (
      h.tablero === "clientes" &&
      (r.clientesAt == null || Date.parse(h.ocurrio_at) > Date.parse(r.clientesAt))
    ) {
      r.clientesAt = h.ocurrio_at;
    }
    out.set(h.tarjeta_id, r);
  }
  return out;
}

/** Los canales vinculados que NO son el de la fuente de la tarjeta, sin repetir. */
export function canalesExtraDe(
  propio: CrmCanal | null,
  vinculados: ReadonlySet<CrmCanal> | undefined,
): CrmCanal[] {
  if (!vinculados) return [];
  return [...vinculados].filter((c) => c !== propio).sort();
}

/**
 * SDD-0676 · Canales de los chats vinculados a cada ficha (`chatwoot_contact_links`),
 * para pintar su logo en la tarjeta del cliente. La RLS de la 0554 pide la Bandeja: quien
 * no la tiene recibe cero filas y ve solo el logo de la fuente. Es un adorno: sin la
 * migración (la columna no existe) o si la lectura falla, la tarjeta sale sin logos extra.
 */
export async function canalesVinculados(
  supabase: SupabaseClient,
  clientIds: readonly string[],
): Promise<Map<string, Set<CrmCanal>>> {
  const out = new Map<string, Set<CrmCanal>>();
  if (clientIds.length === 0) return out;
  try {
    const res = await fetchAllByIds<{ client_id: string; canal_chat: string | null }>(
      [...clientIds],
      (lote, from, to) =>
        supabase
          .from("chatwoot_contact_links")
          .select("client_id, canal_chat")
          .in("client_id", lote)
          .order("chatwoot_contact_id", { ascending: true })
          .range(from, to),
    );
    for (const f of res.rows) {
      const logo = logoDeCanalUnion(esCanalUnion(f.canal_chat) ? f.canal_chat : null);
      if (!logo) continue;
      const set = out.get(f.client_id) ?? new Set<CrmCanal>();
      set.add(logo);
      out.set(f.client_id, set);
    }
  } catch {
    return new Map();
  }
  return out;
}

export async function cargarTableroCrm(
  supabase: SupabaseClient,
  opts: { asesores: ReadonlyMap<string, string>; ahoraMs?: number },
): Promise<CrmTableroDatos> {
  const ahoraMs = opts.ahoraMs ?? Date.now();

  const etapasRes = await supabase
    .from("crm_etapas")
    .select("tablero, clave, nombre, orden, terminal, sistema, activa")
    .order("orden", { ascending: true });
  if (etapasRes.error) {
    return { ok: false, motivo: esModeloAusente(etapasRes.error) ? "sin_modelo" : "error" };
  }
  const etapas = (etapasRes.data ?? []) as CrmEtapa[];

  // Las anonimizadas (D6) quedan para los conteos, no para trabajar. Las absorbidas
  // (SDD-0676) tampoco se pintan: son la tarjeta de lead de un chat ya vinculado a un
  // cliente, y su historial se ve en la tarjeta de ese cliente.
  const leerTarjetas = (sinAbsorbidas: boolean) => {
    const base = supabase.from("crm_tarjetas").select(COLS_TARJETA).is("anonimizada_at", null);
    return (sinAbsorbidas ? base.is("absorbida_en", null) : base)
      .order("ultima_actividad_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(CRM_TABLERO_CAP);
  };
  let tarjetasRes = await leerTarjetas(true);
  // Sin la migración de la SDD-0676 la columna no existe (42703): no hay absorbidas que esconder.
  if (tarjetasRes.error?.code === "42703") tarjetasRes = await leerTarjetas(false);
  if (tarjetasRes.error) {
    return { ok: false, motivo: esModeloAusente(tarjetasRes.error) ? "sin_modelo" : "error" };
  }
  const filas = (tarjetasRes.data ?? []) as CrmTarjetaFila[];
  const recortado = filas.length >= CRM_TABLERO_CAP;

  try {
    const clientIds = [...new Set(filas.map((t) => t.client_id).filter((v): v is string => !!v))];
    const fichasRes = await fetchAllByIds<CrmFicha>(clientIds, (lote, from, to) =>
      supabase
        .from("clients")
        .select("id, name, markbox, deleted_at")
        .in("id", lote)
        .order("id", { ascending: true })
        .range(from, to),
    );
    // Si la lectura de fichas quedó a medias, una ficha que no volvió no
    // significa «borrada»: se prefiere el error a esconder tarjetas buenas.
    if (!fichasRes.complete) return { ok: false, motivo: "error" };
    const fichas = new Map(fichasRes.rows.map((f) => [f.id, f]));

    const { visibles, ocultas } = separarVisibles(filas, fichas);
    const ids = visibles.map((t) => t.id);
    const canalesDeFicha = await canalesVinculados(supabase, clientIds);

    const segmentos = new Map<string, CrmSegmento>();
    for (let i = 0; i < ids.length; i += SEGMENTO_LOTE) {
      const { data, error } = await supabase.rpc("crm_segmento_tarjetas", {
        p_tarjeta_ids: ids.slice(i, i + SEGMENTO_LOTE),
      });
      if (error) {
        return { ok: false, motivo: esModeloAusente(error) ? "sin_modelo" : "error" };
      }
      for (const r of (data ?? []) as { tarjeta_id: string; segmento: string }[]) {
        if (esSegmento(r.segmento)) segmentos.set(r.tarjeta_id, r.segmento);
      }
    }

    const historial = await fetchAllByIds<{ tarjeta_id: string; tablero: string; ocurrio_at: string }>(
      ids,
      (lote, from, to) =>
        supabase
          .from("crm_historial_etapas")
          .select("tarjeta_id, tablero, ocurrio_at")
          .in("tarjeta_id", lote)
          .order("id", { ascending: true })
          .range(from, to),
    );
    const rastros = rastrosDesdeHistorial(historial.rows);

    const tareas = await fetchAllByIds<{ tarjeta_id: string; vence_at: string | null }>(
      ids,
      (lote, from, to) =>
        supabase
          .from("crm_tareas")
          .select("tarjeta_id, vence_at")
          .in("tarjeta_id", lote)
          .is("completada_at", null)
          .order("id", { ascending: true })
          .range(from, to),
    );
    const abiertas = new Map<string, { total: number; vencidas: number }>();
    for (const k of tareas.rows) {
      const c = abiertas.get(k.tarjeta_id) ?? { total: 0, vencidas: 0 };
      c.total += 1;
      if (k.vence_at && Date.parse(k.vence_at) < ahoraMs) c.vencidas += 1;
      abiertas.set(k.tarjeta_id, c);
    }

    const tarjetas: CrmTarjetaTablero[] = visibles.map((t) => {
      // Sin segmento (no debería pasar: la RPC devuelve todas las del tenant)
      // la tarjeta va a Leads, que es el lado seguro: no la da por cliente.
      const segmento = segmentos.get(t.id) ?? "lead_nuevo";
      const u = ubicarTarjeta(t, segmento, rastros.get(t.id) ?? { clientesAt: null, enLeads: false });
      const ficha = t.client_id ? fichas.get(t.client_id) : undefined;
      const tk = abiertas.get(t.id);
      const extra = canalesExtraDe(
        canalDeTarjeta(t.fuente, t.utm_source),
        t.client_id ? canalesDeFicha.get(t.client_id) : undefined,
      );
      return {
        id: t.id,
        nombre: ficha?.name?.trim() || t.nombre_visible?.trim() || null,
        shippingMark: ficha?.markbox?.trim() || null,
        segmento,
        tablero: u.tablero,
        etapa: u.etapa,
        origen: u.origen,
        diasEnEtapa: diasDesde(u.desde, ahoraMs),
        asesorNombre: t.asesor_id ? (opts.asesores.get(t.asesor_id) ?? null) : null,
        tareasAbiertas: tk?.total ?? 0,
        tareasVencidas: tk?.vencidas ?? 0,
        fuente: t.fuente,
        utmSource: t.utm_source?.trim() || null,
        ...(extra.length > 0 ? { canalesExtra: extra } : {}),
      };
    });

    return { ok: true, etapas, tarjetas, ocultas, recortado };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, motivo: esModeloAusente({ code }) ? "sin_modelo" : "error" };
  }
}
