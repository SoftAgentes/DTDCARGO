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
 * Un área con cuánto CBM de un lote cae en ella. Las áreas se COMPARTEN entre
 * clientes, así que un área puede aparecer en los `zonas` de varios pasos, cada
 * uno con su porción.
 */
export type ZonaOcupada = ZoneCoord & { cbm: number };

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
  /** Áreas que ocupa, en orden de llenado, con cuánto CBM cae en cada una. Nunca vacío. */
  zonas: ZonaOcupada[];
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

/**
 * El lado como complemento, para poder pegarlo al tramo: "a la izquierda".
 * Se usa "al centro" y no "en el medio" porque el tramo del medio ya se llama
 * "Medio" y "Medio en el medio" no se entiende.
 */
export function fraseLado(nz: number, zz: number): string {
  if (nz === 3) {
    return ["a la izquierda", "al centro", "a la derecha"][zz] ?? `en la fila ${zz + 1}`;
  }
  if (nz === 2) {
    return ["a la izquierda", "a la derecha"][zz] ?? `en la fila ${zz + 1}`;
  }
  return `en la fila ${zz + 1}`;
}

/**
 * "Fondo a la izquierda" · "Medio al centro" · "Puerta a la derecha".
 *
 * UNA frase, no tres ejes sueltos: es lo que se lee de un vistazo en el teléfono
 * y lo que hace falta para decidir si se puede abrir un pasillo por un lado en
 * vez de bajar el contenedor entero.
 *
 * **La altura no aparece.** El modelo real (SDD-0155) no tiene niveles: el
 * operario solo elige izquierda, centro o derecha. Si algún contenedor se
 * configura con más de un nivel, recién ahí se agrega al final.
 */
export function etiquetaZona(layout: ZoneLayout, z: ZoneCoord): string {
  const tramo = etiquetasLargo(layout.nx)[z.zx] ?? `Tramo ${z.zx + 1}`;
  const base = `${tramo} ${fraseLado(layout.nz, z.zz)}`;
  if (layout.ny <= 1) return base;
  const nivel = etiquetasAlto(layout.ny)[z.zy] ?? `Nivel ${z.zy + 1}`;
  return `${base} · ${nivel}`;
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

  // ── Reparto con áreas COMPARTIDAS (founder, 2026-07-30) ────────────────
  // Varios clientes conviven en la misma área: dos lotes chicos van los dos al
  // "Fondo a la izquierda", uno al lado del otro. Si cada lote se quedara con
  // áreas enteras, un consolidado de 10 clientes agotaría las 9 áreas con el
  // contenedor a media carga. Por eso se lleva el CBM libre de cada área y se va
  // repartiendo, en vez de contar casillas.
  let zi = 0; // área en curso, en el orden de carga
  let libreEnArea = porZona;
  let paso = 0;
  let cbmUbicado = 0;
  let cajasUbicadas = 0;
  const areasTocadas = new Set<string>();

  /**
   * Avanza consumiendo `cbm` desde el área en curso, anotando cuánto cae en cada
   * una. Devuelve lo que NO se pudo ubicar.
   *
   * El CBM NO se reparte en partes iguales: se llena un área y se pasa a la
   * siguiente. Por eso cada `ZonaOcupada` lleva su propio `cbm` — es lo que el
   * visor necesita para pintar un área a medio llenar.
   */
  const consumir = (cbm: number, tocadas: ZonaOcupada[]): number => {
    let restante = cbm;
    while (restante > EPS) {
      if (libreEnArea <= EPS) {
        // Solo se abre un área nueva si de verdad existe. Antes se reseteaba
        // `libreEnArea` aun al pasarse del final, y ese valor obsoleto podía
        // sobrecargar un área ya llena si el cursor volvía atrás.
        if (zi + 1 >= orden.length) break;
        zi += 1;
        libreEnArea = porZona;
      }
      const usa = Math.min(restante, libreEnArea);
      const z = orden[zi];
      const ultima = tocadas[tocadas.length - 1];
      if (ultima && mismaZona(ultima, z)) {
        ultima.cbm = redondear(ultima.cbm + usa, 4);
      } else {
        tocadas.push({ ...z, cbm: redondear(usa, 4) });
      }
      restante -= usa;
      libreEnArea -= usa;
    }
    return restante;
  };
  // `areasTocadas` se completa recién cuando el lote se ACEPTA: si se rechaza,
  // se restaura el cursor y sus áreas no deben quedar contadas.

  const rechazar = (lote: Lote) => {
    sinUbicar.push({
      loteId: lote.id,
      markbox: lote.markbox,
      clientName: lote.clientName,
      cajas: lote.cajas,
      cbm: lote.cbm,
    });
  };

  for (const lote of ordenarLotes(lotes)) {
    // Sin área en curso ni áreas por delante: no entra nada más.
    if (zi >= orden.length) {
      rechazar(lote);
      continue;
    }

    // Se consume sobre el estado real y se restaura si hay que rechazar el lote.
    const zGuardado = zi;
    const libreGuardado = libreEnArea;
    const zonas: ZonaOcupada[] = [];
    let sobra: number;

    if (lote.cbm <= EPS) {
      // Sin CBM declarado (prealerta incompleta): igual hay mercancía y hay que
      // decirle al operario dónde ponerla. Se le señala el área en curso y no
      // descuenta capacidad, porque no se sabe cuánta ocupa.
      zonas.push({ ...orden[zi], cbm: 0 });
      sobra = 0;
    } else {
      sobra = consumir(lote.cbm, zonas);
    }

    const parcial = sobra > EPS;
    const nadaEntro = zonas.length === 0;

    // Se rechaza entero si no entró NADA, o si entró a medias siendo indivisible
    // (una caja sola no se corta por la mitad).
    if (nadaEntro || (parcial && lote.cajas <= 1)) {
      zi = zGuardado;
      libreEnArea = libreGuardado;
      rechazar(lote);
      continue;
    }

    for (const z of zonas) areasTocadas.add(zoneKey(z));

    // Lote partido: entra lo que cupo, el resto viaja en el próximo contenedor.
    // Espeja `p_count < lote` de SDD-0155.
    const cbmEntra = redondear(lote.cbm - sobra, 3);
    const fraccion = lote.cbm > 0 ? cbmEntra / lote.cbm : 1;
    const cajasEntran = parcial
      ? Math.max(1, Math.floor(lote.cajas * fraccion))
      : lote.cajas;

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
      zonasUsadas: areasTocadas.size,
      zonasTotales,
      pctVolumen: pct(cbmUbicado, espacio.cbmCapacity),
      pctZonas: pct(areasTocadas.size, zonasTotales),
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

/**
 * Describe un conjunto de zonas en UNA frase.
 *
 * Cuando la carga está en un solo tramo y un solo lado —el caso normal— sale la
 * frase natural: "Fondo a la izquierda". Cuando se desparrama, cae a la forma
 * larga: "Fondo a Medio · Izquierda y Centro".
 */
export function frasePosicion(layout: ZoneLayout, zonas: readonly ZoneCoord[]): string {
  if (zonas.length === 0) return "—";
  const tramosUsados = new Set(zonas.map((z) => z.zx));
  const ladosUsados = new Set(zonas.map((z) => z.zz));
  if (tramosUsados.size === 1 && ladosUsados.size === 1) {
    return etiquetaZona(layout, zonas[0]);
  }
  return `${tramoDe(layout, zonas)} · ${ladosDe(layout, zonas)}`;
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
  /** La frase que se lee en el teléfono: "Fondo a la izquierda". */
  ubicacion: string;
  /** "Puerta" o "Medio a Puerta". Para columnas de tabla. */
  tramo: string;
  /** "Derecha" o "Izquierda y Centro". Para columnas de tabla. */
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
      ubicacion: frasePosicion(layout, p.zonas),
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
  /** La frase que se lee en el teléfono: "Medio a la derecha". */
  ubicacion: string;
  /** "Medio a Puerta". Para columnas de tabla. */
  tramo: string;
  /** "Derecha". Para columnas de tabla. */
  lados: string;
  /** Puesto en la fila de descarga: 1 = sale primero. */
  ordenDescarga: number;
  /** Todo junto: "Medio a la derecha · sale 2º de 5". */
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

  const ubicacion = frasePosicion(layout, zonas);

  return {
    markbox,
    clientName: suyos[0].clientName,
    cajas: suyos.reduce((a, p) => a + p.cajasUbicadas, 0),
    cbm: redondear(
      suyos.reduce((a, p) => a + p.cbmUbicado, 0),
      3,
    ),
    zonas,
    ubicacion,
    tramo: tramoDe(layout, zonas),
    lados: ladosDe(layout, zonas),
    ordenDescarga: puesto,
    resumen: `${ubicacion} · sale ${puesto}º de ${fila.length}`,
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

/**
 * Tolerancia para comparar CBM. Los volúmenes vienen con 2-3 decimales; sin este
 * margen, un residuo de 1e-15 haría que un lote se declare "partido" o que el
 * bucle de reparto no termine.
 */
const EPS = 1e-6;

function zoneKey(z: ZoneCoord): string {
  return `${z.zx}-${z.zy}-${z.zz}`;
}

function mismaZona(a: ZoneCoord, b: ZoneCoord): boolean {
  return a.zx === b.zx && a.zy === b.zy && a.zz === b.zz;
}

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
