import {
  DESTINOS_NACIONALES,
  PRECIO_TRAMO,
  type TramoTerrestre,
} from "@/lib/data/destinos-nacionales";

export { PRECIO_TRAMO };
export type { TramoTerrestre };

/**
 * Calculadora LCL DDP — China → Venezuela
 *
 * ═══════════════════════════════════════════════════════════════════
 *  ⚠️ TODO LO EDITABLE ESTÁ EN ESTE ARCHIVO, ARRIBA DEL CÓDIGO.
 *     Cambiá los números y la calculadora completa se ajusta.
 *     (Fase 3: estos valores pasarán a configurarse desde el Studio.)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Lógica (resumen para no-devs):
 *  1. El cliente ingresa el CBM total (m³) directo y, si lo sabe, el peso total
 *     (kg). **El peso es OPCIONAL desde SDD-0257**: sin él la cotización sale
 *     igual, sin recargo por densidad, y se marca `sinPeso: true` — el total es
 *     el piso real de esa carga, exacto hasta `pesoMaxSinRecargo()` kg. El CBM
 *     sí es obligatorio: es el que fija el precio.
 *  2. Precio = CBM × tarifaBase + recargo por DENSIDAD: el peso que excede
 *     `pesoIncluidoKg` por CBM se cobra a `recargoExcedenteKg`/kg (founder
 *     2026-06-20, reactiva la regla pausada el 2026-06-08; configurable en el ERP).
 *  3. El recargo por densidad es CONTINUO, sin tope: siempre se auto-cotiza, no
 *     deriva al asesor. Tope ABSOLUTO de peso: 27.000 kg → deriva al asesor.
 *  4. Recargos: embalaje especial (madera/paleta) + ciudad fuera del casco central.
 *  5. Baterías: multiplican el flete (×recargoBateriaMult).
 *  6. Carga especial / peligrosa → no cotiza, deriva al asesor.
 *  7. Descuento sede: -$ si la ciudad de destino es Valencia.
 *  8. LCL Consolidado por debajo de 1 m³ → no cotiza, deriva al asesor (el BL
 *     propio es un gasto fijo de hasta USD 300 y la carga chica termina
 *     abandonada en el almacén fiscal). Ver `CONSOLIDADO_CBM_MINIMO`.
 *  Orden: (base + ciudad + embalaje) × batería − descuento, luego piso.
 */

// ────────────────────────────────────────────────────────────────────
// 1) CONFIG GENERAL — TARIFAS Y UMBRALES
//    👉 Edita estos números para ajustar precios y reglas.
// ────────────────────────────────────────────────────────────────────

export const CONFIG = {
  /**
   * Tarifa base por metro cúbico en USD (precio limpio sin excedente).
   *
   * ⚠️ ESTE 850 COINCIDE A PROPÓSITO con la tarifa pública del puerta a puerta
   * que vive en la tabla `rates` del ERP (la fila `is_public`, editable desde
   * /studio/tarifas). No es casualidad y no se toca a la ligera:
   *
   * La RPC `public_cbm_rate()` filtra por `valid_until >= current_date`. El día
   * que la tarifa pública se venza, la RPC no devuelve NADA y el calculador del
   * sitio cae a esta constante — sin avisarle a nadie. Mientras los dos números
   * sean iguales, ese vencimiento es invisible para el cliente: el sitio sigue
   * cotizando el mismo precio.
   *
   * Si algún día suben la tarifa en el Studio, HAY QUE SUBIR TAMBIÉN ESTE
   * NÚMERO. Si no, se reabre la grieta: al vencer la vigencia el sitio empieza
   * a cotizar por debajo del precio real, en silencio.
   *
   * 📌 Pasó exactamente eso, y por eso hoy dice 850 (SDD-0475, 2026-09-17):
   * la migr `0336_rate_ddp_850_septiembre_2026.sql` subió la tarifa pública a
   * $850 con `pg_cron` el 2026-09-04 y su cabecera avisaba —líneas 20-23— que
   * ese mismo día había que subir esta constante en un deploy. No se hizo. Trece
   * días con el ERP cobrando $850 y el respaldo en $800: ante una caída de
   * Supabase el sitio habría cotizado **6,25% por debajo**, sin error visible.
   * Lo mismo le había pasado antes a `pesoIncluidoKg` (ver abajo).
   *
   * La cifra, bien dicha: con $850 vigente y $800 de respaldo el sitio cotiza
   * **5,88% por debajo** (50/850). El 6,25% es 50/800 — cuánto hay que SUBIR,
   * que no es lo mismo y en una decisión de precios no son intercambiables.
   *
   * ⚠️ OJO CON LA VIGENCIA: la fila de $850 vale hasta el **2026-11-29**. Al
   * vencer, la RPC devuelve null y el sitio cotiza con este 850 — correcto sólo
   * mientras la tarifa siga siendo 850. Si se decide otro precio, hay que mover
   * los dos: la fila en /studio/tarifas y esta constante.
   *
   * (Esa fecha estuvo cargada como 2026-10-04, casi dos meses antes de lo que
   * correspondía; se corrigió en producción el 2026-09-17 — SDD-0475.)
   *
   * La alerta de vencimiento SÍ existe y está activa (SDD-0164, migr 0257 +
   * `app/api/cron/rate-expiry-alert`, programado en vercel.json): avisa por
   * Telegram y email cuando una tarifa pública está por vencer o venció. Lo que
   * NO cubre es este respaldo — el 4-sep no hubo vencimiento, hubo un cambio de
   * precio, y de eso no avisa nadie. Esa es la grieta que quedó.
   *
   * La red de CI está en `__tests__/calculadora-respaldo-alineado.test.ts`:
   * ancla este valor y vigila la fecha de vigencia.
   */
  tarifaBaseCBM: 850,

  /**
   * Gracia de peso por CBM incluida en la tarifa base. Sobre esto = excedente.
   *
   * ⚠️ ESPEJA `calculator_settings.peso_incluido_kg` DE PRODUCCIÓN. Igual que
   * `tarifaBaseCBM` espeja la tarifa pública, este número es el respaldo que se
   * usa cuando la RPC `public_calculator_config` no responde (Supabase caído,
   * fila borrada). Si los dos no coinciden, una caída de Supabase no da error:
   * cambia el precio EN SILENCIO.
   *
   * Pasó de verdad: el ERP tenía 1.000 kg desde el 2026-07-06 y acá seguía
   * diciendo 500 — ante una caída, la calculadora habría cobrado excedente al
   * doble de clientes. Corregido el 2026-08-05 (founder).
   *
   * Si se cambia en Admin › Calculadora pública, HAY QUE CAMBIARLO ACÁ TAMBIÉN.
   */
  pesoIncluidoKg: 1000,

  /**
   * Tarifa por kg que excede `pesoIncluidoKg` (recargo continuo, sin tope).
   * Ej: si la carga pesa 1.200 kg en 1 CBM, el excedente es 200 kg × $2 = +$400.
   *
   * ⚠️ Espeja `calculator_settings.recargo_excedente_kg` de producción — misma
   * regla que `pesoIncluidoKg` de arriba: si se desincronizan, la caída de
   * Supabase cobra distinto sin avisar.
   */
  recargoExcedenteKg: 2,

  /**
   * Descuento si el destino es Valencia (la sede DTD). USD.
   * 0 = sin descuento (regla vigente desde 2026-06-04; el -$50 quedó obsoleto).
   * Configurable desde /studio/tarifas › Parámetros.
   */
  descuentoValencia: 0,

  /**
   * Recargo por embalaje especial (madera o paleta) en USD.
   * Aplica una sola vez, no por caja.
   */
  recargoEmbalajeEspecial: 50,

  /**
   * Multiplicador del flete cuando la carga lleva baterías (riesgo/manejo).
   * 1.3 = +30% sobre el flete (antes del descuento de sede).
   *
   * ⚠️ Espeja `calculator_settings.recargo_bateria_mult` de producción (1.3).
   * Estuvo en 1.5 acá mientras el ERP ya cobraba 1.3 — mismo riesgo silencioso
   * que `pesoIncluidoKg`. Corregido el 2026-08-05 (founder).
   */
  recargoBateriaMult: 1.3,

  /**
   * ⚠️ LEGACY — ya no fija ningún precio (SDD-0237, founder 1-ago-2026).
   *
   * Era el umbral en km del viejo "casco central". El cobro de la entrega
   * nacional pasó a ser `CBM × precio del tramo`: no hay kilómetros en la
   * cuenta. Sobrevive en `CalcParams` sólo porque la columna sigue viva en
   * `calculator_settings` y quitarla exigiría una migración destructiva; se
   * retiró de la UI del Admin para que nadie edite un número que no hace nada.
   */
  thresholdCascoKm: 200,

  /**
   * ⚠️ LEGACY — ya no fija ningún precio. Ver `thresholdCascoKm` arriba.
   *
   * La fórmula que reemplaza (`max(0, km − 200) × $1`) no correspondía a
   * ningún modelo real: sobrecobraba +706% en Puerto Ordaz a 0,5 m³ y
   * subcobraba −80% en Barquisimeto a 5 m³.
   */
  tarifaKmFueraCasco: 1,

  /** Precio mínimo facturable. Si la carga es muy chica, este es el piso. */
  minimoFacturable: 50,

  /**
   * CBM total máximo cotizable por la calculadora (LCL). Sobre esto, la carga
   * ya no entra en un contenedor estándar → deriva al asesor (FCL).
   *
   * ⚠️ SON 68 Y SE QUEDAN EN 68 — decisión del founder, 1-ago-2026.
   *
   * No lo "corrijas" a 66,4. Ese otro número existe y es real: es
   * `container_types.cbm_alert_ceiling` (migración 0297), el techo MEDIDO en un
   * contenedor propio de DTD, y es el que usa el módulo de naviera para
   * planificar la estiba. Son dos cosas distintas a propósito:
   *
   *  · 66,4 = lo que de verdad entró una vez. Sirve para planificar un
   *    consolidado real, donde meter de más significa dejar carga en el muelle.
   *  · 68   = hasta dónde la calculadora auto-cotiza. Es un tope COMERCIAL, no
   *    una medida: bajarlo manda al asesor cargas grandes que hoy cotizan
   *    solas, y el cliente grande es justo el que interesa.
   *
   * Configurable desde Admin › Calculadora pública si algún día cambia.
   */
  cbmMaxContenedor: 68,

  /**
   * Peso total máximo cotizable (kg). Sobre esto supera el peso admitido por
   * contenedor → deriva al asesor.
   */
  pesoMaxContenedorKg: 27000,

  /**
   * Tope de peso POR ENVÍO (kg). Sobre esto la calculadora NO auto-cotiza:
   * deriva al asesor. Evita que un solo envío monopolice el peso del contenedor
   * (ej. 27.000 kg en 27 CBM llena el peso con 40% del volumen → nadie más entra
   * y la cotización por volumen iría a pérdida). ⅓ de 27.000 → garantiza ≥3
   * clientes por consolidado. Configurable desde Admin › Calculadora pública.
   */
  pesoMaxEnvioKg: 9000,
} as const;

// ────────────────────────────────────────────────────────────────────
// 1a) LCL CONSOLIDADO — TARIFA BASE (hasta puerto, con BL propio)
// ────────────────────────────────────────────────────────────────────

/**
 * Tarifa base por CBM (USD) de la modalidad **LCL Consolidado** — la carga
 * viaja consolidada hasta puerto en Venezuela y te entregamos tu propio Bill
 * of Lading (la aduana e impuestos corren por cuenta del cliente).
 *
 * ⚠️ DATO DEL FOUNDER (2026-07-20). Es una CONSTANTE, no viene de la DB.
 *    La tarifa puerta a puerta (DDP) sí es configurable: vive en `rates`
 *    (`is_public`) y llega por la RPC anon `public_cbm_rate`.
 *
 *    La migración que abre lo mismo para ESTA tarifa ya está escrita:
 *    `supabase/migrations/0255_rates_public_calc_modo.sql` — agrega
 *    `rates.public_calc_modo` ('ddp' | 'consolidado'), abre el singleton de
 *    `is_public` a una tarifa pública POR MODALIDAD, pasa la RPC a
 *    `public_cbm_rate(p_modo default 'ddp')` y siembra la fila del consolidado
 *    en 580. **Todavía NO está aplicada a producción** (declarada como espera
 *    en `supabase/migrations-baseline.json`): aplicarla exige el OK del founder
 *    nombrando el archivo, por `docs/runbooks/aplicar-migraciones-prod.md`.
 *
 *    Para cerrar el ciclo, DESPUÉS de aplicarla: (1) `getPublicCbmRate()` en
 *    `lib/public/rates-queries.ts` recibe la modalidad y llama la RPC con
 *    `{ p_modo: "consolidado" }`; (2) `components/CalculadoraForm.tsx` usa esa
 *    tarifa cuando `esConsolidado`, con esta constante como fallback (mismo
 *    patrón que el DDP: si la RPC devuelve null, cero regresión).
 *    Mientras eso no pase, se cambia acá.
 *    NO inventar otra fuente ni reusar la tarifa DDP.
 */
export const CONSOLIDADO_CBM_RATE = 580;

/**
 * Destino sintético del LCL Consolidado. El servicio llega **hasta puerto** en
 * Venezuela, así que NO hay selector de ciudad ni recargo por distancia: se le
 * pasa a `calcularEnvioLCL` una lista de una sola "ciudad" en casco (km 0) →
 * `recargoCiudad = 0` y `descuentoSede = 0`, sin tocar el motor de cálculo.
 */
export const CONSOLIDADO_DESTINO: Ciudad = {
  id: "puerto-ve",
  label: "Puerto en Venezuela",
  km: 0,
  casco: true,
};

/**
 * Modalidad que se está cotizando. Afecta SOLO la puerta de volumen de abajo:
 * el resto de las reglas y recargos son idénticos en las dos.
 *  · `ddp`          = Puerta a Puerta, todo incluido hasta la puerta.
 *  · `consolidado`  = LCL Consolidado, hasta puerto y con BL propio del cliente.
 */
export type CalcModo = "ddp" | "consolidado";

/**
 * ⚠️ PUERTA DE VOLUMEN DEL CONSOLIDADO — regla del founder (2026-07-20).
 *
 * Por debajo de **1 m³** el LCL Consolidado NO se cotiza: la calculadora no
 * muestra precio y deriva al asesor. El porqué (que es lo que hay que entender
 * antes de tocar este número):
 *
 *  · El consolidado va hasta puerto **con BL propio del cliente**. Un BL aparte
 *    es un GASTO FIJO que no baja con el volumen: puede llegar a costar
 *    USD 300. En 0,5 m³ ese fijo se come el envío entero.
 *  · Por eso la mercancía chica en esta modalidad es candidata a quedar
 *    **abandonada en el almacén fiscal** cuando el cliente ve la cuenta final —
 *    y eso es un riesgo real (y un costo) para DTD, no solo un mal negocio
 *    para el cliente.
 *
 * Excepción: mercancía de muy alto valor comercial, bajo el riesgo del cliente.
 * Eso lo evalúa un ASESOR, no la calculadora — por eso el corte deriva a
 * WhatsApp en vez de cotizar.
 *
 * 🔶 PENDIENTE LEGAL: el tratamiento de esta exención (condiciones del
 *    Consolidado, cómo se documenta la aceptación de riesgo del cliente cuando
 *    se cotiza por debajo de 1 m³) **está sin definir**. Cuando el abogado lo
 *    cierre, esto se refleja en las condiciones publicadas del servicio.
 *
 * No hay piso en USD: con el corte en 1 m³ el mínimo cobrable del consolidado
 * es 1 × 580 = $580, muy por encima de cualquier piso — por eso el viejo
 * `consolidadoMinCharge()` se eliminó (era código muerto).
 */
export const CONSOLIDADO_CBM_MINIMO = 1;

/** Tope de lo que puede costar el BL propio del cliente (USD) — cifra del founder. */
export const CONSOLIDADO_BL_COSTO_MAX = 300;

/** Mensaje único del corte: explica el porqué y deriva al asesor. */
export const CONSOLIDADO_MIN_CBM_MENSAJE =
  `Esta modalidad requiere un BL a tu nombre, y solo el BL puede llegar a ` +
  `costar USD ${CONSOLIDADO_BL_COSTO_MAX}. Por debajo de ` +
  `${CONSOLIDADO_CBM_MINIMO} m³ ese gasto fijo se come tu margen. Si tu ` +
  `mercancía es de alto valor comercial y aun así te conviene, háblalo con un asesor.`;

// ────────────────────────────────────────────────────────────────────
// 1b) PARÁMETROS CONFIGURABLES DESDE EL STUDIO (Fase 3 Slice A)
//     Las reglas escalares del calculador pueden venir de la DB
//     (/studio/tarifas › Parámetros → tabla calculator_settings). El cálculo
//     recibe un `CalcParams`; si no se provee, usa DEFAULT_PARAMS (= CONFIG),
//     así nada se rompe cuando no hay config en la DB (cero regresión).
//
//     OJO: la tarifa base por CBM y el piso mínimo NO están acá — viajan por
//     `EnvioInput.tarifaCBMOverride` / `minChargeOverride` (los alimenta
//     rates.is_public, Fase 2). CalcParams son solo las REGLAS.
// ────────────────────────────────────────────────────────────────────

export type CalcParams = {
  pesoIncluidoKg: number;
  recargoExcedenteKg: number;
  descuentoValencia: number;
  recargoEmbalajeEspecial: number;
  recargoBateriaMult: number;
  thresholdCascoKm: number;
  tarifaKmFueraCasco: number;
  /** CBM total máximo cotizable (LCL). Sobre esto → deriva al asesor (FCL). */
  cbmMaxContenedor: number;
  /** Peso total máximo cotizable (kg). Sobre esto → deriva al asesor. */
  pesoMaxContenedorKg: number;
  /** Tope de peso POR ENVÍO (kg). Sobre esto → deriva al asesor (anti-monopolio). */
  pesoMaxEnvioKg: number;
};

/** Defaults = los valores históricos de CONFIG. Fallback cuando no hay config en DB. */
export const DEFAULT_PARAMS: CalcParams = {
  pesoIncluidoKg: CONFIG.pesoIncluidoKg,
  recargoExcedenteKg: CONFIG.recargoExcedenteKg,
  descuentoValencia: CONFIG.descuentoValencia,
  recargoEmbalajeEspecial: CONFIG.recargoEmbalajeEspecial,
  recargoBateriaMult: CONFIG.recargoBateriaMult,
  thresholdCascoKm: CONFIG.thresholdCascoKm,
  tarifaKmFueraCasco: CONFIG.tarifaKmFueraCasco,
  cbmMaxContenedor: CONFIG.cbmMaxContenedor,
  pesoMaxContenedorKg: CONFIG.pesoMaxContenedorKg,
  pesoMaxEnvioKg: CONFIG.pesoMaxEnvioKg,
};

// ────────────────────────────────────────────────────────────────────
// 2) CIUDADES DE VENEZUELA — KM DESDE VALENCIA CENTRO
//    👉 Edita / agrega ciudades acá. Los `km` se usan para calcular el
//       recargo por distancia. `casco: true` = entrega flat sin recargo
//       extra por km (Valencia, Maracay, Caracas son casco por default).
// ────────────────────────────────────────────────────────────────────

export type Ciudad = {
  /** Slug interno (sin espacios). */
  id: string;
  /** Nombre visible en el form. */
  label: string;
  /**
   * Km desde Valencia centro.
   *
   * ⚠️ Ya NO fija precio (SDD-0237). Sigue vivo porque alimenta el copy de
   * `lib/geo-zonas.ts` ("a 410 km de nuestra bodega") y porque la columna
   * existe en `calculator_cities`.
   */
  km: number;
  /**
   * Zona sin costo: el cliente paga **$0** de entrega.
   *
   * Son 8 ciudades (founder, 1-ago-2026). DTD sí le paga ese tramo al fletero;
   * es adquisición de clientes, no un descuento — por eso la tarifa real vive
   * igual en `carrier_tariffs` y sólo esta bandera la pone en cero de cara al
   * cliente.
   */
  casco: boolean;
  /**
   * USD por m³ que paga el cliente por la entrega nacional. `null`/ausente =
   * no hay tarifa confirmada → la calculadora deriva al asesor en vez de
   * inventar un número que no podemos honrar.
   */
  ventaCbm?: number | null;
  /** Piso por despacho, si el transportista lo exige. Benito no tiene. */
  minCharge?: number | null;
  /** Cada cuántos días sale el camión. >8 → se le avisa al cliente. */
  frecuenciaDias?: number | null;
  /** `false` = el transportista confirmó que NO llega hasta ahí. */
  cubierta?: boolean;
  /** Sólo para las sin cobertura: slug de la cubierta más cercana. */
  cercana?: string | null;
  /** Estado de Venezuela — resuelve la ciudad que el cliente no encontró. */
  estado?: string;
};

/**
 * Km desde Valencia de los destinos que ya estaban en producción.
 *
 * El km dejó de fijar precio (SDD-0237), pero se conserva porque el copy de
 * `lib/geo-zonas.ts` lo cita ("a 410 km de nuestra bodega") y porque la
 * columna sigue viva en `calculator_cities`. Los destinos nuevos entran con 0:
 * nadie midió su distancia y ya no hace falta.
 */
const KM_CONOCIDOS: Record<string, number> = {
  valencia: 0, maracay: 70, caracas: 150, barquisimeto: 220, maracaibo: 410,
  "puerto-la-cruz": 430, "san-cristobal": 580, merida: 520,
  "ciudad-bolivar": 700, "puerto-ordaz": 770, "punto-fijo": 290, coro: 260,
  acarigua: 175, valera: 360, "san-fernando": 370, cumana: 560, maturin: 650,
  margarita: 540,
};

/**
 * Los destinos que ofrece la calculadora — **fallback**, no fuente de verdad.
 *
 * La fuente real es `calculator_cities` + `carrier_tariffs` en la DB, que el
 * sitio lee por RPC anon. Este array se usa cuando la RPC no devuelve nada
 * (Supabase caído, tablas vacías, migración sin aplicar): mismo patrón que ya
 * tenía la lista de ciudades, ahora con el precio de entrega adentro.
 *
 * ⚠️ La opción agrupada "Casco central (Valencia · Maracay · Caracas)" **murió**
 * (founder, 1-ago-2026): el cliente escoge SU ciudad y el sistema decide si le
 * cobra o no. Al no estar, la preseleccionada cae sola a la primera de la lista.
 */
export const CIUDADES: Ciudad[] = DESTINOS_NACIONALES.map((d) => ({
  id: d.slug,
  label: d.label,
  km: KM_CONOCIDOS[d.slug] ?? 0,
  casco: d.casco,
  ventaCbm: d.ventaCbm,
  minCharge: null,
  frecuenciaDias: d.frecuenciaDias,
  cubierta: d.cubierta,
  cercana: d.cercana,
  estado: d.estado,
}));

/**
 * Destinos que NO cotizan automático y derivan al asesor, además de los que ya
 * derivan por no tener tarifa.
 *
 * **Vacío desde el 1-ago-2026 (SDD-0237).** Tenía `cumana` y `san-fernando`
 * porque ningún proveedor confirmado les ponía precio; ahora las dos cobran
 * $123,60/m³ como cualquier destino foráneo, así que salieron.
 *
 * La lista se queda como palanca manual: si mañana hay que sacar un destino de
 * la cotización automática sin borrarle la tarifa, se mete el slug acá. El
 * mecanismo general de "sin precio → deriva" ya no depende de esta lista.
 */
export const CIUDADES_DERIVAN_A_ASESOR: readonly string[] = [];

// ────────────────────────────────────────────────────────────────────
// 3) EMBALAJES — RECARGOS POR TIPO
// ────────────────────────────────────────────────────────────────────

export type TipoEmbalaje = "estandar" | "especial";

export const EMBALAJES: { id: TipoEmbalaje; label: string; recargo: number }[] = [
  { id: "estandar", label: "Caja estándar",                recargo: 0 },
  { id: "especial", label: "Caja especial (madera o paleta)", recargo: CONFIG.recargoEmbalajeEspecial },
];

// ────────────────────────────────────────────────────────────────────
// 4) TYPES DEL INPUT/OUTPUT DE LA CALCULADORA
// ────────────────────────────────────────────────────────────────────

export type EnvioInput = {
  /**
   * Modalidad cotizada. Default `ddp` = comportamiento histórico intacto.
   * En `consolidado` se activa la puerta de volumen de 1 m³
   * (`CONSOLIDADO_CBM_MINIMO`) — ver el bloque 1a.
   */
  modo?: CalcModo;
  /** Volumen total del envío en m³ (CBM). El cliente ya lo conoce. */
  cbmTotal: number;
  /**
   * Peso total de toda la carga en kg. **Opcional (SDD-0257).**
   *
   * `0`, `null` y `undefined` significan todos lo mismo: **el cliente no indicó
   * el peso**. No se distinguen a propósito — el `DecimalInput` de la UI
   * devuelve `0` cuando el campo se borra, así que no hay forma de separarlos ni
   * motivo para hacerlo.
   *
   * Sin peso la cotización SIGUE saliendo: el peso sólo entra al precio por el
   * recargo por densidad (5.6) y por los dos topes que derivan al asesor (5.3b y
   * 5.4b). Sin él, esos tres no aplican y el total que sale es el **piso real**
   * de esa carga — exacto para cualquier envío de hasta `pesoMaxSinRecargo()`
   * kg. La cotización lo marca con `sinPeso: true` para que la UI no lo venda
   * como precio final.
   */
  pesoKg?: number | null;
  /** Tipo de embalaje (afecta recargo). */
  embalaje: TipoEmbalaje;
  /** Ciudad de destino en Venezuela (slug de CIUDADES). */
  ciudadId: string;
  /** La carga lleva baterías (multiplica el flete por `recargoBateriaMult`). */
  bateria?: boolean;
  /** Carga peligrosa / que requiere permisos especiales → no cotiza, deriva al asesor. */
  cargaEspecial?: boolean;
  /**
   * Override de la tarifa base por CBM (USD).
   * Si no se provee, se usa `CONFIG.tarifaBaseCBM` (hoy $850).
   * Útil cuando el cliente tiene una cotización negociada distinta a la pública.
   */
  tarifaCBMOverride?: number;
  /**
   * Override del piso mínimo cobrable (USD). Lo alimenta la tarifa pública
   * real (`rates.min_charge` = mínimo LCL comercial) desde el server.
   * Si no se provee (o es <= 0), se usa `CONFIG.minimoFacturable` (piso trivial).
   */
  minChargeOverride?: number;
};

export type EnvioCotizacion = {
  /** Volumen total en m³ (CBM). */
  cbm: number;
  /** Densidad calculada (peso/CBM). `0` cuando no se indicó el peso. */
  densidadKgM3: number;

  /**
   * El cliente NO indicó el peso y el precio se calculó igual (SDD-0257).
   *
   * El total es el **piso real** de esa carga, no un promedio: es exacto para
   * cualquier envío de hasta `pesoMaxSinRecargoKg`. La UI tiene que decirlo
   * ("desde") en vez de venderlo como precio cerrado.
   */
  sinPeso: boolean;

  /**
   * Hasta cuántos kg vale el precio de arriba. Sólo se llena cuando
   * `sinPeso` es true — es el número que sostiene el "desde".
   */
  pesoMaxSinRecargoKg: number;

  /** Cargos individuales (todos en USD, para mostrar desglose). */
  precioBase: number;       // CBM × tarifaBase
  recargoExcedente: number; // recargo por densidad: kg que exceden pesoIncluidoKg/CBM × recargoExcedenteKg (founder 2026-06-20).
  recargoCiudad: number;    // entrega nacional: CBM × precio del tramo. 0 en la zona sin costo.
  recargoEmbalaje: number;  // 0 o recargoEmbalajeEspecial
  recargoBateria: number;   // extra por el multiplicador de baterías (0 si no)
  descuentoSede: number;    // siempre negativo o 0
  ajusteMinimo: number;     // ≥0 · cuánto sumó el piso mínimo (para que el desglose reconcilie)
  total: number;            // suma final, piso = min_charge real o CONFIG.minimoFacturable

  /** Si hay algún problema/alerta para mostrar al usuario. */
  alerta?: {
    tipo:
      | "peso_excedido"
      | "carga_invalida"
      | "ciudad_invalida"
      | "carga_especial"
      | "contenedor_excedido"
      | "peso_contenedor_excedido"
      | "peso_envio_excedido"
      | "volumen_minimo_consolidado"
      | "ciudad_sin_tarifa"
      | "ciudad_sin_cobertura";
    mensaje: string;
  };

  /**
   * Aviso que NO bloquea la cotización: hay precio y el cliente lo ve, pero
   * tiene que enterarse de algo antes de pagar. Hoy sólo lo usa el destino
   * quincenal ("el camión no sale todas las semanas").
   */
  avisoEntrega?: string | null;

  /**
   * La ciudad cubierta más cercana, cuando el destino escogido no tiene
   * cobertura. Es lo que convierte un "no llegamos" en una venta: el cliente
   * ve hasta dónde sí llegamos y cuánto cuesta ese tramo.
   */
  cercana?: { label: string; ventaCbm: number } | null;

  /** Datos derivados para mostrar al usuario. */
  ciudad: Ciudad | null;
  embalaje: TipoEmbalaje;
};

/**
 * ¿Este destino tarda notablemente más que el resto?
 *
 * El umbral es 8 días y no 15 a propósito: cualquier cosa que salga menos de
 * una vez por semana ya merece el aviso. Espeja `tardaMasDeLoNormal` de
 * `lib/studio/freight-carriers/types.ts` — el ERP y la web dicen lo mismo.
 */
export function entregaTardaMas(frecuenciaDias: number | null | undefined): boolean {
  return frecuenciaDias != null && frecuenciaDias > 8;
}

/**
 * Los tres estados en que puede estar un destino:
 *
 *  · `cubierta`      — llegamos y hay precio. Cotiza sola.
 *  · `sin_cobertura` — el transportista confirmó que NO llega hasta ahí. Es lo
 *                      que se le muestra al cliente junto con la ciudad vecina.
 *  · `sin_tarifa`    — llegamos (o no lo sabemos), pero nadie confirmó un
 *                      precio. Deriva al asesor en vez de inventar un número.
 */
export type CoberturaDestino = "cubierta" | "sin_cobertura" | "sin_tarifa";

/**
 * Clasifica un destino en uno de los tres estados de arriba.
 *
 * ⚠️ Espeja las reglas que aplica `calcularEnvioLCL` (pasos 5.2b, 5.2c y 5.7),
 * EN EL MISMO ORDEN — existe para que la UI pueda pintar el estado de cada
 * destino sin re-derivar la regla y sin necesitar una carga válida (el motor
 * exige CBM y peso antes de llegar al paso 5.7, así que preguntarle a él
 * mientras el formulario está vacío devuelve `carga_invalida`, no el estado del
 * destino).
 *
 * Que las dos no se separen NO depende de la buena voluntad: el test
 * `__tests__/calculadora-cobertura.test.ts` recorre los 178 destinos reales y
 * falla si esta función y el motor dicen cosas distintas.
 */
/**
 * Copy del destino que no tiene precio confirmado. Vive acá —y no suelto en la
 * UI— porque el motor lo usa en dos ramas (5.2b y 5.7) y el formulario lo
 * necesita ANTES de que haya carga válida, para avisar apenas eliges la ciudad.
 */
export function mensajeDestinoSinTarifa(label: string): string {
  return (
    `Para ${label} cotizamos a medida: escríbele a un asesor y te damos el ` +
    `precio exacto de tu envío.`
  );
}

/**
 * Copy del destino al que el transportista NO llega.
 *
 * No dice "no disponible" a secas: dice hasta dónde SÍ llegamos y cuánto cuesta
 * ese tramo, porque ese mensaje es lo que convierte un "no" en una venta. El
 * último trecho lo resuelve el cliente o lo conversa con un asesor.
 */
export function mensajeDestinoSinCobertura(
  label: string,
  vecina: { label: string; ventaCbm: number } | null,
): string {
  if (!vecina) {
    return (
      `Todavía no llegamos hasta ${label}. Escríbele a un asesor y buscamos ` +
      `cómo hacerte llegar la carga.`
    );
  }
  return (
    `Todavía no llegamos hasta ${label}. Lo más cerca que entregamos es ` +
    `${vecina.label}, y ese tramo sale en $${vecina.ventaCbm.toFixed(2)} por ` +
    `m³ — es un estimado, el último trecho hasta ${label} no está incluido. ` +
    `Un asesor te ayuda a resolverlo.`
  );
}

/**
 * La ciudad cubierta más cercana a un destino sin cobertura, con su precio.
 * `null` si el destino no declara vecina o si la vecina no tiene tarifa (no
 * sirve de nada mostrar un "lo más cerca es X" sin poder decir cuánto sale).
 */
export function vecinaDeDestino(
  ciudad: Ciudad,
  ciudades: Ciudad[],
): { label: string; ventaCbm: number } | null {
  const vecina = ciudad.cercana
    ? (ciudades.find((c) => c.id === ciudad.cercana) ?? null)
    : null;
  if (!vecina || vecina.ventaCbm == null || vecina.ventaCbm <= 0) return null;
  return { label: vecina.label, ventaCbm: vecina.ventaCbm };
}

export function coberturaDestino(ciudad: Ciudad): CoberturaDestino {
  // Palanca manual: sacar un destino de la cotización automática sin borrarle
  // la tarifa. Va primero porque en el motor también va primero (5.2b).
  if (CIUDADES_DERIVAN_A_ASESOR.includes(ciudad.id)) return "sin_tarifa";
  if (ciudad.cubierta === false) return "sin_cobertura";
  // Zona sin costo: el cliente paga $0, así que no necesita tarifa para cotizar.
  if (ciudad.casco) return "cubierta";
  const venta = ciudad.ventaCbm;
  if (venta == null || venta <= 0) return "sin_tarifa";
  return "cubierta";
}

// ────────────────────────────────────────────────────────────────────
// 4b) EL ESTIMADO SIN PESO (SDD-0257) — hasta cuándo vale el precio
// ────────────────────────────────────────────────────────────────────

/**
 * El peso máximo (kg) hasta el cual el precio calculado SIN peso sigue siendo
 * exacto. Arriba de este número el envío o suma recargo o deriva al asesor.
 *
 * ⚠️ ES EL NÚMERO QUE SOSTIENE EL "DESDE $X" DE LA UI. Si miente, la
 * calculadora promete un precio que la operación no honra, y el reclamo llega
 * cuando la carga ya está en Yiwu. Por eso vive acá, junto a las reglas que
 * espeja, y no suelto en el componente: mismo criterio que
 * `mensajeDestinoSinTarifa`.
 *
 * Tiene que cumplir DOS condiciones a la vez, no una:
 *
 *  1. **No sumar recargo** → `peso ≤ cbm × pesoIncluidoKg` (topeado en
 *     `pesoMaxContenedorKg`, que es el límite físico del contenedor).
 *  2. **Seguir auto-cotizando** → no caer en el anti-monopolio del paso 5.4b,
 *     que deriva al asesor cuando el envío es pesado (`> pesoMaxEnvioKg`) Y
 *     denso (por encima del equilibrio `pesoMaxContenedorKg/cbmMaxContenedor`).
 *
 * Olvidar la segunda es el error fácil, y da un techo optimista: en 12 m³ la
 * cuenta ingenua diría 12.000 kg, pero 12.000 kg en 12 m³ son 1.000 kg/m³ —muy
 * por encima del equilibrio de ~397— y con más de 9.000 kg eso ya deriva al
 * asesor. El techo real ahí son 9.000 kg.
 *
 * Comprobado: 5 m³ → 5.000 kg · 12 m³ → 9.000 kg · 30 m³ → 11.912 kg.
 */
export function pesoMaxSinRecargo(cbm: number, params: CalcParams): number {
  if (!Number.isFinite(cbm) || cbm <= 0) return 0;
  const sinRecargo = Math.min(
    cbm * params.pesoIncluidoKg,
    params.pesoMaxContenedorKg,
  );
  // Por debajo del tope por envío el anti-monopolio no puede activarse (exige
  // las DOS cosas), así que el techo es el del recargo y punto.
  if (sinRecargo <= params.pesoMaxEnvioKg) return round(sinRecargo);
  const equilibrio =
    params.cbmMaxContenedor > 0
      ? params.pesoMaxContenedorKg / params.cbmMaxContenedor
      : Infinity;
  // Arriba del tope por envío hace falta quedarse bajo el equilibrio de
  // densidad; `pesoMaxEnvioKg` es piso porque hasta ahí nunca deriva.
  return round(
    Math.max(params.pesoMaxEnvioKg, Math.min(sinRecargo, cbm * equilibrio)),
  );
}

/**
 * Copy del estimado sin peso. Vive acá —y no en el componente— porque el mismo
 * texto lo usan el panel de resultado y el mensaje de WhatsApp que le llega al
 * asesor: si se escribieran por separado, un día dirían techos distintos.
 */
export function mensajeEstimadoSinPeso(pesoMaxKg: number): string {
  return (
    `Este precio vale si tu carga pesa hasta ` +
    `${kg(pesoMaxKg)}. Si pesa más, suma un ajuste por el peso extra.`
  );
}

/**
 * La versión corta, para el aviso bajo el campo de peso.
 *
 * Son dos textos y no uno porque están a diez centímetros de distancia en la
 * misma pantalla: repetir la frase completa al lado del precio se lee como un
 * error de la página, no como énfasis. El campo empuja ("falta esto"), el panel
 * explica ("y esto significa").
 */
export function avisoCampoPesoVacio(pesoMaxKg: number): string {
  return `Falta el peso. Te damos el precio base, válido hasta ${kg(pesoMaxKg)}.`;
}

/**
 * Kilos con separador de miles a la venezolana: `9000` → "9.000 kg".
 *
 * El punto se pone a mano y no con `toLocaleString("es-VE")` a propósito: el
 * formato de `Intl` depende de los datos ICU del runtime, y este texto lo
 * comparan tests por igualdad exacta. Un build de Node sin ICU completo lo
 * pondría en rojo por algo que no es el cálculo.
 */
function kg(n: number): string {
  return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} kg`;
}

// ────────────────────────────────────────────────────────────────────
// 5) FUNCIÓN PRINCIPAL DEL CÁLCULO (pura, sin side effects)
// ────────────────────────────────────────────────────────────────────

/**
 * Calcula la cotización de un envío LCL DDP de China a Venezuela.
 *
 * Toda la lógica de pricing vive en CONFIG + CIUDADES. Esta función
 * solo aplica las reglas; no hace fetch, no toca DOM, no muta estado.
 * 100% testeable.
 *
 * `params` (reglas escalares) y `ciudades` (lista de destinos) llegan como
 * args con default (DEFAULT_PARAMS / CIUDADES): el sitio público les inyecta
 * lo de la DB (calculator_settings / calculator_cities) o cae a los defaults
 * hardcodeados — cero regresión cuando no hay config.
 */
export function calcularEnvioLCL(
  input: EnvioInput,
  params: CalcParams = DEFAULT_PARAMS,
  ciudades: Ciudad[] = CIUDADES,
): EnvioCotizacion {
  // 5.0 — Peso normalizado (SDD-0257). `0`, `null`, `undefined` y cualquier cosa
  // que no sea un número finito positivo son LO MISMO: el cliente no indicó el
  // peso. A partir de acá `pesoKg` es un número y `sinPeso` dice si es real.
  const pesoKg = normalizarPeso(input.pesoKg);
  const sinPeso = pesoKg <= 0;

  // 5.1 — Carga especial / peligrosa → no cotiza, deriva al asesor
  if (input.cargaEspecial) {
    return cotizacionVacia({
      tipo: "carga_especial",
      mensaje:
        "Para carga especial, peligrosa o que requiere permisos de exportación, " +
        "consulta con tu asesor — la cotizamos a medida.",
    }, input);
  }

  // 5.2 — Validar destino. La lista de ciudades llega como 3er arg (Fase 3
  // Slice B): el sitio le inyecta las de la DB (calculator_cities) o, si no hay,
  // el array CIUDADES por default → cero regresión y función pura testeable.
  const ciudad = ciudades.find((c) => c.id === input.ciudadId) ?? null;
  if (!ciudad) {
    return cotizacionVacia({
      tipo: "ciudad_invalida",
      mensaje: "Selecciona una ciudad válida de destino en Venezuela.",
    }, input);
  }

  // 5.2b — Destino sin tarifa de proveedor confirmada → deriva al asesor en vez
  // de dar un número que no podemos honrar (founder 2026-07-29). Va DESPUÉS de
  // validar la ciudad porque el mensaje usa su label.
  // Nota: la UI solo pinta la alerta con carga válida (`hasAlerta = !!cot.alerta
  // && tieneCarga` en CalculadoraForm), así que el cliente ve el estado vacío
  // hasta que llene CBM y peso — igual que las demás alertas. Chequear acá igual
  // mantiene la función pura y testeable sin depender del orden de validaciones.
  if (CIUDADES_DERIVAN_A_ASESOR.includes(ciudad.id)) {
    return cotizacionVacia({
      tipo: "ciudad_sin_tarifa",
      mensaje: mensajeDestinoSinTarifa(ciudad.label),
    }, input);
  }

  // 5.2c — Destino SIN COBERTURA (SDD-0237). El transportista confirmó que no
  // llega hasta ahí. El copy no dice "no disponible" a secas: dice hasta dónde
  // SÍ llegamos y cuánto cuesta ese tramo, porque ese mensaje es lo que
  // convierte un "no" en una venta. El último trecho lo resuelve el cliente o
  // lo conversa con un asesor.
  if (ciudad.cubierta === false) {
    const vecina = vecinaDeDestino(ciudad, ciudades);
    return {
      ...cotizacionVacia(
        {
          tipo: "ciudad_sin_cobertura",
          mensaje: mensajeDestinoSinCobertura(ciudad.label, vecina),
        },
        input,
      ),
      cercana: vecina,
    };
  }

  // 5.3 — Validar carga. **Sólo el CBM (SDD-0257.)** El peso dejó de ser
  // obligatorio: es el dato que el cliente más se olvida, y exigirlo dejaba la
  // calculadora sin mostrar NADA —ni precio, ni desglose, ni botón— cuando ya
  // había suficiente para cotizar. El CBM sí sigue siendo obligatorio: es el que
  // fija el precio, sin él no hay cuenta que hacer.
  if (input.cbmTotal <= 0) {
    return cotizacionVacia({
      tipo: "carga_invalida",
      mensaje: "Indica el CBM total de tu carga para ver el estimado.",
    }, input);
  }

  // 5.3b — Límites absolutos de un contenedor. Sobre esto la carga ya no es LCL
  // → deriva al asesor (FCL). El CBM prima sobre el peso si ambos exceden.
  if (input.cbmTotal > params.cbmMaxContenedor) {
    return cotizacionVacia({
      tipo: "contenedor_excedido",
      mensaje: "Eso es más que un contenedor. Consulta a tu asesor",
    }, input);
  }
  if (pesoKg > params.pesoMaxContenedorKg) {
    return cotizacionVacia({
      tipo: "peso_contenedor_excedido",
      mensaje:
        "Esto es más que el peso permitido por contenedor; consulta a tu asesor",
    }, input);
  }

  // 5.3c — Puerta de volumen del LCL Consolidado (founder 2026-07-20). Por
  // debajo de 1 m³ NO se cotiza: el BL propio es un gasto fijo (hasta USD 300)
  // que no baja con el volumen, y la carga chica en esta modalidad termina
  // abandonada en el almacén fiscal. La excepción (alto valor comercial, bajo
  // el riesgo del cliente) la evalúa un asesor. Detalle en el bloque 1a.
  if (
    input.modo === "consolidado" &&
    roundCBM(input.cbmTotal) < CONSOLIDADO_CBM_MINIMO
  ) {
    return cotizacionVacia({
      tipo: "volumen_minimo_consolidado",
      mensaje: CONSOLIDADO_MIN_CBM_MENSAJE,
    }, input);
  }

  // 5.4 — Volumen (CBM) y densidad (peso/CBM). La densidad alimenta el recargo
  // por exceso de peso en 5.6 y el tope de peso por envío en 5.4b.
  const cbm = roundCBM(input.cbmTotal);
  // Sin peso no hay densidad que calcular (SDD-0257): queda en 0 y ni el recargo
  // de 5.6 ni el tope de 5.4b pueden activarse.
  const densidadKgM3 = sinPeso ? 0 : pesoKg / cbm;

  // 5.4b — Tope de peso POR ENVÍO (anti-monopolio), density-aware. Deriva al
  // asesor SOLO si el envío es pesado (> pesoMaxEnvioKg) Y denso (densidad por
  // encima del equilibrio del contenedor = pesoMaxContenedorKg/cbmMaxContenedor,
  // ~397 kg/m³). Ese es el caso real de monopolio: agota el presupuesto de peso
  // dejando volumen sin vender → cotizar por volumen iría a pérdida. Un envío
  // pesado pero LIVIANO (denso < equilibrio) sí auto-cotiza: no monopoliza el peso.
  const equilibrioDensidad =
    params.cbmMaxContenedor > 0
      ? params.pesoMaxContenedorKg / params.cbmMaxContenedor
      : Infinity;
  if (pesoKg > params.pesoMaxEnvioKg && densidadKgM3 > equilibrioDensidad) {
    return cotizacionVacia({
      tipo: "peso_envio_excedido",
      mensaje:
        "Por el peso de esta carga la cotizamos a medida. Escríbele a tu asesor y " +
        "te damos el mejor precio para el consolidado.",
    }, input);
  }

  // 5.5 — Precio base por volumen
  // Si el usuario provee `tarifaCBMOverride`, se usa ese valor (debe ser >0).
  // Si no, fallback a CONFIG.tarifaBaseCBM.
  const tarifaCBM =
    input.tarifaCBMOverride && input.tarifaCBMOverride > 0
      ? input.tarifaCBMOverride
      : CONFIG.tarifaBaseCBM;
  const precioBase = cbm * tarifaCBM;

  // 5.6 — Recargo por exceso de densidad (peso por CBM). Founder 2026-06-20: se
  // REACTIVA (revierte la pausa del 2026-06-08). Se cobra sobre el peso que excede
  // `pesoIncluidoKg` por CBM, a `recargoExcedenteKg` por kg — todo configurable
  // desde el ERP (params.* ← calculator_settings · Admin › Calculadora pública).
  // Founder 2026-07-06: el recargo es CONTINUO sin tope (el viejo `pesoMaxKg` que
  // derivaba a FCL se eliminó en 2026-07-06). Acá NUNCA seteamos `alerta` por
  // densidad: el cliente debe VER el precio con el recargo aplicado.
  // Sin peso indicado (SDD-0257) el recargo es 0 y el total queda en el PISO de
  // esa carga — exacto hasta `pesoMaxSinRecargo()`. No se estima ni se promedia.
  let recargoExcedente = 0;
  if (!sinPeso && densidadKgM3 > params.pesoIncluidoKg) {
    const kgExcedente = Math.max(0, pesoKg - cbm * params.pesoIncluidoKg);
    recargoExcedente = roundUSD(kgExcedente * params.recargoExcedenteKg);
  }
  const alerta: EnvioCotizacion["alerta"] | undefined = undefined;

  // 5.7 — ENTREGA NACIONAL: CBM × precio del tramo (SDD-0237).
  //
  // Reemplaza `max(0, km − 200) × $1`, que no correspondía a ningún modelo real
  // (sobrecobraba +706% en Puerto Ordaz a 0,5 m³ y subcobraba en Barquisimeto).
  // El transportista cobra por metro cúbico y punto: sin kilómetros, sin peso,
  // sin valor declarado.
  //
  // Las 8 ciudades de la ZONA SIN COSTO salen en $0 por el flag `casco`. No es
  // un descuento: DTD le paga ese tramo al fletero aparte y lo asume como
  // adquisición de clientes. La tarifa real de esas ciudades sigue viva en
  // `carrier_tariffs` para que el ERP no pierda de vista lo que cuesta.
  //
  // Sin tarifa → NO se inventa un número: deriva al asesor. Es el fallback que
  // protege el caso "la RPC no devolvió filas".
  let recargoCiudad = 0;
  if (!ciudad.casco) {
    const precioCbm = ciudad.ventaCbm;
    if (precioCbm == null || precioCbm <= 0) {
      return cotizacionVacia({
        tipo: "ciudad_sin_tarifa",
        mensaje: mensajeDestinoSinTarifa(ciudad.label),
      }, input);
    }
    const piso = ciudad.minCharge != null && ciudad.minCharge > 0 ? ciudad.minCharge : 0;
    recargoCiudad = roundUSD(Math.max(cbm * precioCbm, piso));
  }

  // 5.7b — Aviso de demora. No bloquea: el cliente ve su precio igual, pero se
  // entera ANTES de pagar de que ese camión no sale todas las semanas.
  const avisoEntrega = entregaTardaMas(ciudad.frecuenciaDias)
    ? `El camión a ${ciudad.label} no sale todas las semanas. Según el día en ` +
      `que tu carga llegue a nuestro galpón, la entrega puede tardar hasta una ` +
      `semana más que a otros destinos. Te avisamos la fecha exacta de ` +
      `despacho apenas se confirme.`
    : null;

  // 5.8 — Recargo por embalaje (especial = madera/paleta). Se computa desde
  // params (configurable), no desde EMBALAJES (que solo aporta labels al form).
  const recargoEmbalaje =
    input.embalaje === "especial" ? params.recargoEmbalajeEspecial : 0;

  // 5.9 — Flete antes de baterías (base + todos los recargos). `recargoExcedente`
  // vuelve a cobrarse desde 2026-06-20 (ver 5.6); el comentario que decía "es 0
  // siempre" quedó de la pausa del 2026-06-08 y ya no aplica.
  const fleteAntesBateria =
    precioBase + recargoExcedente + recargoCiudad + recargoEmbalaje;

  // 5.10 — Multiplicador por baterías (sobre el flete, antes del descuento)
  const fleteConBateria = input.bateria
    ? fleteAntesBateria * params.recargoBateriaMult
    : fleteAntesBateria;
  const recargoBateria = roundUSD(fleteConBateria - fleteAntesBateria);

  // 5.11 — Descuento si es Valencia (solo si hay descuento configurado > 0;
  // el guard evita -0 cuando descuentoValencia es 0).
  const descuentoSede =
    ciudad.id === "valencia" && params.descuentoValencia > 0
      ? -params.descuentoValencia
      : 0;

  // 5.12 — Total antes del piso (Σ de los ítems del desglose)
  const totalSinPiso = fleteConBateria + descuentoSede;

  // Piso mínimo. Si la tarifa pública trae un min_charge real (mínimo LCL
  // comercial, ej. $380), ese es el piso; si no, el piso trivial de CONFIG.
  const piso =
    input.minChargeOverride != null && input.minChargeOverride > 0
      ? input.minChargeOverride
      : CONFIG.minimoFacturable;
  const total = Math.max(totalSinPiso, piso);
  // Cuánto sumó el piso → el desglose reconcilia: Σ ítems + ajusteMinimo = total.
  const ajusteMinimo = roundUSD(Math.max(0, total - totalSinPiso));

  return {
    cbm,
    densidadKgM3: round(densidadKgM3),
    sinPeso,
    pesoMaxSinRecargoKg: sinPeso ? pesoMaxSinRecargo(cbm, params) : 0,
    precioBase: roundUSD(precioBase),
    recargoExcedente: roundUSD(recargoExcedente),
    recargoCiudad: roundUSD(recargoCiudad),
    recargoEmbalaje: roundUSD(recargoEmbalaje),
    recargoBateria,
    descuentoSede: roundUSD(descuentoSede),
    ajusteMinimo,
    total: roundUSD(total),
    alerta,
    avisoEntrega,
    cercana: null,
    ciudad,
    embalaje: input.embalaje,
  };
}

// ────────────────────────────────────────────────────────────────────
// 6) HELPERS PRIVADOS
// ────────────────────────────────────────────────────────────────────

/** Redondea a 3 decimales (estándar industria para CBM). */
function roundCBM(n: number): number {
  return Math.ceil(n * 1000) / 1000;
}

/** Redondea USD a 2 decimales. */
function roundUSD(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Redondea a 2 decimales. */
function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * El peso "de verdad" de un input (SDD-0257): `0` cuando el cliente no lo
 * indicó, en cualquiera de sus formas (`0`, `null`, `undefined`, `NaN`).
 *
 * Existe para que el motor y el texto de WhatsApp decidan lo mismo. Si cada uno
 * escribiera su propio chequeo, el día que uno acepte `NaN` el asesor recibiría
 * "NaN kg" mientras la UI dice "sin indicar".
 */
function normalizarPeso(pesoKg: number | null | undefined): number {
  return pesoKg != null && Number.isFinite(pesoKg) && pesoKg > 0 ? pesoKg : 0;
}

/** Devuelve una cotización en estado de error (con alerta). */
function cotizacionVacia(
  alerta: NonNullable<EnvioCotizacion["alerta"]>,
  input: EnvioInput,
): EnvioCotizacion {
  return {
    cbm: 0,
    densidadKgM3: 0,
    // No hay precio que sostener, así que no hay "desde" que explicar: el estado
    // de error manda su propio mensaje y la UI no pinta el aviso del peso.
    sinPeso: false,
    pesoMaxSinRecargoKg: 0,
    precioBase: 0,
    recargoExcedente: 0,
    recargoCiudad: 0,
    recargoEmbalaje: 0,
    recargoBateria: 0,
    descuentoSede: 0,
    ajusteMinimo: 0,
    total: 0,
    alerta,
    avisoEntrega: null,
    cercana: null,
    ciudad: null,
    embalaje: input.embalaje,
  };
}

// ────────────────────────────────────────────────────────────────────
// 7) MENSAJE WHATSAPP PRECONFIGURADO
//    Genera el texto que el cliente envía al hacer click en "Cotizar
//    por WhatsApp" con todos los datos del cálculo ya completos.
// ────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────
// 8) PARSEO DE ENTRADA DECIMAL (UI) — acepta coma o punto (es-VE)
//    El cliente venezolano escribe "2,5"; otros "2.5". Los campos del form
//    aceptan AMBOS. Estas funciones son puras → testeables sin DOM.
// ────────────────────────────────────────────────────────────────────

/**
 * Limpia el texto de un campo decimal: deja solo dígitos y UN separador
 * decimal (el primero que aparezca, coma o punto). Pensado para el onChange
 * del input, para mantener visible lo que el usuario tipea ("2", "2,", "2,5",
 * "2.5") sin que un valor numérico controlado le borre el separador a mitad
 * de tipeo. Cualquier separador extra se descarta.
 *
 * Ej: "2,5" → "2,5" · "2." → "2." · "1.2.3" → "1.23" · "ab12,5x" → "12,5"
 */
export function sanitizeDecimalText(raw: string): string {
  let s = raw.replace(/[^\d.,]/g, "");
  const firstSep = s.search(/[.,]/);
  if (firstSep !== -1) {
    const head = s.slice(0, firstSep + 1);
    const tail = s.slice(firstSep + 1).replace(/[.,]/g, "");
    s = head + tail;
  }
  return s;
}

/**
 * Convierte el texto de un campo decimal a número, aceptando coma o punto
 * como separador decimal. Devuelve NaN si no hay número parseable (campo
 * vacío, solo el separador, etc.) — el llamador decide el fallback.
 *
 * Ej: "2,5" → 2.5 · "2.5" → 2.5 · "2." → 2 · "" → NaN · "," → NaN
 */
export function parseDecimalInput(raw: string): number {
  const normalized = sanitizeDecimalText(raw).replace(",", ".");
  if (normalized === "" || normalized === ".") return NaN;
  return parseFloat(normalized);
}

// ────────────────────────────────────────────────────────────────────
// 8b) CBM A PARTIR DE MEDIDAS (UI) — para el cliente que no sabe su CBM
//     El cliente que no conoce su volumen lo deriva de las dimensiones de
//     una caja (cm) × cantidad de cajas. Función pura → testeable sin DOM.
// ────────────────────────────────────────────────────────────────────

/**
 * Calcula el CBM total a partir de las medidas de una caja (en cm) y la
 * cantidad de cajas iguales.
 *
 *   CBM por caja  = (alto × ancho × largo) / 1.000.000
 *   CBM total     = CBM por caja × cantidad de cajas
 *
 * Devuelve 0 si cualquier medida o la cantidad no es un número positivo
 * finito (campo vacío, 0, negativo, NaN) — así el llamador puede asignar el
 * resultado directo sin romper el cálculo aguas abajo.
 *
 * Ej: 40 × 30 × 60 cm × 10 cajas → 0,072 m³/caja → 0,72 CBM.
 */
export function cbmFromDimensions(
  altoCm: number,
  anchoCm: number,
  largoCm: number,
  cajas: number,
): number {
  const dims = [altoCm, anchoCm, largoCm, cajas];
  if (dims.some((n) => !Number.isFinite(n) || n <= 0)) return 0;
  const cbmPorCaja = (altoCm * anchoCm * largoCm) / 1_000_000;
  return roundCBM(cbmPorCaja * cajas);
}

/**
 * Unidades en las que un cliente puede traer sus medidas. El centímetro es la
 * base del sistema —es como se miden las cajas y como las entrega la ficha del
 * proveedor chino—; las otras dos existen porque la medida llega así de la
 * fuente: metros en algunas fichas, y pulgadas cuando el proveedor factura
 * para Estados Unidos.
 */
export type UnidadMedida = "cm" | "m" | "in";

/** Cuánto mide 1 unidad en centímetros. La conversión SIEMPRE cae a cm. */
export const CM_POR_UNIDAD: Record<UnidadMedida, number> = {
  cm: 1,
  m: 100,
  in: 2.54,
};

/**
 * CBM a partir de medidas en cualquiera de las unidades soportadas: convierte a
 * centímetros y delega en `cbmFromDimensions`. La cuenta vive en un solo lugar,
 * así que la FAQ y la calculadora no pueden dar números distintos por la misma
 * caja.
 *
 * Ej: 60 × 40 × 50 cm · 0,6 × 0,4 × 0,5 m → los dos dan 0,12 CBM.
 */
export function cbmFromDimensionsEnUnidad(
  alto: number,
  ancho: number,
  largo: number,
  cajas: number,
  unidad: UnidadMedida,
): number {
  const factor = CM_POR_UNIDAD[unidad];
  return cbmFromDimensions(alto * factor, ancho * factor, largo * factor, cajas);
}

/** 1 m³ en pies cúbicos — para el importador que trabaja en medidas gringas. */
export const FT3_POR_CBM = 35.3147;

// ────────────────────────────────────────────────────────────────────
// 8c) LA CARGA CHICA, EN UNIDADES QUE EL CLIENTE ENTIENDE
// ────────────────────────────────────────────────────────────────────

/**
 * La caja de reempaque estándar de la bodega de Yiwu.
 *
 * ⚠️ ES UNA REGLA DE OPERACIÓN, NO UN PARÁMETRO DE PRICING. No entra en ningún
 * cálculo: sirve SOLO para traducir metros cúbicos a algo que el cliente pueda
 * imaginar. El precio lo siguen fijando la tarifa y el piso, y si esta caja
 * cambiara, ningún estimado se movería un centavo.
 *
 * Si la bodega cambia el estándar de reempaque, se cambia acá y el copy se
 * ajusta solo. Ese es el único motivo por el que vive en una constante y no
 * escrita dentro de una frase.
 */
export const CAJA_MINIMA = {
  largoCm: 40,
  anchoCm: 30,
  altoCm: 25,
  /** 40 × 30 × 25 = 30.000 cm³ = 0,03 m³ exactos. */
  cbm: 0.03,
  label: "40×30×25 cm",
} as const;

/**
 * Cuántas cajas estándar hacen falta para llegar a un volumen.
 *
 * Redondea HACIA ARRIBA a propósito: con 2,08 cajas todavía no llegaste al
 * volumen, así que decir "2" sería mentir por defecto — el cliente pagaría el
 * piso creyendo que no le toca.
 */
export function cajasParaCbm(cbm: number): number {
  if (!Number.isFinite(cbm) || cbm <= 0) return 0;
  return Math.ceil(cbm / CAJA_MINIMA.cbm);
}

/**
 * Traduce un volumen a la frase que el cliente sí entiende.
 *
 * "0,0625 m³" no le dice nada a nadie: no sabe si es mucho o poco ni qué hacer
 * con el dato. En cajas, sí.
 *
 * `conPiesCubicos` agrega la referencia en pies cúbicos —la unidad que el
 * comerciante venezolano ya trae puesta del tráfico con Estados Unidos— pero
 * viene APAGADA por default, y no por gusto: el aviso del mínimo vive en media
 * columna del formulario, y medido en el navegador la coletilla lo empujaba de
 * 3 a 4 líneas en 390px, dentro de una caja de 141px de ancho. Enciéndela solo
 * donde haya renglón de sobra.
 *
 * Ej: 0,0625 → "3 cajas de 40×30×25 cm"
 *     0,0625 con pies cúbicos → "3 cajas de 40×30×25 cm (unos 2 pies cúbicos)"
 */
export function describirVolumenEnCajas(
  cbm: number,
  { conPiesCubicos = false }: { conPiesCubicos?: boolean } = {},
): string {
  const cajas = cajasParaCbm(cbm);
  const cajasTxt = `${cajas} ${cajas === 1 ? "caja" : "cajas"} de ${CAJA_MINIMA.label}`;
  if (!conPiesCubicos) return cajasTxt;
  const ft3 = Math.round(cbm * FT3_POR_CBM);
  // Por debajo de un pie cúbico el redondeo da 0 y "unos 0 pies cúbicos" es
  // absurdo: ahí la referencia no aporta y se omite.
  if (ft3 < 1) return cajasTxt;
  return `${cajasTxt} (${ft3 === 1 ? "un pie cúbico" : `unos ${ft3} pies cúbicos`})`;
}

export function whatsappTextFromCotizacion(
  cot: EnvioCotizacion,
  input: EnvioInput,
): string {
  const ciudad = cot.ciudad?.label ?? "destino";
  const embalaje =
    EMBALAJES.find((e) => e.id === cot.embalaje)?.label ?? "Caja estándar";
  // Datos que el cliente calculó. Esta es la pieza clave: el mensaje viaja con
  // la cotización al WhatsApp del negocio (y de ahí al CRM), así el asesor ve
  // exactamente lo que el cliente estimó en la web.
  //
  // El peso puede no venir (SDD-0257). Antes esto escribía "Peso total: 0 kg",
  // que le MIENTE al asesor: "0" se lee como un dato, no como un dato ausente.
  const pesoKg = normalizarPeso(input.pesoKg);
  const datos = [
    `• CBM total: ${input.cbmTotal} m³`,
    pesoKg > 0 ? `• Peso total: ${pesoKg} kg` : `• Peso total: sin indicar`,
    `• Embalaje: ${embalaje}`,
    `• Baterías: ${input.bateria ? "Sí" : "No"}`,
    `• Destino: ${ciudad}`,
  ];

  // Caso que deriva al asesor (carga especial, supera el contenedor, etc.):
  // no hay un precio válido para mostrar → pedimos cotización a medida.
  if (cot.alerta) {
    return [
      "Acabo de cotizar en tu calculadora y necesito asesoría con mi carga:",
      "",
      ...datos,
      "",
      cot.alerta.mensaje,
      "",
      "¿Me ayudan con una cotización a medida?",
    ].join("\n");
  }

  // Sin peso el estimado es un PISO, y el mensaje tiene que decirlo con todas
  // las letras: es lo que evita que el asesor confirme como final un número que
  // todavía puede subir por densidad.
  if (cot.sinPeso) {
    return [
      "Acabo de cotizar en tu calculadora. Esto es lo que estoy calculando:",
      "",
      ...datos,
      `• Estimado web: desde US$${cot.total.toFixed(2)}`,
      "",
      `Todavía no sé el peso de mi carga. ${mensajeEstimadoSinPeso(cot.pesoMaxSinRecargoKg)}`,
      "",
      "¿Me ayudan a cerrar el precio? (pagas al llegar)",
    ].join("\n");
  }

  return [
    "Acabo de cotizar en tu calculadora. Esto es lo que estoy calculando:",
    "",
    ...datos,
    `• Estimado web: US$${cot.total.toFixed(2)}`,
    "",
    "¿Me confirman la tarifa final y los tiempos? (pagas al llegar)",
  ].join("\n");
}
