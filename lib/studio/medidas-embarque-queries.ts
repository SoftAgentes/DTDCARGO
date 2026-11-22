/**
 * SDD-0673 · Lo que la ficha del embarque necesita para «Corregir medidas»,
 * «Partir embarque» y el «Grupo de WeChat».
 *
 * La línea vigente del contenedor es la más reciente en un contenedor vivo, la
 * misma que cuenta Embarques (SDD-0643/0661). El grupo se lee aparte y con
 * tolerancia: sin la migr 0563 la columna no existe y la ficha no lo muestra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type CargaDelEmbarque = {
  /** Tiene línea vigente en un contenedor vivo. */
  enContenedor: boolean;
  /** No se pudo leer: quien guarda trata el embarque como si estuviera en un contenedor. */
  lecturaFallida?: boolean;
  contenedor: { ref: string | null; containerNo: string | null; status: string | null } | null;
  cajas: number | null;
  cbm: number | null;
  pesoKg: number | null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function leerCargaDelEmbarque(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<CargaDelEmbarque> {
  const vacio: CargaDelEmbarque = { enContenedor: false, contenedor: null, cajas: null, cbm: null, pesoKg: null };
  const { data: items, error } = await supabase
    .from("consolidation_items")
    .select("consolidation_id, pieces, cbm, weight_kg, created_at")
    .eq("shipment_id", shipmentId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return { ...vacio, lecturaFallida: true };
  if (!items || items.length === 0) return vacio;

  const ids = [...new Set(items.map((i) => String(i.consolidation_id)))];
  const { data: cons, error: consError } = await supabase
    .from("consolidations")
    .select("id, ref, container_no, status")
    .in("id", ids)
    .is("deleted_at", null);
  if (consError) return { ...vacio, lecturaFallida: true };
  const vivos = new Map((cons ?? []).map((c) => [String(c.id), c]));
  const vigente = items.find((i) => vivos.has(String(i.consolidation_id)));
  if (!vigente) return vacio;
  const c = vivos.get(String(vigente.consolidation_id))!;
  return {
    enContenedor: true,
    contenedor: {
      ref: typeof c.ref === "string" ? c.ref : null,
      containerNo: typeof c.container_no === "string" ? c.container_no : null,
      status: typeof c.status === "string" ? c.status : null,
    },
    cajas: num(vigente.pieces),
    cbm: num(vigente.cbm),
    pesoKg: num(vigente.weight_kg),
  };
}

/** `undefined` = la columna no existe todavía (sin la 0563): la ficha no muestra el campo. */
export async function leerGrupoDelEmbarque(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<string | null | undefined> {
  const { data, error } = await supabase
    .from("shipments")
    .select("group_reference")
    .eq("id", shipmentId)
    .maybeSingle<{ group_reference: string | null }>();
  if (error) return undefined;
  return data?.group_reference ?? null;
}

/**
 * ¿El embarque tiene línea vigente en un contenedor vivo? Lo usa el servidor al
 * guardar. Falla cerrado: si no se puede leer, responde que sí y la ficha no
 * escribe peso ni CBM por el camino sin motivo.
 */
export async function estaEnContenedor(supabase: SupabaseClient, shipmentId: string): Promise<boolean> {
  const carga = await leerCargaDelEmbarque(supabase, shipmentId);
  return carga.enContenedor || carga.lecturaFallida === true;
}
