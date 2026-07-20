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
 *  1. El cliente ingresa el CBM total (m³) directo y el peso total (kg).
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
  /** Tarifa base por metro cúbico en USD (precio limpio sin excedente). */
  tarifaBaseCBM: 800,

  /** Gracia de peso por CBM incluida en la tarifa base. Sobre esto = excedente. */
  pesoIncluidoKg: 500,

  /**
   * Tarifa por kg que excede `pesoIncluidoKg` (recargo continuo, sin tope).
   * Ej: si la carga pesa 600 kg en 1 CBM, el excedente es 100 kg × $1 = +$100.
   */
  recargoExcedenteKg: 1,

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
   * 1.5 = +50% sobre el flete (antes del descuento de sede).
   */
  recargoBateriaMult: 1.5,

  /**
   * Distancia (km) hasta donde se considera "casco central" — entrega
   * flat sin recargo extra por km. Sobre esto se cobra por km.
   */
  thresholdCascoKm: 200,

  /**
   * Tarifa por km cuando el destino está fuera del casco central.
   * Ej: ciudad a 350 km → 150 km fuera del casco → recargo 150 × $1 = $150.
   */
  tarifaKmFueraCasco: 1,

  /** Precio mínimo facturable. Si la carga es muy chica, este es el piso. */
  minimoFacturable: 50,

  /**
   * CBM total máximo cotizable por la calculadora (LCL). Sobre esto, la carga
   * ya no entra en un contenedor estándar → deriva al asesor (FCL).
   * (~68 m³ ≈ capacidad de un 40' HC).
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
 *    (`is_public`) y llega por la RPC anon `public_cbm_rate`. Para que ESTA
 *    también se edite desde `/studio/tarifas` hace falta una **migración
 *    pendiente** (una segunda tarifa pública marcada por modalidad, o una
 *    columna nueva en `rates`). Mientras eso no exista, se cambia acá.
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
  /** Km desde Valencia centro (referencia para recargo por distancia). */
  km: number;
  /** Si es true, entra en el flat del casco central sin recargo extra. */
  casco: boolean;
};

export const CIUDADES: Ciudad[] = [
  // Opción agrupada por default — cualquier punto del casco central, sin recargo
  { id: "casco-central", label: "Casco central (Valencia · Maracay · Caracas)", km: 0, casco: true },
  // Casco central — flat tarifa base
  { id: "valencia",     label: "Valencia (sede)",  km: 0,   casco: true },
  { id: "maracay",      label: "Maracay",          km: 70,  casco: true },
  { id: "caracas",      label: "Caracas",          km: 150, casco: true },
  // Fuera del casco — recargo por km
  { id: "barquisimeto", label: "Barquisimeto",     km: 220, casco: false },
  { id: "maracaibo",    label: "Maracaibo",        km: 410, casco: false },
  { id: "puerto-la-cruz", label: "Puerto La Cruz", km: 430, casco: false },
  { id: "san-cristobal", label: "San Cristóbal",   km: 580, casco: false },
  { id: "merida",       label: "Mérida",           km: 520, casco: false },
  { id: "ciudad-bolivar", label: "Ciudad Bolívar", km: 700, casco: false },
  { id: "puerto-ordaz", label: "Puerto Ordaz",     km: 770, casco: false },
  { id: "punto-fijo",   label: "Punto Fijo",       km: 290, casco: false },
  { id: "coro",         label: "Coro",             km: 260, casco: false },
  // Margarita (isla) — caso especial: mismo cálculo por km pero advertir
  // que cruza ferry. Edita el km si quieres que pague más por la travesía.
  { id: "margarita",    label: "Isla Margarita",   km: 540, casco: false },
];

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
  /** Peso total de toda la carga en kg. */
  pesoKg: number;
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
   * Si no se provee, se usa `CONFIG.tarifaBaseCBM` (default $800).
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
  /** Densidad calculada (peso/CBM). */
  densidadKgM3: number;

  /** Cargos individuales (todos en USD, para mostrar desglose). */
  precioBase: number;       // CBM × tarifaBase
  recargoExcedente: number; // recargo por densidad: kg que exceden pesoIncluidoKg/CBM × recargoExcedenteKg (founder 2026-06-20).
  recargoCiudad: number;    // km fuera del casco × tarifaKm
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
      | "volumen_minimo_consolidado";
    mensaje: string;
  };

  /** Datos derivados para mostrar al usuario. */
  ciudad: Ciudad | null;
  embalaje: TipoEmbalaje;
};

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

  // 5.3 — Validar carga
  if (input.cbmTotal <= 0 || input.pesoKg <= 0) {
    return cotizacionVacia({
      tipo: "carga_invalida",
      mensaje: "El CBM total y el peso deben ser mayores a cero.",
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
  if (input.pesoKg > params.pesoMaxContenedorKg) {
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
  const densidadKgM3 = input.pesoKg / cbm;

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
  if (
    input.pesoKg > params.pesoMaxEnvioKg &&
    densidadKgM3 > equilibrioDensidad
  ) {
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
  let recargoExcedente = 0;
  if (densidadKgM3 > params.pesoIncluidoKg) {
    const kgExcedente = Math.max(0, input.pesoKg - cbm * params.pesoIncluidoKg);
    recargoExcedente = roundUSD(kgExcedente * params.recargoExcedenteKg);
  }
  const alerta: EnvioCotizacion["alerta"] | undefined = undefined;

  // 5.7 — Recargo por ciudad fuera del casco central
  let recargoCiudad = 0;
  if (!ciudad.casco) {
    const kmFueraCasco = Math.max(0, ciudad.km - params.thresholdCascoKm);
    recargoCiudad = roundUSD(kmFueraCasco * params.tarifaKmFueraCasco);
  }

  // 5.8 — Recargo por embalaje (especial = madera/paleta). Se computa desde
  // params (configurable), no desde EMBALAJES (que solo aporta labels al form).
  const recargoEmbalaje =
    input.embalaje === "especial" ? params.recargoEmbalajeEspecial : 0;

  // 5.9 — Flete antes de baterías (base + recargos; `recargoExcedente` es 0
  // siempre desde 2026-06-08, queda en la suma solo para que el desglose
  // reconcilie Σ ítems = total).
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
    precioBase: roundUSD(precioBase),
    recargoExcedente: roundUSD(recargoExcedente),
    recargoCiudad: roundUSD(recargoCiudad),
    recargoEmbalaje: roundUSD(recargoEmbalaje),
    recargoBateria,
    descuentoSede: roundUSD(descuentoSede),
    ajusteMinimo,
    total: roundUSD(total),
    alerta,
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

/** Devuelve una cotización en estado de error (con alerta). */
function cotizacionVacia(
  alerta: NonNullable<EnvioCotizacion["alerta"]>,
  input: EnvioInput,
): EnvioCotizacion {
  return {
    cbm: 0,
    densidadKgM3: 0,
    precioBase: 0,
    recargoExcedente: 0,
    recargoCiudad: 0,
    recargoEmbalaje: 0,
    recargoBateria: 0,
    descuentoSede: 0,
    ajusteMinimo: 0,
    total: 0,
    alerta,
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
  const datos = [
    `• CBM total: ${input.cbmTotal} m³`,
    `• Peso total: ${input.pesoKg} kg`,
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

  return [
    "Acabo de cotizar en tu calculadora. Esto es lo que estoy calculando:",
    "",
    ...datos,
    `• Estimado web: US$${cot.total.toFixed(2)}`,
    "",
    "¿Me confirman la tarifa final y los tiempos? (pagas al llegar)",
  ].join("\n");
}
