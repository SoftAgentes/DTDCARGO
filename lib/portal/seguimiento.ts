/**
 * "Seguimiento total" agrupado por CONTENEDOR (SDD-0170 · Norte `PortalAlertas`
 * vista `track`).
 *
 * Decisión del Norte que faltaba: *"Cuando varias compras viajan consolidadas, se
 * muestran como un solo seguimiento (agrupado por contenedor)."* Hasta acá el
 * portal pintaba una lista plana de envíos — el cliente con 4 compras en el mismo
 * contenedor veía 4 barras avanzando igual, sin saber que eran la misma caja.
 *
 * Todo puro: recibe los `TrackItem` que ya arma la página y el mapa de
 * consolidación resuelto por `consolidation-queries`. Sin DB, sin React.
 */

import type { ShipmentConsolidation } from "@/lib/portal/consolidation-queries";

/** Un envío en camino, tal como lo pinta el hub. */
export type TrackItem = {
  id: string;
  code: string;
  /** 0–100, derivado del status (computeProgress). */
  progress: number;
  statusLabel: string;
  route: string | null;
};

export type TrackGroup = {
  /** Clave estable para React: la consolidación, o el envío si viaja solo. */
  key: string;
  /** `consolidado` = 2+ compras en el mismo contenedor. */
  kind: "consolidado" | "solo";
  /** Rótulo principal: nº de contenedor › ref de consolidación › código del envío. */
  label: string;
  /** true si `label` es un nº de contenedor real (se muestra en mono). */
  labelIsContainer: boolean;
  /** Ruta marítima POL → POD, si la consolidación ya tiene zarpe. */
  route: string | null;
  eta: string | null;
  /** Avance del grupo: el MENOR de sus envíos (ver nota abajo). */
  progress: number;
  items: TrackItem[];
};

/**
 * Agrupa los envíos en camino por el contenedor en que viajan.
 *
 * Los envíos sin consolidación (todavía no asignados a un contenedor) salen como
 * grupos de uno — así la vista es uniforme y nunca se pierde un envío por falta
 * de dato.
 *
 * **Progreso del grupo = el mínimo de sus envíos.** Van todos en la misma caja,
 * así que en teoría comparten estado; cuando difieren es lag de carga de datos, y
 * en ese caso conviene quedarse corto antes que prometer un avance que la carga
 * más atrasada no tiene.
 *
 * Orden: por progreso descendente (lo que está por llegar primero, arriba) y
 * desempate por `label` para que la salida sea determinística.
 */
export function groupTrackByContainer(
  track: TrackItem[],
  consolidationByShipment: Record<string, ShipmentConsolidation>,
): TrackGroup[] {
  const byConsolidation = new Map<string, TrackItem[]>();
  const solos: TrackItem[] = [];

  for (const t of track) {
    const c = consolidationByShipment[t.id];
    if (!c) {
      solos.push(t);
      continue;
    }
    const list = byConsolidation.get(c.consolidationId);
    if (list) list.push(t);
    else byConsolidation.set(c.consolidationId, [t]);
  }

  const groups: TrackGroup[] = [];

  for (const [consolidationId, items] of byConsolidation) {
    // Todos los items del grupo comparten consolidación → cualquiera sirve.
    const c = consolidationByShipment[items[0].id];
    const containerNo = c.containerNo;
    const label = containerNo ?? c.ref ?? items[0].code;
    groups.push({
      key: consolidationId,
      // Una sola compra en un contenedor no es "consolidado" de cara al cliente:
      // no hay nada que agrupar, aunque exista la fila de consolidación.
      kind: items.length > 1 ? "consolidado" : "solo",
      label,
      labelIsContainer: !!containerNo,
      route: buildRoute(c.pol, c.pod) ?? items[0].route,
      eta: c.eta,
      progress: minProgress(items),
      items: [...items].sort((a, b) => a.code.localeCompare(b.code)),
    });
  }

  for (const t of solos) {
    groups.push({
      key: `solo:${t.id}`,
      kind: "solo",
      label: t.code,
      labelIsContainer: false,
      route: t.route,
      eta: null,
      progress: t.progress,
      items: [t],
    });
  }

  return groups.sort(
    (a, b) => b.progress - a.progress || a.label.localeCompare(b.label),
  );
}

function minProgress(items: TrackItem[]): number {
  return items.reduce((min, t) => (t.progress < min ? t.progress : min), 100);
}

/** `POL → POD`; null si falta alguno (no inventamos media ruta). */
function buildRoute(pol: string | null, pod: string | null): string | null {
  if (!pol || !pod) return null;
  return `${pol} → ${pod}`;
}

/** Copy del conteo: "3 compras en este contenedor". */
export function groupCountLabel(group: TrackGroup): string | null {
  if (group.kind !== "consolidado") return null;
  return `${group.items.length} compras en este contenedor`;
}
