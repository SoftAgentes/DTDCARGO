/**
 * SDD-0308 · El packing list que llenó el proveedor, visto por el CLIENTE.
 *
 * ## El hueco que cierra
 *
 * Desde SDD-0096/0097 el proveedor llena su packing list online en `/p/{token}`
 * y queda en `packing_list_submissions` (migr 0147): marca, código, nombre en
 * chino y español, HS, cajas, unidades por caja, precio unitario, peso y CBM —
 * fila por fila, con totales recalculados en el servidor.
 *
 * Ese documento describe **la compra del cliente**, se llenó **para él**, y
 * hasta ahora **él era el único que no podía verlo**. Lo leía el equipo en
 * Studio › Proveedores y lo reenviaba por WhatsApp cuando alguien preguntaba.
 *
 * Peor: el portal ya le decía que existía. El hub de `/portal/envios` pinta un
 * chip **"Packing list ✓"** en verde por cada compra que lo tiene
 * (`PortalAlertasHub` · `DocsPanel`). El chip era un `<div>`, no un enlace: le
 * anunciaba un documento y lo dejaba sin manera de abrirlo.
 *
 * ## Por qué acá se usa el admin client (y por qué es seguro)
 *
 * `packing_list_submissions` tiene exactamente dos policies (migr 0147:94 y
 * 0147:101): **"by tenant"** (`tenant_id = get_user_tenant_id()`) y
 * **service_role**. Un cliente del portal **no tiene fila en `user_tenants`**,
 * así que con su sesión la RLS no le concede nada — y con RLS activa y ninguna
 * policy aplicable, Postgres **niega**. La consulta no vuelve "casi vacía":
 * vuelve vacía, siempre y en silencio.
 *
 * Se resuelve con el MISMO patrón que ya usan las recepciones de bodega en esta
 * misma pantalla (`purchase-reception-queries.ts`) y las consolidaciones en el
 * detalle de envío: **primero se prueba la propiedad con las credenciales del
 * propio cliente, y sólo después se lee con el admin client, acotado a lo que
 * quedó probado.** Se prefirió eso a una policy nueva porque no toca la RLS de
 * producción y deja el control de acceso en un solo lugar legible.
 *
 * 🔴 Igual que su vecina, **esta función NO verifica propiedad y no puede
 * hacerlo: recibe un id.** El llamador responde por él. Vive en su propio
 * módulo para que eso no se pierda de vista al leer la página. El contrato del
 * llamador es:
 *
 *   1. `getPrealertaByCode(userClient, code, { markbox })` — RLS del portal MÁS
 *      filtro explícito por `client_markbox`. Si devuelve null → 404 y acá no
 *      se llega.
 *   2. Recién entonces, `obtenerPackingListDeCompra(admin, prealerta.id, …)`.
 *
 * Como cinturón y tirantes, la función **vuelve a comparar el markbox** de la
 * submission contra el del cliente y descarta lo que no cuadre (ver
 * `markboxEsperado`). No sustituye al paso 1 — lo respalda.
 *
 * ## Qué se le muestra y qué no
 *
 * Se muestran las filas de mercancía completas, incluidos precio unitario y
 * monto: **es su compra, él la pagó.** Del contacto del proveedor se muestran
 * empresa y persona (identifican quién llenó el documento) y **no** el correo,
 * el WeChat ni el teléfono: el cliente registró a ese proveedor y ya tiene esos
 * canales, así que repetirlos sólo agregaría datos personales a una pantalla
 * que no los necesita (minimización).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { listPackingListSubmissions } from "@/lib/studio/prealertas/queries";
import type {
  PackingListRow,
  PackingListTotals,
} from "@/lib/studio/prealertas/packlist-form";

/**
 * El packing list de UNA compra, con lo que el cliente necesita ver.
 *
 * Es un subconjunto deliberado de `PackingListSubmission`: sin `tenant_id`, sin
 * los canales de contacto del proveedor y sin la maquinaria de versionado más
 * allá del número de versión, que sí importa porque el proveedor puede corregir
 * y reenviar.
 */
export type PackingListDeCompra = {
  id: string;
  /** Folio del documento (`DTD-PL-YYYY-NNNN`). `null` si la RPC no lo asignó. */
  folio: string | null;
  /** Versión vigente. >1 significa que el proveedor corrigió y reenvió. */
  version: number;
  /** Empresa del proveedor, tal como la escribió él. */
  empresa: string | null;
  /** Persona que llenó el documento. */
  contacto: string | null;
  /** Moneda de los importes (`USD` · `RMB` · `EUR`). */
  moneda: string;
  /** Fecha del documento que puso el proveedor (`YYYY-MM-DD`), no la de envío. */
  fechaDocumento: string | null;
  /** Nota libre del proveedor. */
  nota: string | null;
  /** Cuándo lo envió. */
  enviadoEl: string;
  /** Filas de mercancía, en el orden en que las cargó el proveedor. */
  filas: PackingListRow[];
  /** Totales recalculados por el servidor al recibirlo (no los del navegador). */
  totales: PackingListTotals;
};

/**
 * El packing list VIGENTE de una compra, o `null` si el proveedor todavía no
 * mandó ninguno.
 *
 * @param admin  Admin client. Desde SDD-0343 sólo lo construye el facade
 *               `server-only` después de resolver principal + compra.
 * @param prealertaId  Id de una compra ya verificada como del cliente.
 * @param markboxEsperado  Shipping Mark del cliente. Defensa en profundidad: si
 *               la submission trae otro, se descarta. No reemplaza la
 *               verificación del llamador.
 */
export async function obtenerPackingListDeCompra(
  admin: SupabaseClient,
  prealertaId: string,
  markboxEsperado: string,
): Promise<PackingListDeCompra | null> {
  // `currentOnly` (default) deja sólo `is_current`: si el proveedor corrigió y
  // reenvió, el cliente ve la versión buena, no la corregida.
  const submissions = await listPackingListSubmissions(admin, { prealertaId });
  const vigente = submissions[0];
  if (!vigente) return null;

  // Cinturón y tirantes. Un markbox que no cuadra no se muestra ni se explica:
  // sería un dato de otro cliente y no hay nada que el dueño de ESTA compra
  // pueda hacer con esa información.
  if (vigente.client_markbox && vigente.client_markbox !== markboxEsperado) {
    return null;
  }

  return {
    id: vigente.id,
    folio: vigente.folio,
    version: vigente.version_no,
    empresa: vigente.supplier_company,
    contacto: vigente.supplier_contact,
    moneda: vigente.currency,
    fechaDocumento: vigente.doc_date,
    nota: vigente.supplier_note,
    enviadoEl: vigente.created_at,
    filas: vigente.rows,
    totales: vigente.totals,
  };
}

/**
 * Cuáles de estas compras YA tienen packing list del proveedor.
 *
 * El hub de `/portal/envios` pinta un chip "Packing list ✓/✗" por compra. Hasta
 * SDD-0308 ese chip miraba **sólo `prealerta_documents`** — es decir, sólo si
 * alguien había adjuntado un archivo. Un proveedor que llenó el formulario
 * online (el camino que el propio portal le ofrece) dejaba el chip en gris: el
 * documento existía y el portal decía que no.
 *
 * Esta función cubre la otra mitad. Una sola consulta para TODAS las compras de
 * la pantalla, no una por compra: el llamador ya paga un N+1 por los adjuntos y
 * no hace falta agregar otro.
 *
 * 🔴 Mismo contrato que `obtenerPackingListDeCompra`: recibe ids y **no**
 * verifica propiedad. Por eso filtra además por `client_markbox`, que acá sí es
 * el control de acceso efectivo y no un respaldo.
 *
 * @param admin  Admin client — la RLS de la tabla no le da nada al cliente.
 * @param prealertaIds  Compras de la pantalla. Vacío → Set vacío, sin consulta.
 * @param markbox  Shipping Mark del cliente. Acota la consulta a lo suyo.
 */
export async function prealertasConPackingList(
  admin: SupabaseClient,
  prealertaIds: string[],
  markbox: string,
): Promise<Set<string>> {
  if (prealertaIds.length === 0 || !markbox) return new Set();

  try {
    const { data, error } = await admin
      .from("packing_list_submissions")
      .select("prealerta_id")
      .eq("client_markbox", markbox)
      .eq("is_current", true)
      .is("deleted_at", null)
      .in("prealerta_id", prealertaIds)
      // El tope de PostgREST es 1000 filas y acá hay como mucho una vigente por
      // compra, así que `prealertaIds.length` nunca lo alcanza en la práctica.
      // Se declara igual para que el límite sea explícito y no heredado.
      .limit(prealertaIds.length);
    if (error) throw error;
    return new Set(
      ((data as { prealerta_id: string }[] | null) ?? []).map(
        (r) => r.prealerta_id,
      ),
    );
  } catch {
    // Defensivo, igual que `listPackingListSubmissions`: un fallo acá degrada el
    // chip a "sin packing list", que es el estado que ya se mostraba antes.
    // Nunca tumba el hub entero.
    return new Set();
  }
}

/** Un packing list como entrada de la sección global "Documentos". */
export type PackingListComoDocumento = {
  id: string;
  /** Código de la COMPRA de la que cuelga (`PRE-…`), no de un envío. */
  purchaseCode: string;
  /** Folio del documento, si la RPC lo asignó. */
  folio: string | null;
  /** Cuándo lo envió el proveedor. */
  enviadoEl: string;
  /** Cajas declaradas — el dato que el cliente reconoce de un vistazo. */
  cajas: number;
};

/**
 * Los packing lists del cliente, para la sección global "Documentos".
 *
 * `/portal/documentos` prometía en su bajada «BL · Packing List · Facturas
 * comerciales · POD» y listaba sólo `shipment_documents`, que es lo que sube
 * **el equipo**. El packing list del proveedor no aparecía nunca: la pantalla
 * nombraba un documento que no tenía.
 *
 * Ojo con la diferencia, que cambia cómo se pinta la fila: los demás documentos
 * son **archivos** en Storage y se descargan por URL firmada. Un packing list
 * **no es un archivo** — son filas en una tabla. Su destino es una ruta interna
 * del portal (`/portal/compras/[code]`), así que la fila no dice "Descargar"
 * ni abre pestaña nueva.
 *
 * SDD-0342: la RPC deriva el cliente desde auth.uid(); este caller ya no recibe
 * ni reenvía Shipping Mark, client id o tenant id.
 */
export async function listarPackingListsComoDocumentos(
  db: SupabaseClient,
): Promise<PackingListComoDocumento[]> {
  try {
    const { data, error } = await db.rpc("get_portal_packing_list_documents");
    if (error) throw error;

    return ((data as Record<string, unknown>[] | null) ?? []).flatMap((r) => {
      const code = String(r.purchase_code ?? "").trim();
      // Sin código de compra la fila no tiene a dónde llevar: se omite en vez
      // de pintar una tarjeta que no abre nada.
      if (!code) return [];
      return [
        {
          id: String(r.id),
          purchaseCode: code,
          folio: (r.folio as string | null) ?? null,
          enviadoEl: String(r.submitted_at),
          cajas: Number(r.boxes) || 0,
        },
      ];
    });
  } catch {
    // Defensivo como el resto del módulo: un fallo acá deja la sección con los
    // documentos de envío de siempre, nunca tumba la pantalla entera.
    return [];
  }
}

/**
 * ¿Los totales del packing list cuadran con lo que el cliente anunció?
 *
 * Mismo criterio que `compararCajas` en las recepciones: el desajuste **se
 * muestra, no se esconde**. Si el cliente anunció 10 cajas y el proveedor
 * despachó 7, quiere enterarse en esta pantalla y no cuando llegue la factura.
 *
 * Devuelve `null` cuando no hay nada que comparar (el packing list no declara
 * cajas), y no inventa un `0`: diría algo distinto.
 */
export type CotejoDeCajas = {
  anunciadas: number;
  enPackingList: number;
  /** `packing - anunciadas`. Negativo = el proveedor despachó menos. */
  diferencia: number;
  estado: "cuadra" | "de-menos" | "de-mas";
};

export function cotejarConLoAnunciado(
  anunciadas: number,
  totalCtnsPackingList: number,
): CotejoDeCajas | null {
  // Sin cajas en el packing list no hay cotejo posible. `0` acá significa "el
  // proveedor no llenó ese dato", no "despachó cero cajas".
  if (!Number.isFinite(totalCtnsPackingList) || totalCtnsPackingList <= 0) {
    return null;
  }
  if (!Number.isFinite(anunciadas) || anunciadas <= 0) return null;

  const enPackingList = Math.round(totalCtnsPackingList);
  const diferencia = enPackingList - anunciadas;
  return {
    anunciadas,
    enPackingList,
    diferencia,
    estado: diferencia === 0 ? "cuadra" : diferencia < 0 ? "de-menos" : "de-mas",
  };
}
