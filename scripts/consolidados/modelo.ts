/**
 * SDD-0543 · Consolidados en camino — modelo puro del lote.
 *
 * Convierte la fila del rastreo y las filas del packing list en un lote:
 * clientes → embarques (uno por «Remitente») → filas del Excel. No lee disco ni
 * red: todo lo que decide sale de los argumentos, así las pruebas lo fijan sin
 * fixtures de base.
 *
 * Reglas de negocio que viven acá (decisiones de Sam del 2026-10-16):
 *  - la recepción en China es un día ANTES de la fecha de carga del contenedor;
 *  - el código del envío es el Remitente del Excel (`DTD-A116-06`, `DC-014-21`);
 *  - una factura por cliente y contenedor, con una línea por embarque y precio
 *    («Flete DDP · <remitente> · <cbm> m³ × $<precio>») más «Exceso de peso» por
 *    cada fila con valor $ kg extra positivo (se puede apagar con `excesoPeso`);
 *  - la base de la factura es Σ(qty × unitPrice) redondeada a 2, el mismo
 *    espejo de `calcInvoiceTotals` (`lib/studio/invoice-types.ts`). La cantidad
 *    de m³ de la línea conserva 4 decimales para reproducir el total del Excel;
 *    las columnas de la base (`volume_m3`, `cbm`) llevan 3.
 */

export interface FilaPacking {
  /** Número de fila en el Excel: es la evidencia para revisar a mano. */
  filaExcel: number;
  /** Columna «marca de la caja» tal cual (marca + nombre, o nombre del aliado). */
  marcaTexto: string;
  /** Columna «Remitente» normalizada: mayúsculas, sin espacios. */
  remitente: string;
  descripcion: string;
  cajas: number;
  pesoKg: number;
  cbmChina: number;
  cbmFactura: number;
  /** «CONSOLIDADO KG EXTRA»: kilos por encima de lo permitido (negativo = sobra). */
  extraKg: number;
  /** «PRECIO X KG EXTRA», $/kg. */
  precioKgExtra: number;
  /** «VALOR $ KG EXTRA»: lo que el Excel cobra por el exceso (puede ser ≤ 0). */
  valorKgExtra: number;
  /** «PRECIO VENTA CBM», $/m³. */
  precioCbm: number;
  /** «TOTAL FACTURADO» del Excel, sólo para cuadrar; la factura se recalcula. */
  totalFacturado: number;
  agente: string;
}

export interface Rastreo {
  numero: number;
  /** Texto de «# CONTENEDOR», p. ej. `DTD#59` o `HR-DTD#60`. */
  etiqueta: string;
  /** «FCL/DDP» tal cual: `DDP`, `FCL`, `FCL/DDP 5.70cbm`… */
  modalidad: string | null;
  puertoCarga: string | null;
  /** «FECHA DE CARGA» en ISO (YYYY-MM-DD) o null si el Excel no la trae legible. */
  fechaCarga: string | null;
  contenedor: string;
  precinto: string | null;
  naviera: string | null;
  puertoLlegada: string | null;
  etaExcel: string | null;
  link: string | null;
  filaExcel: number;
}

export interface Marca {
  /** Clave de agrupación del cliente dentro del lote: `DTD-J031`, `DC-0014`, `MMVE-0041`. */
  clave: string;
  prefijo: string;
  /** Segmento de cliente tal cual viene (`J031`, `014`, `01-ALESS`). */
  numero: string;
  /** `true` si es un cliente directo de la casa (prefijo DTD). */
  esCasa: boolean;
  /** Marcas a probar, en orden, con `resolve_markbox` en la base destino. */
  candidatos: string[];
  /** Nombre que acompaña a la marca en el Excel (o el texto del aliado). */
  nombreExcel: string;
}

export interface LineaFactura {
  desc: string;
  qty: number;
  unitPrice: number;
}

export interface Embarque {
  orden: number;
  remitente: string;
  clave: string;
  filas: FilaPacking[];
  cajas: number;
  pesoKg: number;
  cbmChina: number;
  cbmFactura: number;
  /** Precios $/m³ distintos vistos en el embarque (normalmente uno). */
  precios: number[];
}

export interface Cliente {
  clave: string;
  marca: Marca;
  embarques: Embarque[];
  cajas: number;
  pesoKg: number;
  cbmFactura: number;
  lineas: LineaFactura[];
  /** Σ(qty × unitPrice) a 2 decimales. */
  base: number;
  /** Lo que suman las líneas de exceso de peso (ya incluido en `base` si `excesoPeso`). */
  excesoPeso: number;
}

export interface Totales {
  filas: number;
  embarques: number;
  clientes: number;
  cajas: number;
  pesoKg: number;
  cbmChina: number;
  cbmFactura: number;
  base: number;
  excesoPeso: number;
  /** Σ «TOTAL FACTURADO» del Excel, para cuadrar contra `base`. */
  totalFacturadoExcel: number;
}

/**
 * Modalidad del contenedor (decisión de Sam vía Director, 2026-10-17):
 *  - `ddp`: contenedor nuestro; un envío DDP por Remitente del packing list y una
 *    factura por cliente (59, 64).
 *  - `fcl`: contenedor de un cliente; sólo su envío FCL con contenedor y zarpe,
 *    sin recepciones ni factura (61, 62, 63).
 *  - `mixto`: contenedor de un aliado con nuestros DDP adentro: el envío FCL del
 *    dueño más los DDP del packing list, facturados; el espacio que el aliado nos
 *    cobra entra como gasto (60).
 */
export type Modalidad = "ddp" | "fcl" | "mixto";

export type ServicioFcl = "fcl_directo" | "fcl_bodega";

export interface Dueno {
  marca: Marca;
  servicio: ServicioFcl;
  /** Código del envío FCL del dueño, p. ej. `MG-019-FCL-61`. */
  codigo: string;
  cbm: number | null;
  kg: number | null;
}

export interface GastoEspacio {
  monto: number;
  /** Correo del usuario del Studio a cuyo nombre se registra el gasto (expenses.user_id es obligatorio). */
  usuarioEmail: string;
}

export interface Lote {
  rastreo: Rastreo;
  modalidad: Modalidad;
  /** Dueño del contenedor en `fcl` y `mixto`. */
  dueno: Dueno | null;
  /** Gasto por el espacio que el aliado nos cobra (`mixto`), si Sam dio el monto. */
  gastoEspacio: GastoEspacio | null;
  fechaCarga: string;
  fechaRecepcion: string;
  etd: string;
  eta: string;
  excesoPeso: boolean;
  clientes: Cliente[];
  embarques: Embarque[];
  filas: FilaPacking[];
  totales: Totales;
  avisos: string[];
}

export interface OpcionesLote {
  /** ETA decidida (YYYY-MM-DD). Obligatoria: el Excel la trae vencida o vacía. */
  eta: string;
  /** ETD; por defecto la fecha de carga. */
  etd?: string;
  /** Fecha de carga si el Excel no la trae legible. */
  fechaCarga?: string;
  /** Marca del Excel (clave o `PREFIJO-numero`) → Shipping Mark canónico decidido a mano. */
  mapa?: Record<string, string>;
  /** Cobrar las líneas de «Exceso de peso». Por defecto sí. */
  excesoPeso?: boolean;
  /** Por defecto `ddp`. */
  modalidad?: Modalidad;
  /** Marca del dueño del contenedor (`MG-019`, `DTD-9038`, o la insignia pelada `HR`). Obligatoria en fcl y mixto. */
  dueno?: string;
  servicioFcl?: ServicioFcl;
  cbmFcl?: number | null;
  kgFcl?: number | null;
  gastoEspacio?: GastoEspacio | null;
}

/**
 * Marca del dueño de un contenedor FCL: una marca normal (`MG-019`, `DTD-9038`)
 * o la insignia pelada de un aliado (`HR`), cuya ficha ES el aliado (migr 0371).
 */
export function interpretarMarcaDueno(texto: string): Marca {
  const t = normalizarCodigo(texto);
  if (/^[A-Z]{2,4}$/.test(t)) {
    if (t === "DTD") throw new Error("La casa no es dueña de un FCL: indica la marca del cliente");
    return { clave: t, prefijo: t, numero: "", esCasa: false, candidatos: [t], nombreExcel: `Aliado ${t}` };
  }
  if (!/^[A-Z]{2,4}-[A-Z]?\d{1,5}$/.test(t)) {
    throw new Error(`Marca del dueño sin forma PREFIJO o PREFIJO-numero: «${texto}»`);
  }
  const marca = interpretarMarca(t, `${t}-0`);
  if (!marca.nombreExcel) marca.nombreExcel = `Dueño del contenedor ${t}`;
  return marca;
}

export const ISO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Resta días a una fecha ISO sin depender de la zona horaria de la máquina. */
export function restarDias(iso: string, dias: number): string {
  if (!ISO_FECHA.test(iso)) throw new Error(`Fecha inválida: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - dias * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Mayúsculas, sin espacios ni caracteres de control: la forma de un código. */
export function normalizarCodigo(texto: string | null | undefined): string {
  return String(texto ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

/**
 * Un Remitente escrito a mano: `DTD-S011/21` o `DTD_A068-18` quieren decir
 * `DTD-S011-21` y `DTD-A068-18`. Devuelve el código y si hubo que corregirlo.
 */
export function normalizarRemitente(texto: string | null | undefined): { remitente: string; corregido: boolean } {
  const crudo = normalizarCodigo(texto);
  const remitente = crudo.replace(/[/_.]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  return { remitente, corregido: remitente !== crudo };
}

const RE_MARCA_EN_TEXTO = /^([A-Z]{2,4})-([A-Z]?\d{1,5}(?:-[A-Z]+)?)(?:-\d{1,3})?\b\s*(.*)$/i;

function claveDe(prefijo: string, numero: string): string {
  return /^\d+$/.test(numero) ? `${prefijo}-${String(Number(numero)).padStart(4, "0")}` : `${prefijo}-${numero}`;
}

/**
 * Interpreta la marca de una fila a partir del Remitente (fuente primaria) y de
 * la columna «marca de la caja» (nombre). Lanza si el Remitente no tiene la
 * forma `PREFIJO-cliente[-secuencia]`.
 */
export function interpretarMarca(marcaTexto: string, remitente: string): Marca {
  const tokens = normalizarCodigo(remitente).split("-").filter(Boolean);
  if (tokens.length < 2 || !/^[A-Z]{2,4}$/.test(tokens[0])) {
    throw new Error(`Remitente sin forma PREFIJO-cliente[-secuencia]: «${remitente}»`);
  }
  const prefijo = tokens[0];
  const numero = (tokens.length >= 3 ? tokens.slice(1, -1) : tokens.slice(1)).join("-");
  const esCasa = prefijo === "DTD";

  const texto = String(marcaTexto ?? "").replace(/\s+/g, " ").trim();
  const m = texto.match(RE_MARCA_EN_TEXTO);
  const nombreExcel = m && normalizarCodigo(m[1]) === prefijo ? m[3].trim() : texto;

  const candidatos: string[] = [];
  if (esCasa) {
    candidatos.push(`DTD-${numero}`);
  } else if (/^\d+$/.test(numero)) {
    const n = Number(numero);
    for (const c of [`${prefijo}-${String(n).padStart(4, "0")}`, `${prefijo}-${numero}`, `${prefijo}-${String(n).padStart(3, "0")}`]) {
      if (!candidatos.includes(c)) candidatos.push(c);
    }
  } else {
    candidatos.push(`${prefijo}-${numero}`);
  }

  return { clave: claveDe(prefijo, numero), prefijo, numero, esCasa, candidatos, nombreExcel };
}

/** Literal SQL de texto: comillas dobladas, sin caracteres de control. */
export function litSql(texto: string | null | undefined): string {
  if (texto == null) return "null";
  const limpio = String(texto).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return `'${limpio.replace(/'/g, "''")}'`;
}

function num(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

/**
 * Σ(qty × unitPrice) a 2 decimales con la MISMA regla que `round(numeric, 2)`
 * de Postgres (mitad hacia arriba, aritmética exacta). `Math.round` sobre
 * binarios falla justo en los .xx5 (507.925 → 507.92), y la base de la factura
 * la calcula aplicar.sql en numeric: el manifiesto tiene que dar lo mismo.
 * qty y unitPrice llevan como máximo 4 decimales.
 */
export function baseDeLineas(lineas: readonly LineaFactura[]): number {
  let suma = 0n; // escalado ×1e8
  for (const l of lineas) {
    suma += BigInt(Math.round(num(l.qty) * 1e4)) * BigInt(Math.round(num(l.unitPrice) * 1e4));
  }
  const negativo = suma < 0n;
  const abs = negativo ? -suma : suma;
  const centavos = (abs + 500_000n) / 1_000_000n; // ×1e8 → ×1e2, mitad hacia arriba
  return Number(negativo ? -centavos : centavos) / 100;
}

function normalizarMapa(mapa: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(mapa ?? {})) out[normalizarCodigo(k)] = normalizarCodigo(v);
  return out;
}

/**
 * Arma el lote: valida fechas, agrupa por Remitente y por cliente, calcula las
 * líneas de factura y los totales. Las filas sin Remitente (la de totales) se
 * descartan con aviso.
 */
export function agruparLote(rastreo: Rastreo, filas: FilaPacking[], opciones: OpcionesLote): Lote {
  const avisos: string[] = [];
  const excesoPeso = opciones.excesoPeso ?? true;
  const modalidad: Modalidad = opciones.modalidad ?? "ddp";
  let dueno: Dueno | null = null;
  if (modalidad === "fcl" || modalidad === "mixto") {
    if (!opciones.dueno) throw new Error(`La modalidad ${modalidad} exige la marca del dueño del contenedor (--dueno)`);
    const marca = interpretarMarcaDueno(opciones.dueno);
    const mapaDueno = normalizarMapa(opciones.mapa);
    const manual = mapaDueno[marca.clave] ?? mapaDueno[`${marca.prefijo}-${marca.numero}`];
    if (manual) marca.candidatos = [manual, ...marca.candidatos.filter((x) => x !== manual)];
    const cbm = opciones.cbmFcl ?? null;
    const kg = opciones.kgFcl ?? null;
    if (cbm != null && !(cbm > 0)) throw new Error("--cbm-fcl debe ser mayor que 0");
    if (kg != null && !(kg > 0)) throw new Error("--kg-fcl debe ser mayor que 0");
    dueno = {
      marca,
      servicio: opciones.servicioFcl ?? "fcl_directo",
      codigo: `${normalizarCodigo(opciones.dueno)}-FCL-${rastreo.numero}`,
      cbm: cbm == null ? null : round3(cbm),
      kg: kg == null ? null : round2(kg),
    };
    if (cbm == null) avisos.push(`El envío FCL del dueño ${dueno.codigo} se carga sin m³ (no viene en la hoja de rastreo); se puede pasar con --cbm-fcl.`);
  } else if (opciones.dueno) {
    throw new Error("--dueno sólo aplica a las modalidades fcl y mixto");
  }
  let gastoEspacio: GastoEspacio | null = null;
  if (opciones.gastoEspacio) {
    if (modalidad !== "mixto") throw new Error("El gasto por espacio sólo aplica a la modalidad mixto");
    if (!(opciones.gastoEspacio.monto > 0)) throw new Error("--gasto-espacio debe ser mayor que 0");
    if (!/^[^@\s]+@[^@\s]+$/.test(opciones.gastoEspacio.usuarioEmail)) throw new Error("--gasto-usuario debe ser el correo de un usuario del Studio");
    gastoEspacio = { monto: round2(opciones.gastoEspacio.monto), usuarioEmail: opciones.gastoEspacio.usuarioEmail.trim().toLowerCase() };
  }
  if (modalidad === "fcl" && filas.length > 0) {
    avisos.push(`Modalidad fcl: se ignoran las ${filas.length} filas del packing list (un FCL de cliente no lleva recepciones ni facturas nuestras).`);
    filas = [];
  }
  const fechaCarga = opciones.fechaCarga ?? rastreo.fechaCarga;
  if (!fechaCarga || !ISO_FECHA.test(fechaCarga)) {
    throw new Error(`Falta la fecha de carga del contenedor ${rastreo.numero} (pásala con --fecha-carga YYYY-MM-DD)`);
  }
  if (!ISO_FECHA.test(opciones.eta)) throw new Error(`ETA inválida: ${opciones.eta}`);
  const etd = opciones.etd ?? fechaCarga;
  if (!ISO_FECHA.test(etd)) throw new Error(`ETD inválida: ${etd}`);
  if (opciones.eta < etd) throw new Error(`La ETA ${opciones.eta} es anterior al zarpe ${etd}`);
  const fechaRecepcion = restarDias(fechaCarga, 1);
  if (!/^[A-Z]{4}\d{6,7}$/.test(normalizarCodigo(rastreo.contenedor))) {
    avisos.push(`El número de contenedor «${rastreo.contenedor}» no tiene la forma ISO (4 letras + 7 dígitos); se carga tal cual.`);
  }
  const mapa = normalizarMapa(opciones.mapa);

  const embarquesPorRemitente = new Map<string, Embarque>();
  const filasUtiles: FilaPacking[] = [];
  const descartadas: FilaPacking[] = [];
  for (const fila of filas) {
    const { remitente, corregido } = normalizarRemitente(fila.remitente);
    if (!remitente) {
      descartadas.push(fila);
      avisos.push(`Fila ${fila.filaExcel} sin Remitente: se descarta (${fila.cajas} cajas, ${round3(num(fila.cbmFactura))} m³, ${round2(num(fila.pesoKg))} kg).`);
      continue;
    }
    if (corregido) avisos.push(`Fila ${fila.filaExcel}: el Remitente «${fila.remitente}» se corrige a «${remitente}».`);
    let marca: Marca;
    try {
      marca = interpretarMarca(fila.marcaTexto, remitente);
    } catch (e) {
      throw new Error(`Fila ${fila.filaExcel}: ${(e as Error).message}`);
    }
    const f: FilaPacking = { ...fila, remitente };
    filasUtiles.push(f);
    let e = embarquesPorRemitente.get(remitente);
    if (!e) {
      e = { orden: embarquesPorRemitente.size + 1, remitente, clave: marca.clave, filas: [], cajas: 0, pesoKg: 0, cbmChina: 0, cbmFactura: 0, precios: [] };
      embarquesPorRemitente.set(remitente, e);
      if (remitente.split("-").length < 3) {
        avisos.push(`Fila ${fila.filaExcel}: el Remitente «${remitente}» no trae número de embarque; el envío se llamará igual que la marca.`);
      }
    } else if (e.clave !== marca.clave) {
      throw new Error(`Fila ${fila.filaExcel}: el Remitente ${remitente} ya estaba asociado a ${e.clave} y ahora aparece con ${marca.clave}`);
    }
    e.filas.push(f);
    e.cajas += num(f.cajas);
    e.pesoKg += num(f.pesoKg);
    e.cbmChina += num(f.cbmChina);
    e.cbmFactura += num(f.cbmFactura);
    if (!e.precios.includes(num(f.precioCbm))) e.precios.push(num(f.precioCbm));
  }

  const embarques = [...embarquesPorRemitente.values()].map((e) => ({
    ...e,
    pesoKg: round2(e.pesoKg),
    cbmChina: round3(e.cbmChina),
    cbmFactura: round3(e.cbmFactura),
  }));
  for (const e of embarques) {
    if (e.pesoKg === 0) avisos.push(`El embarque ${e.remitente} viene sin peso (0 kg).`);
    if (e.cbmFactura === 0) avisos.push(`El embarque ${e.remitente} viene sin CBM a factura (0 m³).`);
  }

  const clientesPorClave = new Map<string, Cliente>();
  for (const e of embarques) {
    let c = clientesPorClave.get(e.clave);
    if (!c) {
      const marca = interpretarMarca(e.filas[0].marcaTexto, e.remitente);
      const manual = mapa[marca.clave] ?? mapa[`${marca.prefijo}-${marca.numero}`];
      if (manual) marca.candidatos = [manual, ...marca.candidatos.filter((x) => x !== manual)];
      c = { clave: e.clave, marca, embarques: [], cajas: 0, pesoKg: 0, cbmFactura: 0, lineas: [], base: 0, excesoPeso: 0 };
      clientesPorClave.set(e.clave, c);
    }
    c.embarques.push(e);
    c.cajas += e.cajas;
    c.pesoKg = round2(c.pesoKg + e.pesoKg);
    c.cbmFactura = round3(c.cbmFactura + e.cbmFactura);
    if (e.precios.length > 1) {
      avisos.push(`El embarque ${e.remitente} mezcla precios por m³ (${e.precios.join(", ")}): sale una línea por precio.`);
    }
    for (const precio of e.precios) {
      const cbm = round4(e.filas.filter((f) => num(f.precioCbm) === precio).reduce((s, f) => s + num(f.cbmFactura), 0));
      if (precio === 0) avisos.push(`El embarque ${e.remitente} tiene ${cbm} m³ a $0: la línea sale en $0 para revisarla.`);
      c.lineas.push({ desc: `Flete DDP · ${e.remitente} · ${cbm} m³ × $${precio}`, qty: cbm, unitPrice: precio });
    }
    for (const f of e.filas) {
      if (num(f.valorKgExtra) <= 0) continue;
      let linea: LineaFactura;
      if (num(f.extraKg) > 0 && num(f.precioKgExtra) > 0) {
        linea = {
          desc: `Exceso de peso · ${e.remitente} · ${f.descripcion || "sin descripción"} · ${round2(f.extraKg)} kg × $${f.precioKgExtra}`,
          qty: round2(f.extraKg),
          unitPrice: num(f.precioKgExtra),
        };
      } else {
        avisos.push(`Fila ${f.filaExcel}: valor $ kg extra ${f.valorKgExtra} sin kilos o precio por kg; se cobra como importe fijo.`);
        linea = { desc: `Exceso de peso · ${e.remitente} · ${f.descripcion || "sin descripción"}`, qty: 1, unitPrice: round2(f.valorKgExtra) };
      }
      c.excesoPeso = baseDeLineas([{ desc: "", qty: c.excesoPeso, unitPrice: 1 }, linea]);
      if (excesoPeso) c.lineas.push(linea);
    }
  }
  const clientes = [...clientesPorClave.values()].map((c) => ({
    ...c,
    base: baseDeLineas(c.lineas),
  }));

  const totales: Totales = {
    filas: filasUtiles.length,
    embarques: embarques.length,
    clientes: clientes.length,
    cajas: embarques.reduce((s, e) => s + e.cajas, 0),
    pesoKg: round2(embarques.reduce((s, e) => s + e.pesoKg, 0)),
    cbmChina: round3(embarques.reduce((s, e) => s + e.cbmChina, 0)),
    cbmFactura: round3(embarques.reduce((s, e) => s + e.cbmFactura, 0)),
    base: round2(clientes.reduce((s, c) => s + c.base, 0)),
    excesoPeso: round2(clientes.reduce((s, c) => s + c.excesoPeso, 0)),
    totalFacturadoExcel: round2(filasUtiles.reduce((s, f) => s + num(f.totalFacturado), 0)),
  };
  if (totales.excesoPeso > 0) {
    avisos.push(
      excesoPeso
        ? `Excesos de peso: $${totales.excesoPeso.toFixed(2)} en líneas aparte (el «TOTAL FACTURADO» del Excel no los incluye). Para no cobrarlos, generar con --sin-exceso-peso.`
        : `Excesos de peso por $${totales.excesoPeso.toFixed(2)} NO se facturan (--sin-exceso-peso).`,
    );
  }
  const diferencia = round2(totales.base - (excesoPeso ? totales.excesoPeso : 0) - totales.totalFacturadoExcel);
  if (Math.abs(diferencia) > 0.01) {
    avisos.push(`La base de flete calculada no coincide con Σ TOTAL FACTURADO del Excel: diferencia $${diferencia.toFixed(2)} (filas con precio distinto o fórmulas sin resultado).`);
  }
  const totalesExcel = descartadas.filter((d) => num(d.cajas) >= totales.cajas * 0.5).sort((a, b) => num(b.cajas) - num(a.cajas))[0];
  if (totalesExcel) {
    const dCajas = totales.cajas - num(totalesExcel.cajas);
    const dCbm = round3(totales.cbmFactura - num(totalesExcel.cbmFactura));
    const dKg = round2(totales.pesoKg - num(totalesExcel.pesoKg));
    if (dCajas !== 0 || Math.abs(dCbm) > 0.001 || Math.abs(dKg) > 0.01) {
      avisos.push(
        `La fila de totales del Excel (fila ${totalesExcel.filaExcel}) dice ${totalesExcel.cajas} cajas, ${round3(num(totalesExcel.cbmFactura))} m³ y ${round2(num(totalesExcel.pesoKg))} kg; el lote suma ${totales.cajas} cajas, ${totales.cbmFactura} m³ y ${totales.pesoKg} kg (diferencia ${dCajas} cajas, ${dCbm} m³, ${dKg} kg). Suele ser un rango de SUM que no cubre todas las filas; revisar.`,
      );
    }
  }
  if (embarques.length === 0 && modalidad !== "fcl") throw new Error("El packing list no trae filas con Remitente.");
  if (dueno && clientes.some((c) => c.clave === dueno!.marca.clave)) {
    throw new Error(`El dueño ${dueno.marca.clave} también aparece como cliente DDP del packing list; decide con Sam cómo cargarlo.`);
  }

  return { rastreo, modalidad, dueno, gastoEspacio, fechaCarga, fechaRecepcion, etd, eta: opciones.eta, excesoPeso, clientes, embarques, filas: filasUtiles, totales, avisos };
}
