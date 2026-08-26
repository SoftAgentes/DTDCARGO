/**
 * SDD-0305 · Lo que pasó en la bodega de Yiwu con UNA compra del cliente.
 *
 * El portal dejaba anunciar la compra y volver a imprimir sus etiquetas, pero no
 * **abrirla**: no había `/portal/compras/[code]`. El cliente registraba el aviso
 * y desde ahí quedaba a ciegas hasta que la mercancía aparecía en un envío. Todo
 * "¿ya llegó a la bodega?" y "¿cuántas cajas les llegaron?" salía del ERP por
 * WhatsApp, a mano.
 *
 * ## Por qué acá se usa el admin client (y por qué es seguro)
 *
 * `warehouse_receipts_cn` sólo tiene la policy "by tenant"
 * (`tenant_id = get_user_tenant_id()`). Un cliente del portal **no está en
 * `user_tenants`**, así que esa policy no le da nada: con el cliente autenticado
 * la consulta vuelve vacía siempre — no "casi vacía", vacía.
 *
 * La salida es la MISMA que ya usa el detalle del envío para consolidaciones y
 * navieras (`lib/portal/consolidation-queries.ts`): **primero se prueba la
 * propiedad con las credenciales del propio cliente, y sólo después se lee con
 * el admin client, acotado a lo que quedó probado.**
 *
 * En concreto y en este orden:
 *   1. `getPrealertaByCode(userClient, code, { markbox })` — RLS del portal MÁS
 *      filtro explícito por `client_markbox`. Si devuelve null, la página corta
 *      con 404 y acá no se llega.
 *   2. Recién entonces se leen las recepciones **filtradas por ese
 *      `prealerta_id`**, que es un id ya verificado como suyo.
 *
 * 🔴 Esta función NO verifica propiedad y no puede hacerlo: recibe un id. El
 * llamador es quien responde por él. Está aislada en su propio módulo para que
 * eso no se pierda de vista al leer la página.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SDD-0285 · TTL de las URLs firmadas de las fotos. 1 h, la misma que usan
 * Inspecciones y el expediente legal — no se inventa una constante nueva para
 * el mismo bucket.
 *
 * El portal renderiza en el servidor en cada visita, así que la URL nace fresca
 * con la página. Una hora cubre de sobra la lectura y deja el enlace muerto para
 * quien lo reenvíe después.
 */
export const FOTO_URL_TTL = 3600;

/** Bucket privado de las fotos de recepción (migr 0022). */
const BUCKET_FOTOS = "receipt-photos";

/** Una foto de la recepción, ya firmada y lista para el `<img>`. */
export type FotoDeRecepcion = {
  /** URL firmada, temporal. */
  url: string;
  /** Orden en que la subió el operario. */
  position: number;
};

/** Una recepción en bodega CN, con lo que el CLIENTE necesita ver. */
export type RecepcionDeCompra = {
  id: string;
  receiptCode: string;
  /** `YYYY-MM-DD` — el día que la bodega la recibió. */
  receivedAt: string;
  boxes: number;
  /** CBM medido en bodega. `null` mientras no lo hayan medido. */
  cbm: number | null;
  /** Peso medido en bodega. `null` mientras no lo hayan pesado. */
  weightKg: number | null;
  status: "pendiente_consolidacion" | "consolidado" | "incidencia";
  /** Proveedor tal como lo anotó la bodega (puede diferir del que declaró el cliente). */
  supplierName: string | null;
  /** `true` si ya viaja en un embarque. */
  enEmbarque: boolean;
  /** SDD-0285 · fotos que tomó el operario al recibir. Vacío si no hay o si no
   *  se pudieron firmar (nunca rompe la pantalla). */
  fotos: FotoDeRecepcion[];
};

/** Total de lo recibido — lo que el cliente compara contra lo que anunció. */
export type ResumenRecepcion = {
  recepciones: RecepcionDeCompra[];
  cajasRecibidas: number;
  cbmTotal: number | null;
  pesoTotal: number | null;
  /** La fecha de la primera recepción, o `null` si no llegó nada todavía. */
  primeraRecepcion: string | null;
};

type FilaRecepcion = {
  id: string;
  receipt_code: string;
  received_at: string;
  boxes: number | null;
  total_cbm: number | string | null;
  total_weight_kg: number | string | null;
  status: string;
  supplier_name: string | null;
  shipment_id: string | null;
};

function numeroONulo(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Las recepciones de UNA compra ya verificada como del cliente.
 *
 * @param admin  Cliente service-role. Ver el encabezado del módulo.
 * @param prealertaId  Id **ya probado** como del cliente logueado.
 */
export async function listarRecepcionesDeCompra(
  admin: SupabaseClient,
  prealertaId: string,
): Promise<ResumenRecepcion> {
  const { data, error } = await admin
    .from("warehouse_receipts_cn")
    .select(
      "id, receipt_code, received_at, boxes, total_cbm, total_weight_kg, status, supplier_name, shipment_id",
    )
    .eq("prealerta_id", prealertaId)
    .is("deleted_at", null)
    .order("received_at", { ascending: true });

  // Un fallo de lectura NO puede tumbar la página: la compra existe y el
  // cliente tiene derecho a verla aunque la bodega no responda. Se devuelve el
  // resumen vacío y la pantalla dice "todavía no registramos su llegada", que
  // es exactamente lo que el cliente vería si aún no hubiera llegado nada.
  if (error || !data) return resumenVacio();

  const recepciones: RecepcionDeCompra[] = (data as FilaRecepcion[]).map((r) => ({
    id: r.id,
    receiptCode: r.receipt_code,
    receivedAt: r.received_at,
    boxes: Number(r.boxes ?? 0),
    cbm: numeroONulo(r.total_cbm),
    weightKg: numeroONulo(r.total_weight_kg),
    status: (["pendiente_consolidacion", "consolidado", "incidencia"].includes(r.status)
      ? r.status
      : "pendiente_consolidacion") as RecepcionDeCompra["status"],
    supplierName: r.supplier_name,
    enEmbarque: r.shipment_id != null,
    fotos: [],
  }));

  await adjuntarFotos(admin, recepciones);

  return {
    recepciones,
    cajasRecibidas: recepciones.reduce((a, r) => a + r.boxes, 0),
    // Si NINGUNA recepción tiene la medida, el total es `null` (desconocido), no
    // 0 — mostrar "0.000 m³" le diría al cliente que su carga no ocupa nada.
    cbmTotal: sumaOculta(recepciones.map((r) => r.cbm)),
    pesoTotal: sumaOculta(recepciones.map((r) => r.weightKg)),
    primeraRecepcion: recepciones[0]?.receivedAt ?? null,
  };
}

/** Lo que devuelve `createSignedUrls`, en lo que nos importa. */
export type FirmaDeStorage = {
  path?: string | null;
  signedUrl?: string | null;
};

/**
 * SDD-0285 · Cruza las filas de fotos con sus URLs firmadas y las agrupa por
 * recepción. PURA.
 *
 * 🔴 Se indexa **por path, no por posición**. `createSignedUrls` responde en el
 * mismo orden en que se pidió, pero puede devolver una entrada sin `signedUrl`
 * cuando el objeto ya no está en el bucket. Confiar en el índice haría que, al
 * fallar una, todas las siguientes quedaran corridas — y el cliente vería la
 * foto de otra caja bajo la etiqueta equivocada. Peor que no mostrar nada.
 *
 * Una foto sin firma simplemente no aparece.
 */
export function agruparFotosPorRecepcion(
  filas: readonly { receipt_id: string; storage_path: string; position: number | null }[],
  firmadas: readonly FirmaDeStorage[],
): Map<string, FotoDeRecepcion[]> {
  const urlPorPath = new Map<string, string>();
  for (const f of firmadas) {
    if (f?.path && f.signedUrl) urlPorPath.set(f.path, f.signedUrl);
  }

  const porRecepcion = new Map<string, FotoDeRecepcion[]>();
  for (const f of filas) {
    const url = urlPorPath.get(f.storage_path);
    if (!url) continue;
    const lista = porRecepcion.get(f.receipt_id) ?? [];
    lista.push({ url, position: f.position ?? 0 });
    porRecepcion.set(f.receipt_id, lista);
  }
  return porRecepcion;
}

/**
 * SDD-0285 · Cuelga las fotos firmadas de cada recepción. MUTA `recepciones`.
 *
 * Una consulta para todas las fotos y **una sola** llamada a `createSignedUrls`
 * con todos los paths: firmar de a una haría N+1 round-trips contra Storage por
 * una pantalla que el cliente abre para mirar tres fotos.
 *
 * 🔴 Best-effort de punta a punta. Las fotos son un extra: la recepción, sus
 * cajas y sus medidas son el dato que el cliente vino a buscar. Si Storage no
 * responde o una firma falla, la pantalla sale igual sin ellas — nunca al revés.
 *
 * El `admin` client es obligatorio y por la misma razón que el resto del módulo:
 * `warehouse_receipt_photos` tiene RLS por tenant y el bucket también, así que
 * con la sesión del cliente del portal no se ve ni la fila ni el objeto. La
 * propiedad ya la probó el llamador — ver el encabezado del módulo.
 */
async function adjuntarFotos(
  admin: SupabaseClient,
  recepciones: RecepcionDeCompra[],
): Promise<void> {
  if (recepciones.length === 0) return;
  try {
    const ids = recepciones.map((r) => r.id);
    const { data, error } = await admin
      .from("warehouse_receipt_photos")
      .select("receipt_id, storage_path, position")
      .in("receipt_id", ids)
      .order("position", { ascending: true });
    if (error || !data || data.length === 0) return;

    const filas = data as {
      receipt_id: string;
      storage_path: string;
      position: number | null;
    }[];

    const { data: firmadas } = await admin.storage
      .from(BUCKET_FOTOS)
      .createSignedUrls(
        filas.map((f) => f.storage_path),
        FOTO_URL_TTL,
      );
    if (!firmadas) return;

    const porRecepcion = agruparFotosPorRecepcion(filas, firmadas);
    for (const r of recepciones) {
      r.fotos = porRecepcion.get(r.id) ?? [];
    }
  } catch {
    // Ver el docblock: las fotos nunca tumban la pantalla.
  }
}

function resumenVacio(): ResumenRecepcion {
  return {
    recepciones: [],
    cajasRecibidas: 0,
    cbmTotal: null,
    pesoTotal: null,
    primeraRecepcion: null,
  };
}

/**
 * Suma que distingue "cero" de "todavía no se midió". Devuelve `null` sólo si
 * NINGÚN valor está cargado; si al menos uno lo está, suma los que hay — un
 * total parcial es información, un `null` no. PURA.
 */
export function sumaOculta(valores: readonly (number | null)[]): number | null {
  const cargados = valores.filter((v): v is number => v != null);
  if (cargados.length === 0) return null;
  return Math.round(cargados.reduce((a, b) => a + b, 0) * 1000) / 1000;
}

/**
 * SDD-0284 · Qué nombre de proveedor se le muestra al cliente en una recepción.
 *
 * Hay dos fuentes y no dicen lo mismo:
 *
 *   · El **registrado** por el propio cliente en `suppliers_cn` (vía la compra).
 *     Es el nombre con el que él conoce a su proveedor.
 *   · El **escrito en la bodega** de Yiwu (`warehouse_receipts_cn.supplier_name`),
 *     texto libre que a veces viene en chino, a veces abreviado, a veces con la
 *     razón social de la fábrica en vez del nombre comercial.
 *
 * Manda el registrado: es el que el cliente reconoce. El de bodega sólo se
 * muestra **cuando aporta algo** — es decir, cuando difiere de verdad. Repetir
 * el mismo nombre dos veces con etiquetas distintas no informa, ensucia.
 *
 * La comparación normaliza mayúsculas y espacios, pero **no intenta ser lista**:
 * no compara sin acentos ni por parecido. Un falso "son iguales" escondería que
 * la bodega recibió de otro proveedor, que es justo lo que vale la pena ver.
 *
 * PURA.
 */
export function nombreDeProveedor(
  registrado: string | null,
  enBodega: string | null,
): { principal: string | null; segundo: string | null } {
  const reg = (registrado ?? "").trim();
  const bod = (enBodega ?? "").trim();

  if (!reg) return { principal: bod || null, segundo: null };
  if (!bod) return { principal: reg, segundo: null };

  const iguales = reg.toLowerCase().replace(/\s+/g, " ") === bod.toLowerCase().replace(/\s+/g, " ");
  return { principal: reg, segundo: iguales ? null : bod };
}

/**
 * ¿Lo que llegó coincide con lo que el cliente anunció? PURA.
 *
 * El desajuste no es un error del sistema: es la información más útil de toda
 * la pantalla. Si el cliente anunció 10 cajas y llegaron 7, quiere enterarse por
 * el portal y no cuando le facture. Por eso se calcula y se muestra, en vez de
 * enseñar sólo el número recibido.
 */
export function compararCajas(
  anunciadas: number,
  recibidas: number,
): { estado: "sin_llegar" | "parcial" | "completo" | "excedente"; diferencia: number } {
  const diferencia = recibidas - anunciadas;
  if (recibidas === 0) return { estado: "sin_llegar", diferencia };
  if (diferencia < 0) return { estado: "parcial", diferencia };
  if (diferencia > 0) return { estado: "excedente", diferencia };
  return { estado: "completo", diferencia: 0 };
}
