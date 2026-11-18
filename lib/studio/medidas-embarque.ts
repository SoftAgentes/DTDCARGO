/**
 * SDD-0673 · Corregir las medidas de un embarque y partirlo en dos: lo que
 * devuelven las RPC de la migr 0563 y cómo se dice en pantalla.
 *
 * Puro (sin I/O): lo usan las server actions, los modales y sus pruebas.
 */

export type Medidas = { boxes: number | null; cbm: number | null; weightKg: number | null };

export type CorregirOutcome = "preview" | "blocked" | "corrected";
export type PartirOutcome = "preview" | "blocked" | "split";

/** Bloqueos que pueden venir de cualquiera de las dos RPC. */
export type MedidasBloqueo =
  | "estado"
  | "factura_emitida"
  | "orden_despacho"
  | "varias_recepciones"
  | "recepciones"
  | "cajas_desalineadas"
  | "cajas_estibadas"
  | "caja_en_recepcion_ve"
  | "caja_escaneada_ve"
  | "caja_ajena"
  | "medidas_desalineadas"
  | "sin_contenedor"
  | "reclamo"
  | "prealerta";

export type MedidasAviso =
  | "borrador_factura"
  | "contenedor"
  | "cajas_nuevas_sin_etiqueta"
  | "recepcion_ve_sin_cajas_nuevas"
  | "tarifa_congelada"
  | "documentos_quedan"
  | "avisos_quedan";

export type Lugares = {
  shipment: { cbm: number | null; weightKg: number | null };
  consolidationItem: { cbm: number | null; weightKg: number | null; pieces: number | null } | null;
  receipt: { boxes: number | null; cbm: number | null; weightKg: number | null } | null;
};

export type CorregirResultado = {
  outcome: CorregirOutcome;
  shipmentCode: string;
  before: Lugares;
  after: Lugares;
  blockers: Record<string, string | number>;
  warnings: Record<string, string | number>;
};

export type Parte = { code: string | null; boxes: number; cbm: number; weightKg: number };

export type PartirResultado = {
  outcome: PartirOutcome;
  shipmentCode: string;
  newShipmentId: string | null;
  newShipmentCode: string | null;
  parts: { original: Parte; nueva: Parte & { clientMarkbox: string | null }; total: Medidas; boxCodes: string[] } | null;
  blockers: Record<string, string | number>;
  warnings: Record<string, string | number>;
};

const obj = (raw: unknown): Record<string, unknown> | null =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** Bloqueos y avisos: número o texto (el estado del embarque, el del contenedor). */
function motivos(raw: unknown): Record<string, string | number> {
  const r = obj(raw);
  if (!r) return {};
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") out[k] = v;
    else if (num(v) !== null && (num(v) as number) >= 0) out[k] = num(v) as number;
  }
  return out;
}

function lugares(raw: unknown): Lugares {
  const r = obj(raw) ?? {};
  const s = obj(r.shipment) ?? {};
  const ci = obj(r.consolidation_item);
  const rc = obj(r.warehouse_receipt_cn);
  return {
    shipment: { cbm: num(s.cbm), weightKg: num(s.weight_kg) },
    consolidationItem: ci ? { cbm: num(ci.cbm), weightKg: num(ci.weight_kg), pieces: num(ci.pieces) } : null,
    receipt: rc ? { boxes: num(rc.boxes), cbm: num(rc.cbm), weightKg: num(rc.weight_kg) } : null,
  };
}

export function parseCorregirResultado(raw: unknown): CorregirResultado | null {
  const r = obj(raw);
  if (!r) return null;
  if (!["preview", "blocked", "corrected"].includes(String(r.outcome))) return null;
  if (typeof r.shipment_code !== "string") return null;
  return {
    outcome: r.outcome as CorregirOutcome,
    shipmentCode: r.shipment_code,
    before: lugares(r.before),
    after: lugares(r.after),
    blockers: motivos(r.blockers),
    warnings: motivos(r.warnings),
  };
}

function parte(raw: unknown): Parte {
  const r = obj(raw) ?? {};
  return { code: str(r.code), boxes: num(r.boxes) ?? 0, cbm: num(r.cbm) ?? 0, weightKg: num(r.weight_kg) ?? 0 };
}

export function parsePartirResultado(raw: unknown): PartirResultado | null {
  const r = obj(raw);
  if (!r) return null;
  if (!["preview", "blocked", "split"].includes(String(r.outcome))) return null;
  if (typeof r.shipment_code !== "string") return null;
  const p = obj(r.parts);
  return {
    outcome: r.outcome as PartirOutcome,
    shipmentCode: r.shipment_code,
    newShipmentId: str(r.new_shipment_id),
    newShipmentCode: str(r.new_shipment_code),
    parts: p
      ? {
          original: parte(p.original),
          nueva: { ...parte(p.nueva), clientMarkbox: str(obj(p.nueva)?.client_markbox) },
          total: { boxes: num(obj(p.total)?.boxes), cbm: num(obj(p.total)?.cbm), weightKg: num(obj(p.total)?.weight_kg) },
          boxCodes: Array.isArray(p.box_codes) ? p.box_codes.filter((c): c is string => typeof c === "string") : [],
        }
      : null,
    blockers: motivos(r.blockers),
    warnings: motivos(r.warnings),
  };
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const ESTADO: Record<string, string> = { delivered: "entregado", cancelled: "cancelado" };

/** Por qué no se puede, en texto llano y con la salida. */
export function textoBloqueoMedidas(tipo: string, v: string | number): string {
  const n = typeof v === "number" ? v : 0;
  switch (tipo as MedidasBloqueo) {
    case "estado":
      return `El embarque está ${ESTADO[String(v)] ?? String(v)}: sus medidas ya no se cambian.`;
    case "factura_emitida":
      return `Tiene ${plural(n, "factura emitida", "facturas emitidas")}. Anúlala primero.`;
    case "orden_despacho":
      return `Su recepción está en ${plural(n, "una orden de despacho", "órdenes de despacho")} sin cancelar.`;
    case "varias_recepciones":
    case "recepciones":
      return n === 0
        ? "No tiene recepción del Almacén CN: no hay cajas que repartir."
        : `Tiene ${n} recepciones del Almacén CN vivas: no se sabe cuál corregir.`;
    case "cajas_desalineadas":
      return `Su recepción tiene ${plural(n, "caja física", "cajas físicas")} y otro conteo. Revísala en el Almacén CN.`;
    case "cajas_estibadas":
      return `${plural(n, "caja ya está estibada", "cajas ya están estibadas")}: no se pueden quitar.`;
    case "caja_en_recepcion_ve":
      return `${plural(n, "caja que se quitaría ya está", "cajas que se quitarían ya están")} en una recepción de Venezuela.`;
    case "caja_escaneada_ve":
      return `${plural(n, "caja que se movería ya se escaneó", "cajas que se moverían ya se escanearon")} en Venezuela.`;
    case "caja_ajena":
      return `${plural(n, "código de caja no es", "códigos de caja no son")} de este embarque.`;
    case "medidas_desalineadas":
      return "El embarque, el contenedor y la recepción no dicen lo mismo. Corrige primero las medidas.";
    case "sin_contenedor":
      return "No está en un contenedor: partir es para carga de contenedor.";
    case "reclamo":
      return `Tiene ${plural(n, "reclamo abierto", "reclamos abiertos")}.`;
    case "prealerta":
      return `Viene de ${plural(n, "una prealerta", "prealertas")} sin cancelar.`;
    default:
      return "Hay algo que lo impide. Recarga la página.";
  }
}

export function textosBloqueosMedidas(blockers: Record<string, string | number>): string[] {
  return Object.entries(blockers).map(([k, v]) => textoBloqueoMedidas(k, v));
}

/**
 * Lo que no impide, pero hay que saber. `accion` cambia el texto de la tarifa
 * congelada: al partir, la del original queda calculada con el CBM entero.
 */
export function textosAvisosMedidas(
  warnings: Record<string, string | number>,
  accion: "corregir" | "partir" = "corregir",
): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(warnings)) {
    const n = typeof v === "number" ? v : 0;
    switch (k as MedidasAviso) {
      case "borrador_factura":
        out.push(`Tiene ${plural(n, "factura en borrador", "facturas en borrador")}: contabilidad la ajusta antes de emitir.`);
        break;
      case "contenedor":
        out.push(`El contenedor ya ${v === "arribado" ? "arribó" : "zarpó"}: el cambio sale en los totales del contenedor.`);
        break;
      case "cajas_nuevas_sin_etiqueta":
        out.push(`Se crean ${plural(n, "caja nueva", "cajas nuevas")} sin etiqueta impresa.`);
        break;
      case "recepcion_ve_sin_cajas_nuevas":
        out.push("La recepción de Venezuela ya existe y no tendrá las cajas nuevas.");
        break;
      case "tarifa_congelada":
        out.push(
          accion === "partir"
            ? "La tarifa congelada del original queda calculada con el CBM entero y la parte nueva no la hereda. Contabilidad (administración o contabilidad) debe reemplazarla antes de facturar."
            : "La recepción tiene tarifa congelada con el CBM anterior: no cambia sola. Contabilidad (administración o contabilidad) debe reemplazarla antes de facturar.",
        );
        break;
      case "documentos_quedan":
        out.push(`${plural(n, "documento del Portal se queda", "documentos del Portal se quedan")} con el embarque original.`);
        break;
      case "avisos_quedan":
        out.push(`${plural(n, "aviso programado se queda", "avisos programados se quedan")} con el embarque original.`);
        break;
    }
  }
  return out;
}

/** Error de la RPC → texto llano. Nunca el mensaje crudo de la base. */
export function mensajeErrorMedidas(error: { code?: string | null; message?: string | null }): string {
  const msg = error.message ?? "";
  if (error.code === "PGRST202" || error.code === "42883") return "Esta acción todavía no está disponible.";
  if (error.code === "42501") return "No tienes permiso: solo operaciones o un administrador.";
  if (error.code === "P0002") {
    return msg.includes("cliente")
      ? "No encontramos ese cliente. Búscalo de nuevo."
      : "No encontramos este embarque. Recarga la página.";
  }
  if (error.code === "22023") {
    if (msg.includes("reason")) return "Indica un motivo de 4 a 1000 caracteres.";
    if (msg.includes("ya tiene esas medidas")) return "El embarque ya tiene esas medidas.";
    if (msg.includes("3 decimales")) return "El CBM va con hasta 3 decimales.";
    if (msg.includes("2 decimales")) return "El peso va con hasta 2 decimales.";
    if (msg.includes("menos de")) return "La parte nueva tiene que llevar menos cajas que el embarque.";
    if (msg.includes("más CBM o peso")) return "La parte nueva no puede llevar más CBM o peso que el embarque.";
    if (msg.includes("no tiene contenedor ni recepción")) return "Sin contenedor ni recepción no hay cajas que corregir.";
    if (msg.includes("fusionada")) return "Esa ficha fue fusionada con otra. Elige la que quedó.";
    if (msg.includes("Shipping Mark")) return "Ese cliente no tiene Shipping Mark.";
    if (msg.includes("cajas van")) return "Las cajas van de 1 en adelante.";
    if (msg.includes("al menos")) return "Indica al menos cajas, CBM o peso.";
    return "Revisa los datos: alguno no es válido.";
  }
  if (error.code === "40001") return "Algo cambió mientras guardabas. Intenta de nuevo.";
  return "No pudimos guardar. Intenta de nuevo.";
}

export function faltaLaFuncionMedidas(error: { code?: string | null } | null | undefined): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/** Número de formulario → número o null; acepta coma decimal. */
export function leerNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export const MAX_GRUPO = 120;

/** «Grupo de WeChat»: texto libre de 1 a 120, o vacío para quitarlo. */
export function validarGrupo(v: unknown): { ok: true; valor: string | null } | { ok: false; error: string } {
  const t = typeof v === "string" ? v.trim() : "";
  if (t === "") return { ok: true, valor: null };
  if (t.length > MAX_GRUPO) return { ok: false, error: `El grupo de WeChat va hasta ${MAX_GRUPO} caracteres.` };
  return { ok: true, valor: t };
}
