/**
 * Filtrado de "Documentos" del portal (SDD-0171 · Norte `PortalDocuments`).
 *
 * El Norte filtra por **chips de tipo con conteo** + **buscador con
 * normalización NFD** (para que "factura" encuentre "Factura" y "aduana"
 * encuentre "Aduaná"). Acá vive esa lógica, pura y testeable; el componente
 * cliente solo pinta.
 */

/** Fila ya aplanada por el servidor: sin tipos de `lib/studio` del lado cliente. */
export type PortalDocView = {
  id: string;
  /** Clave del tipo (`bl`, `packing`, …) — la que agrupan los chips. */
  docType: string;
  /** Etiqueta larga visible ("Bill of Lading"). */
  typeLabel: string;
  /** Etiqueta corta para el chip mono ("BL"). */
  typeShort: string;
  shipmentCode: string | null;
  /**
   * SDD-0308 · Código de la COMPRA cuando el documento cuelga de una compra y
   * no de un envío — hoy, el packing list del proveedor. Excluyente con
   * `shipmentCode`: un documento cuelga de una cosa o de la otra.
   */
  purchaseCode?: string | null;
  meta: string;
  url: string | null;
  /**
   * SDD-0308 · Qué pasa al tocar la tarjeta.
   *
   * `"descarga"` (default) — archivo en Storage, URL firmada, pestaña nueva.
   * `"abrir"` — el documento vive DENTRO del portal y `url` es una ruta
   * interna. No se descarga nada, así que la tarjeta no puede decir
   * "Descargar" ni sacar al cliente del portal.
   */
  kind?: "descarga" | "abrir";
};

/**
 * Normaliza para buscar: minúsculas y sin acentos (NFD + quita diacríticos).
 * Sin esto, "aduana" no encuentra "Aduaná" y el buscador parece roto.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    // Rango de diacríticos combinantes, escapado: con los caracteres literales
    // el patrón queda invisible en el código y cualquiera lo rompe sin verlo.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Chip de tipo con su conteo, en el orden en que aparecen los documentos. */
export type DocTypeChip = { key: string; label: string; count: number };

/**
 * Chips a mostrar: "Todos" primero y luego un chip por tipo PRESENTE (no se
 * ofrecen filtros que no filtran nada).
 */
export function buildTypeChips(docs: PortalDocView[]): DocTypeChip[] {
  const byType = new Map<string, DocTypeChip>();
  for (const d of docs) {
    const chip = byType.get(d.docType);
    if (chip) chip.count += 1;
    else byType.set(d.docType, { key: d.docType, label: d.typeLabel, count: 1 });
  }
  return [
    { key: "todos", label: "Todos", count: docs.length },
    ...byType.values(),
  ];
}

/**
 * Filtra por tipo y texto. La búsqueda mira etiqueta larga, etiqueta corta y el
 * código del que cuelga el documento — que es como el cliente los busca ("BL",
 * "Bill", "DTD-2026…", "PRE-…").
 *
 * El código de compra entra en la búsqueda igual que el de envío (SDD-0308): un
 * packing list que no se encuentra escribiendo el código de su compra es, para
 * el cliente, un documento que no está.
 */
export function filterDocs(
  docs: PortalDocView[],
  { type = "todos", query = "" }: { type?: string; query?: string } = {},
): PortalDocView[] {
  const q = normalize(query);
  return docs.filter((d) => {
    if (type !== "todos" && d.docType !== type) return false;
    if (!q) return true;
    return (
      normalize(d.typeLabel).includes(q) ||
      normalize(d.typeShort).includes(q) ||
      normalize(d.shipmentCode ?? "").includes(q) ||
      normalize(d.purchaseCode ?? "").includes(q)
    );
  });
}
