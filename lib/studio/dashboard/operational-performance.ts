/**
 * SDD-0281 · Los dos KPI de operación que llevaban "Próximamente":
 * **On-time delivery** y **Tránsito promedio**.
 *
 * Estaban declarados en `KPI_CATALOG` con `source: "wip"`, así que el tablero
 * les pintaba un guión. No faltaban datos: `shipments` guarda
 * `planned_delivery_at` y `delivered_at`, y `shipment_events` guarda cuándo
 * ocurrió DE VERDAD cada hito. Faltaba calcularlos.
 *
 * ## La cobertura es parte del número, no una nota al pie
 *
 * Un "100% on-time" medido sobre 2 de 47 envíos no es un buen resultado: es un
 * número inventado. Por eso cada KPI devuelve `medidos` y `universo`, y la
 * tarjeta imprime la fracción. Si se puede medir menos de la mitad del universo
 * el KPI se declara **no representativo** y el tablero muestra por qué en vez
 * de un porcentaje que nadie puede defender.
 *
 * Esto no es celo de ingeniería: el `planned_delivery_at` lo llena la operación
 * a mano, y hoy no está garantizado que lo llenen siempre. Un tablero que
 * promedia sólo los envíos bien cargados mide la disciplina de carga de datos y
 * la presenta como desempeño logístico.
 *
 * ## Por qué el tránsito NO usa las fechas planificadas
 *
 * `planned_departure_at` es una intención. El tránsito real se mide entre el
 * evento `shipped` (zarpó) y el `delivered` (entregado) de `shipment_events`,
 * que es lo que la operación registró que pasó. Usar la fecha planificada
 * daría el tránsito que queríamos tener, no el que tuvimos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPaged } from "@/lib/db/paginate";

/** Un envío entregado, con lo necesario para medir su desempeño. */
export type EnvioMedible = {
  id: string;
  /** Compromiso de entrega. `null` = no se cargó → no entra al on-time. */
  plannedDeliveryAt: string | null;
  /** Entrega real. */
  deliveredAt: string;
  /** Zarpe real (evento `shipped`). `null` = no hay evento → no entra al tránsito. */
  shippedAt: string | null;
};

/**
 * Bajo esta proporción de cobertura el KPI no se publica como número. La mitad
 * es un umbral de criterio, no una constante mágica de la industria: por debajo
 * de ahí la muestra dice más de quién carga fechas que de cómo entregamos.
 */
export const COBERTURA_MINIMA = 0.5;

export type MedicionOperativa = {
  /** El valor, o `null` si no es representativo (o no hay nada que medir). */
  valor: number | null;
  /** Cuántos envíos se pudieron medir. */
  medidos: number;
  /** Cuántos envíos entregados había en la ventana. */
  universo: number;
  /** `medidos / universo`, o 0 si el universo está vacío. */
  cobertura: number;
  /** Por qué no hay valor. `null` cuando sí lo hay. */
  motivo: "sin_datos" | "cobertura_insuficiente" | null;
};

function medicion(
  valor: number,
  medidos: number,
  universo: number,
): MedicionOperativa {
  const cobertura = universo === 0 ? 0 : medidos / universo;
  if (medidos === 0) {
    return { valor: null, medidos, universo, cobertura, motivo: "sin_datos" };
  }
  if (cobertura < COBERTURA_MINIMA) {
    return {
      valor: null,
      medidos,
      universo,
      cobertura,
      motivo: "cobertura_insuficiente",
    };
  }
  return { valor, medidos, universo, cobertura, motivo: null };
}

/** Milisegundos entre dos ISO, o `null` si alguna no parsea. */
function difMs(desdeISO: string, hastaISO: string): number | null {
  const a = Date.parse(desdeISO);
  const b = Date.parse(hastaISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return b - a;
}

/**
 * % de envíos entregados en o antes de la fecha comprometida. PURA.
 *
 * Sólo cuentan los que tienen compromiso cargado; el resto engorda el universo
 * pero no el numerador ni el denominador del porcentaje — así la cobertura
 * delata cuántos quedaron fuera.
 *
 * La comparación es por DÍA, no por instante: entregar a las 19:00 de la fecha
 * comprometida es a tiempo. Comparar timestamps marcaría como tarde media
 * operación por una diferencia de horas que nadie prometió.
 */
export function calcularOnTime(envios: readonly EnvioMedible[]): MedicionOperativa {
  let medidos = 0;
  let aTiempo = 0;
  for (const e of envios) {
    if (!e.plannedDeliveryAt) continue;
    const prometido = e.plannedDeliveryAt.slice(0, 10);
    const real = e.deliveredAt.slice(0, 10);
    if (prometido.length < 10 || real.length < 10) continue;
    medidos += 1;
    if (real <= prometido) aTiempo += 1;
  }
  const pct = medidos === 0 ? 0 : Math.round((aTiempo / medidos) * 100);
  return medicion(pct, medidos, envios.length);
}

/**
 * Días promedio entre el zarpe real y la entrega real. PURA.
 *
 * Se usa la **mediana**, no la media: un envío trabado tres meses en aduana
 * arrastra la media y hace que el tablero muestre un tránsito que no le pasa a
 * casi nadie. La mediana responde la pregunta que de verdad se hace el que mira
 * el tablero: "¿cuánto suele tardar?".
 *
 * Un tránsito negativo (entregado antes de zarpar) se descarta: es un error de
 * carga, y promediarlo contaminaría el número en vez de delatarse.
 */
export function calcularTransitoPromedio(
  envios: readonly EnvioMedible[],
): MedicionOperativa {
  const dias: number[] = [];
  for (const e of envios) {
    if (!e.shippedAt) continue;
    const ms = difMs(e.shippedAt, e.deliveredAt);
    if (ms == null || ms < 0) continue;
    dias.push(ms / 86_400_000);
  }
  if (dias.length === 0) return medicion(0, 0, envios.length);

  dias.sort((a, b) => a - b);
  const mitad = Math.floor(dias.length / 2);
  const mediana =
    dias.length % 2 === 0 ? (dias[mitad - 1] + dias[mitad]) / 2 : dias[mitad];

  return medicion(Math.round(mediana), dias.length, envios.length);
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Lectura                                                   ║
// ╚═══════════════════════════════════════════════════════════╝

/** Ventana por defecto. 90 días = un trimestre de operación. */
export const VENTANA_DIAS = 90;

/**
 * Los envíos entregados en la ventana, con su zarpe real resuelto.
 *
 * Dos consultas y no un join: `shipment_events` puede tener muchos eventos por
 * envío y PostgREST devolvería el producto. Se traen los `shipped` de esos
 * envíos y se queda el más TEMPRANO — si un envío se re-marcó como zarpado
 * (corrección, re-embarque), el tránsito se cuenta desde la primera salida.
 *
 * Ambas paginan: el tope de 1000 filas de PostgREST no se sortea con `.limit()`
 * y una operación con volumen dejaría fuera justo lo más viejo de la ventana,
 * sesgando el número hacia abajo sin avisar.
 */
export async function listarEnviosMedibles(
  supabase: SupabaseClient,
  opciones: { desdeISO?: string } = {},
): Promise<{ envios: EnvioMedible[]; completo: boolean }> {
  const desde =
    opciones.desdeISO ??
    new Date(Date.now() - VENTANA_DIAS * 86_400_000).toISOString();

  const { rows: entregados, complete: completoEnvios } = await fetchAllPaged<{
    id: string;
    planned_delivery_at: string | null;
    delivered_at: string;
  }>((from, to) =>
    supabase
      .from("shipments")
      .select("id, planned_delivery_at, delivered_at")
      .not("delivered_at", "is", null)
      .gte("delivered_at", desde)
      .is("deleted_at", null)
      .order("delivered_at", { ascending: false })
      .range(from, to),
  );

  if (entregados.length === 0) return { envios: [], completo: completoEnvios };

  const ids = entregados.map((r) => r.id);
  const { rows: eventos, complete: completoEventos } = await fetchAllPaged<{
    shipment_id: string;
    occurred_at: string;
  }>((from, to) =>
    supabase
      .from("shipment_events")
      .select("shipment_id, occurred_at")
      .in("shipment_id", ids)
      .eq("status", "shipped")
      .is("deleted_at", null)
      .order("occurred_at", { ascending: true })
      .range(from, to),
  );

  const zarpePorEnvio = new Map<string, string>();
  for (const ev of eventos) {
    // Vienen ordenados asc → el primero que se ve de cada envío es el temprano.
    if (!zarpePorEnvio.has(ev.shipment_id)) {
      zarpePorEnvio.set(ev.shipment_id, ev.occurred_at);
    }
  }

  return {
    envios: entregados.map((r) => ({
      id: r.id,
      plannedDeliveryAt: r.planned_delivery_at,
      deliveredAt: r.delivered_at,
      shippedAt: zarpePorEnvio.get(r.id) ?? null,
    })),
    completo: completoEnvios && completoEventos,
  };
}

export type DesempenoOperativo = {
  onTime: MedicionOperativa;
  transito: MedicionOperativa;
  /** `false` si alguna consulta topó el máximo de páginas → los KPI son parciales. */
  completo: boolean;
  ventanaDias: number;
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Presentación                                              ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * La medición como tarjeta del tablero.
 *
 * El `sub` lleva SIEMPRE la fracción medida. No es un detalle de UI: sin ella,
 * un "100%" sobre 2 de 47 envíos y un "100%" sobre 45 de 47 se ven idénticos, y
 * el primero es un número inventado. Cuando la cobertura no alcanza, la tarjeta
 * dice el porqué en vez de mostrar un valor que nadie puede defender.
 *
 * PURA — es la única que decide qué se lee en pantalla, así que se prueba.
 */
export function kpiDesempeno(
  m: MedicionOperativa,
  unidad: string,
  etiqueta: string,
): { value: string; sub: string; tone: "success" | "warning" | "neutral" | "info" } {
  if (m.motivo === "sin_datos") {
    return { value: "—", sub: "sin entregas medibles aún", tone: "neutral" };
  }
  if (m.motivo === "cobertura_insuficiente") {
    return {
      value: "—",
      sub: `sólo ${m.medidos} de ${m.universo} con datos — muestra insuficiente`,
      tone: "warning",
    };
  }
  return {
    value: `${m.valor}${unidad}`,
    sub: `${etiqueta} · ${m.medidos} de ${m.universo} envíos`,
    tone: "info",
  };
}

/** Los dos KPI de una sola pasada (comparten la misma lectura). */
export async function getDesempenoOperativo(
  supabase: SupabaseClient,
): Promise<DesempenoOperativo> {
  const { envios, completo } = await listarEnviosMedibles(supabase);
  return {
    onTime: calcularOnTime(envios),
    transito: calcularTransitoPromedio(envios),
    completo,
    ventanaDias: VENTANA_DIAS,
  };
}
