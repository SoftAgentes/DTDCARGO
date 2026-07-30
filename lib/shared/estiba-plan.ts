/**
 * SDD-0184 · Plan de carga por VOLUMEN — reparte lotes en las zonas del contenedor.
 *
 * Vive en `lib/shared/` = el ÚNICO puente público↔ERP permitido por ESLint. Es
 * código PURO (sin React, sin Supabase, sin imports del ERP ni del sitio): lo usan
 * el Studio (Naviera), la PWA del operario (`/m/cn/estibar`) y la calculadora
 * pública de llenado.
 *
 * ── Por qué NO hay bin-packing 3D ──────────────────────────────────────────
 * El mercado (EasyCargo, SeaRates, CubeMaster…) pide largo×ancho×alto por bulto,
 * tipo de carga (caja/saco/barril/rollo) y restricciones de apilado. **El proveedor
 * chino no da nada de eso.** Lo único real que existe es lo que ya viaja en el
 * packing list y en `warehouse_boxes`: **cantidad de cajas + CBM**. Decisión del
 * founder (2026-07-30): todo es caja, y el plan es una GUÍA aproximada para el
 * operario, no una promesa milimétrica.
 *
 * Por eso esto es aritmética, no geometría: el contenedor ya está modelado como
 * rejilla de zonas (`container_types.zone_layout`, migración 0241); acá cada zona
 * recibe una capacidad en CBM y los lotes se reparten en orden de carga.
 *
 * ── Capacidad: tres números que NO son lo mismo ────────────────────────────
 * Para un 40' HC conviven tres cifras y confundirlas infla la ocupación:
 *   · 76,2 m³ → volumen GEOMÉTRICO interno (12.024 × 2.350 × 2.697 mm). Es lo que
 *     usa SeaRates como denominador, y por eso su "% de volumen" sale optimista.
 *   · 68 m³   → capacidad ÚTIL de planificación. Es la que se usa acá, y la misma
 *     que el founder usa a mano en `build_consolidado.py` ("% llenado (de 68)").
 *   · 66,4 m³ → techo REAL medido en un contenedor propio → `cbmAlertCeiling`.
 * `cbmCapacity` siempre es la ÚTIL. El geométrico no entra en este módulo.
 *
 * Nota de deuda (Fase 3): `ZoneLayout`/`ZoneCoord` y las etiquetas de zona están
 * duplicadas a propósito con `lib/studio/naviera/zones.ts`. Son estructuralmente
 * idénticas. Al cablear el visor, `zones.ts` pasa a importarlas de acá (studio →
 * shared es dirección permitida); al revés rompería la frontera pública.
 */

// ╔═══════════════════════════════════════════════════════════╗
// ║ Modelo                                                    ║
// ╚═══════════════════════════════════════════════════════════╝

/** Rejilla del contenedor: tramos a lo largo × niveles de alto × tramos a lo ancho. */
export type ZoneLayout = { nx: number; ny: number; nz: number };

/** Coordenada de zona. `zx` 0 = fondo · `zy` 0 = piso · `zz` 0 = izquierda. */
export type ZoneCoord = { zx: number; zy: number; zz: number };

/**
 * Un LOTE = una compra de un cliente. Es la unidad que el operario mueve: escanea
 * una caja y monta el lote entero (SDD-0155).
 */
export type Lote = {
  id: string;
  markbox: string | null;
  clientName: string | null;
  /** Cantidad de cajas del lote. Entero ≥ 1. */
  cajas: number;
  /** CBM total del lote (no por caja). > 0. */
  cbm: number;
  /**
   * Orden de descarga en destino: 1 = se descarga primero. Los que se descargan
   * primero quedan cerca de la PUERTA, así que se cargan al final. Si se omite,
   * todos valen igual y el reparto solo agrupa por cliente.
   */
  ordenDescarga?: number | null;
  /**
   * Manejo especial al descargar: "montacargas", "grúa", "entre varios"… Se
   * arrastra hasta la lista de descarga para poder llamar al equipo a la hora
   * justa y no tenerlo esperando desde el principio.
   */
  manejoEspecial?: string | null;
};

/** Espejo de una fila de `container_types` con lo que este módulo necesita. */
export type EspacioCarga = {
  code: string;
  label: string;
  /** Capacidad ÚTIL en CBM (68 para el 40'HC), NUNCA el volumen geométrico. */
  cbmCapacity: number;
  /** Techo real medido: pasarlo AVISA, no bloquea. `null` = sin aviso. */
  cbmAlertCeiling?: number | null;
  layout: ZoneLayout;
};

/** Un paso del plan = un lote y las zonas que le tocan. Es lo que ve el operario. */
export type PasoCarga = {
  /** 1-based: "Lote 3 de 7". */
  paso: number;
  loteId: string;
  markbox: string | null;
  clientName: string | null;
  /** Cajas del lote que SÍ entran (= `cajas` del lote salvo que se haya partido). */
  cajasUbicadas: number;
  /** CBM que SÍ entra. */
  cbmUbicado: number;
  /** Zonas que ocupa, en orden de llenado. Nunca vacío. */
  zonas: ZoneCoord[];
  /** Etiqueta legible de la primera zona: "Fondo · Izquierda · Piso". */
  destino: string;
  /** `true` si el lote no entró completo y quedó un remanente en `sinUbicar`. */
  parcial: boolean;
  /** Manejo especial declarado en el lote. Se arrastra a la lista de descarga. */
  manejoEspecial: string | null;
};

/** Lo que no entró: se va al siguiente contenedor. */
export type LoteSinUbicar = {
  loteId: string;
  markbox: string | null;
  clientName: string | null;
  cajas: number;
  cbm: number;
};

export type AvisoPlan = {
  tipo: "techo_real" | "sobre_capacidad" | "sin_espacio" | "lote_partido";
  mensaje: string;
};

export type PlanCarga = {
  espacio: EspacioCarga;
  /** CBM que aguanta cada zona = capacidad útil ÷ cantidad de zonas. */
  cbmPorZona: number;
  pasos: PasoCarga[];
  sinUbicar: LoteSinUbicar[];
  stats: {
    cbmUbicado: number;
    cajasUbicadas: number;
    zonasUsadas: number;
    zonasTotales: number;
    /** % sobre la capacidad ÚTIL. */
    pctVolumen: number;
    pctZonas: number;
  };
  avisos: AvisoPlan[];
};

// ╔═══════════════════════════════════════════════════════════╗
// ║ Etiquetas · español VE                                    ║
// ╚═══════════════════════════════════════════════════════════╝

/** Fondo/Medio/Puerta cuando son 3; si no, "Tramo N". */
export function etiquetasLargo(nx: number): string[] {
  if (nx === 3) return ["Fondo", "Medio", "Puerta"];
  if (nx === 2) return ["Fondo", "Puerta"];
  return Array.from({ length: nx }, (_, i) => `Tramo ${i + 1}`);
}

/** Izquierda/Centro/Derecha cuando son 3; si no, "Fila N". */
export function etiquetasAncho(nz: number): string[] {
  if (nz === 3) return ["Izquierda", "Centro", "Derecha"];
  if (nz === 2) return ["Izquierda", "Derecha"];
  return Array.from({ length: nz }, (_, i) => `Fila ${i + 1}`);
}

/** Piso/Arriba cuando son 2; si no, "Nivel N". */
export function etiquetasAlto(ny: number): string[] {
  if (ny === 2) return ["Piso", "Arriba"];
  if (ny === 3) return ["Piso", "Medio", "Arriba"];
  return Array.from({ length: ny }, (_, i) => `Nivel ${i + 1}`);
}

/** "Fondo · Izquierda · Piso" — para el operario, la leyenda y el reporte. */
export function etiquetaZona(layout: ZoneLayout, z: ZoneCoord): string {
  const l = etiquetasLargo(layout.nx)[z.zx] ?? `Tramo ${z.zx + 1}`;
  const w = etiquetasAncho(layout.nz)[z.zz] ?? `Fila ${z.zz + 1}`;
  const h = etiquetasAlto(layout.ny)[z.zy] ?? `Nivel ${z.zy + 1}`;
  return `${l} · ${w} · ${h}`;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Capacidad                                                 ║
// ╚═══════════════════════════════════════════════════════════╝

export function cantidadZonas(layout: ZoneLayout): number {
  return layout.nx * layout.ny * layout.nz;
}

/** Capacidad útil repartida en partes iguales entre las zonas. */
export function cbmPorZona(espacio: EspacioCarga): number {
  const total = cantidadZonas(espacio.layout);
  if (total <= 0) return 0;
  return espacio.cbmCapacity / total;
}

/** Cuántas zonas consume un lote. Siempre ≥ 1: un lote existe aunque mida poco. */
export function zonasNecesarias(cbm: number, porZona: number): number {
  if (porZona <= 0) return 0;
  return Math.max(1, Math.ceil(redondear(cbm / porZona, 6)));
}

/**
 * Zonas en el orden REAL de carga: se llena tramo por tramo desde el fondo hacia
 * la puerta y, dentro de cada tramo, el piso completo a lo ancho antes de subir.
 *
 * El orden importa y no es el de `allZones()` de `zones.ts` (que recorre todo un
 * nivel del contenedor antes de subir): al cargar de verdad no se puede volver al
 * fondo después de haber llenado el frente.
 */
export function zonasEnOrdenDeCarga(layout: ZoneLayout): ZoneCoord[] {
  const out: ZoneCoord[] = [];
  for (let zx = 0; zx < layout.nx; zx++) {
    for (let zy = 0; zy < layout.ny; zy++) {
      for (let zz = 0; zz < layout.nz; zz++) {
        out.push({ zx, zy, zz });
      }
    }
  }
  return out;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ El repartidor                                             ║
// ╚═══════════════════════════════════════════════════════════╝

/**
 * Orden de carga de los lotes. DETERMINISTA: el desempate por markbox y luego por
 * id garantiza que dos corridas con la misma entrada den el mismo plan — requisito
 * para poder versionar planes y compararlos contra la realidad.
 *
 * `ordenDescarga` DESCENDENTE: el que se descarga último se carga primero, y por
 * lo tanto queda al fondo. Los lotes sin orden declarado van al final del criterio
 * y solo se agrupan por cliente.
 */
export function ordenarLotes(lotes: readonly Lote[]): Lote[] {
  return [...lotes].sort((a, b) => {
    const oa = a.ordenDescarga ?? 0;
    const ob = b.ordenDescarga ?? 0;
    if (oa !== ob) return ob - oa;
    const ma = a.markbox ?? "";
    const mb = b.markbox ?? "";
    if (ma !== mb) return ma.localeCompare(mb);
    return a.id.localeCompare(b.id);
  });
}

/**
 * Reparte los lotes en las zonas del contenedor.
 *
 * Determinista y sin efectos: misma entrada ⇒ mismo plan, siempre. No usa
 * `Math.random` ni la fecha.
 */
export function planificarCarga(
  lotes: readonly Lote[],
  espacio: EspacioCarga,
): PlanCarga {
  const zonasTotales = cantidadZonas(espacio.layout);
  const porZona = cbmPorZona(espacio);
  const orden = zonasEnOrdenDeCarga(espacio.layout);

  const pasos: PasoCarga[] = [];
  const sinUbicar: LoteSinUbicar[] = [];
  const avisos: AvisoPlan[] = [];

  // Rejilla degenerada (nx/ny/nz en 0) o capacidad nula: no hay nada que repartir.
  if (zonasTotales <= 0 || porZona <= 0) {
    for (const l of ordenarLotes(lotes)) {
      sinUbicar.push({
        loteId: l.id,
        markbox: l.markbox,
        clientName: l.clientName,
        cajas: l.cajas,
        cbm: l.cbm,
      });
    }
    if (sinUbicar.length > 0) {
      avisos.push({
        tipo: "sin_espacio",
        mensaje: `El contenedor ${espacio.label} no tiene zonas configuradas.`,
      });
    }
    return {
      espacio,
      cbmPorZona: 0,
      pasos: [],
      sinUbicar,
      stats: {
        cbmUbicado: 0,
        cajasUbicadas: 0,
        zonasUsadas: 0,
        zonasTotales: Math.max(0, zonasTotales),
        pctVolumen: 0,
        pctZonas: 0,
      },
      avisos,
    };
  }

  let cursor = 0; // próxima zona libre en el orden de carga
  let paso = 0;
  let cbmUbicado = 0;
  let cajasUbicadas = 0;

  for (const lote of ordenarLotes(lotes)) {
    const libres = orden.length - cursor;
    if (libres <= 0) {
      sinUbicar.push({
        loteId: lote.id,
        markbox: lote.markbox,
        clientName: lote.clientName,
        cajas: lote.cajas,
        cbm: lote.cbm,
      });
      continue;
    }

    const pedidas = zonasNecesarias(lote.cbm, porZona);
    const dadas = Math.min(pedidas, libres);
    const parcial = dadas < pedidas;

    // Una caja sola no se parte: o entra completa o viaja en el próximo contenedor.
    if (parcial && lote.cajas <= 1) {
      sinUbicar.push({
        loteId: lote.id,
        markbox: lote.markbox,
        clientName: lote.clientName,
        cajas: lote.cajas,
        cbm: lote.cbm,
      });
      continue;
    }

    // Lote partido: entra la fracción que cubren las zonas disponibles. El resto
    // viaja en el próximo contenedor. Espeja `p_count < lote` de SDD-0155.
    const fraccion = parcial ? dadas / pedidas : 1;
    const cbmEntra = parcial ? redondear(lote.cbm * fraccion, 3) : lote.cbm;
    const cajasEntran = parcial
      ? Math.max(1, Math.floor(lote.cajas * fraccion))
      : lote.cajas;

    const zonas = orden.slice(cursor, cursor + dadas);
    cursor += dadas;
    paso += 1;

    pasos.push({
      paso,
      loteId: lote.id,
      markbox: lote.markbox,
      clientName: lote.clientName,
      cajasUbicadas: cajasEntran,
      cbmUbicado: cbmEntra,
      zonas,
      destino: etiquetaZona(espacio.layout, zonas[0]),
      parcial,
      manejoEspecial: lote.manejoEspecial ?? null,
    });

    cbmUbicado = redondear(cbmUbicado + cbmEntra, 3);
    cajasUbicadas += cajasEntran;

    if (parcial) {
      const cajasResto = lote.cajas - cajasEntran;
      const cbmResto = redondear(lote.cbm - cbmEntra, 3);
      sinUbicar.push({
        loteId: lote.id,
        markbox: lote.markbox,
        clientName: lote.clientName,
        cajas: cajasResto,
        cbm: cbmResto,
      });
      avisos.push({
        tipo: "lote_partido",
        mensaje: `${etiquetaLote(lote)} no entró completo: quedan ${cajasResto} cajas (${cbmResto} CBM) para el próximo contenedor.`,
      });
    }
  }

  const soloSinEspacio = sinUbicar.length - avisos.filter((a) => a.tipo === "lote_partido").length;
  if (soloSinEspacio > 0) {
    avisos.push({
      tipo: "sin_espacio",
      mensaje: `${soloSinEspacio} lote${soloSinEspacio === 1 ? "" : "s"} sin ubicar: hace falta otro contenedor.`,
    });
  }

  const techo = espacio.cbmAlertCeiling;
  if (techo != null && techo > 0 && cbmUbicado > techo) {
    avisos.push({
      tipo: "techo_real",
      mensaje: `${cbmUbicado} CBM supera el techo real medido de ${techo} CBM para un ${espacio.label}. Revisa antes de cerrar.`,
    });
  }
  if (cbmUbicado > espacio.cbmCapacity) {
    avisos.push({
      tipo: "sobre_capacidad",
      mensaje: `${cbmUbicado} CBM supera la capacidad útil de ${espacio.cbmCapacity} CBM.`,
    });
  }

  return {
    espacio,
    cbmPorZona: redondear(porZona, 4),
    pasos,
    sinUbicar,
    stats: {
      cbmUbicado,
      cajasUbicadas,
      zonasUsadas: cursor,
      zonasTotales,
      pctVolumen: pct(cbmUbicado, espacio.cbmCapacity),
      pctZonas: pct(cursor, zonasTotales),
    },
    avisos,
  };
}

/**
 * Encadena contenedores hasta ubicar todo. Devuelve un plan por contenedor —
 * el desborde del tutorial 4 de EasyCargo, que en consolidados pasa seguido.
 *
 * `maxContenedores` es un tope de seguridad, no una regla de negocio: sin él, un
 * lote más grande que un contenedor entero haría girar el bucle sin avanzar.
 */
export function planificarEnCadena(
  lotes: readonly Lote[],
  espacio: EspacioCarga,
  maxContenedores = 10,
): PlanCarga[] {
  const planes: PlanCarga[] = [];
  let pendientes: Lote[] = [...lotes];

  for (let i = 0; i < maxContenedores && pendientes.length > 0; i++) {
    const plan = planificarCarga(pendientes, espacio);
    planes.push(plan);

    // Sin avance (nada entró) ⇒ cortar; si no, bucle infinito.
    if (plan.pasos.length === 0) break;

    pendientes = plan.sinUbicar.map((s) => {
      const original = pendientes.find((l) => l.id === s.loteId);
      return {
        id: s.loteId,
        markbox: s.markbox,
        clientName: s.clientName,
        cajas: s.cajas,
        cbm: s.cbm,
        ordenDescarga: original?.ordenDescarga ?? null,
      };
    });
  }

  return planes;
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Las dos preguntas reales                                  ║
// ╚═══════════════════════════════════════════════════════════╝
// El plan no se hace para optimizar el llenado: se hace para poder RESPONDER
// dos cosas, las dos en el teléfono y las dos en Venezuela.
//   1. "Aduana quiere revisar a DTD-0042: ¿dónde está?" → no bajar el contenedor
//      entero, sacar solo esas cajas.  → ubicacionDeCliente()
//   2. "¿Qué sale primero?" → asignarle piso en el galpón antes de abrir, y saber
//      CUÁNDO aparece lo que necesita montacargas para llamarlo a la hora justa.
//      → ordenDeDescarga()

/** Tramo o rango de tramos que abarca un conjunto de zonas: "Medio" o "Medio a Puerta". */
export function tramoDe(layout: ZoneLayout, zonas: readonly ZoneCoord[]): string {
  if (zonas.length === 0) return "—";
  const etiquetas = etiquetasLargo(layout.nx);
  let min = Infinity;
  let max = -Infinity;
  for (const z of zonas) {
    if (z.zx < min) min = z.zx;
    if (z.zx > max) max = z.zx;
  }
  const a = etiquetas[min] ?? `Tramo ${min + 1}`;
  const b = etiquetas[max] ?? `Tramo ${max + 1}`;
  return a === b ? a : `${a} a ${b}`;
}

/** Los lados a lo ancho que ocupa un conjunto de zonas: "Izquierda y Centro". */
export function ladosDe(layout: ZoneLayout, zonas: readonly ZoneCoord[]): string {
  if (zonas.length === 0) return "—";
  const etiquetas = etiquetasAncho(layout.nz);
  const usados = [...new Set(zonas.map((z) => z.zz))].sort((a, b) => a - b);
  const nombres = usados.map((i) => etiquetas[i] ?? `Fila ${i + 1}`);
  if (nombres.length === 1) return nombres[0];
  if (nombres.length === etiquetas.length) return "Todo el ancho";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

export type PasoDescarga = {
  /** 1 = lo primero que sale del contenedor. */
  orden: number;
  loteId: string;
  markbox: string | null;
  clientName: string | null;
  cajas: number;
  cbm: number;
  zonas: ZoneCoord[];
  /** "Puerta" o "Medio a Puerta". Lo que necesita saber quien descarga. */
  tramo: string;
  /** "Derecha" o "Izquierda y Centro". */
  lados: string;
  manejoEspecial: string | null;
};

/**
 * El orden en que la carga va a SALIR: el revés del orden de carga, porque se
 * descarga por la puerta y lo último que entró es lo primero que se alcanza.
 *
 * Es aproximado a propósito, como todo el módulo: dentro de un mismo tramo el
 * orden real lo decide quien descarga. Sirve para decidir a qué lote asignarle
 * piso en el galpón y cuándo pedir el montacargas, no para cronometrar.
 */
export function ordenDeDescarga(plan: PlanCarga): PasoDescarga[] {
  const layout = plan.espacio.layout;
  return [...plan.pasos]
    .sort((a, b) => b.paso - a.paso)
    .map((p, i) => ({
      orden: i + 1,
      loteId: p.loteId,
      markbox: p.markbox,
      clientName: p.clientName,
      cajas: p.cajasUbicadas,
      cbm: p.cbmUbicado,
      zonas: p.zonas,
      tramo: tramoDe(layout, p.zonas),
      lados: ladosDe(layout, p.zonas),
      manejoEspecial: p.manejoEspecial,
    }));
}

export type UbicacionCliente = {
  markbox: string;
  clientName: string | null;
  cajas: number;
  cbm: number;
  zonas: ZoneCoord[];
  /** "Medio a Puerta". */
  tramo: string;
  /** "Derecha". */
  lados: string;
  /** Puesto en la fila de descarga: 1 = sale primero. */
  ordenDescarga: number;
  /** Frase lista para leer en el teléfono: "Medio · Derecha · sale 2º de 5". */
  resumen: string;
};

/**
 * Dónde está la carga de un cliente. La pregunta de aduana: si quieren revisar a
 * DTD-0042, esto evita bajar el contenedor entero.
 *
 * Un cliente puede tener más de un lote en el mismo contenedor; se agregan todos.
 */
export function ubicacionDeCliente(
  plan: PlanCarga,
  markbox: string,
): UbicacionCliente | null {
  const suyos = plan.pasos.filter((p) => p.markbox === markbox);
  if (suyos.length === 0) return null;

  const layout = plan.espacio.layout;
  const zonas = suyos.flatMap((p) => p.zonas);
  const fila = ordenDeDescarga(plan);
  const puesto = fila.find((d) => d.markbox === markbox)?.orden ?? fila.length;

  const tramo = tramoDe(layout, zonas);
  const lados = ladosDe(layout, zonas);

  return {
    markbox,
    clientName: suyos[0].clientName,
    cajas: suyos.reduce((a, p) => a + p.cajasUbicadas, 0),
    cbm: redondear(
      suyos.reduce((a, p) => a + p.cbmUbicado, 0),
      3,
    ),
    zonas,
    tramo,
    lados,
    ordenDescarga: puesto,
    resumen: `${tramo} · ${lados} · sale ${puesto}º de ${fila.length}`,
  };
}

/** Todas las zonas ocupadas del plan, aplanadas — lo que consume el visor. */
export function zonasDelPlan(
  plan: PlanCarga,
): (ZoneCoord & { loteId: string; markbox: string | null; paso: number })[] {
  return plan.pasos.flatMap((p) =>
    p.zonas.map((z) => ({
      ...z,
      loteId: p.loteId,
      markbox: p.markbox,
      paso: p.paso,
    })),
  );
}

// ╔═══════════════════════════════════════════════════════════╗
// ║ Helpers                                                   ║
// ╚═══════════════════════════════════════════════════════════╝

function etiquetaLote(l: Lote): string {
  return l.markbox ?? l.clientName ?? `Lote ${l.id}`;
}

/** Redondeo a N decimales sin arrastrar el ruido binario de los flotantes. */
function redondear(n: number, decimales: number): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

function pct(parte: number, total: number): number {
  if (total <= 0) return 0;
  return redondear((parte / total) * 100, 1);
}
