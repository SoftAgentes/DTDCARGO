// @vitest-environment node
/**
 * SDD-0559 · La radiografía de integridad contable, corrida de verdad en PostgreSQL embebido.
 *
 * `scripts/qa/radiografia-integridad.sql` es el MISMO archivo que el Director pasa por stdin a
 * psql en el VPS. Acá corre en PGlite sobre `scripts/qa/radiografia-integridad.fixture.sql`, que
 * aplica las migraciones REALES de las tablas que lee y siembra diecisiete tenants trampa. El
 * esquema completo (las ~480 migraciones) lo cubre el paso de `scripts/check-schema-rebuild.mjs`.
 *
 * Una sola fuente de verdad (E5): los valores esperados y los mutantes viven en este archivo.
 * Cada esperado se revisó a mano contra lo que siembra la fixture; el comentario de cada fila
 * dice qué documentos la producen. Cada mutante reproduce una definición equivocada (la de la
 * consulta del Director o la de una regla nueva) y se afirma sobre TODAS las filas que cambia y
 * sólo sobre ellas.
 *
 * Privacidad (E9): la salida sólo puede traer sus cinco columnas, con literales, enums cerrados,
 * años y conteos; la fixture siembra CENTINELA en cada texto y la prueba exige que no aparezca ni
 * que un valor tenga forma de monto. Controles rojos: proyectar `client_name`, quitar la máscara
 * de montos y agregar una sexta columna con el monto crudo hacen fallar la revisión.
 *
 * Solo lectura: la forma psql exige la transacción de solo lectura de punta a punta (ningún
 * control de transacción en el medio) y la revisión estática, ninguna palabra que escriba.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const QA = resolve(ROOT, "scripts/qa");
const leer = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const SCRIPT = leer(resolve(QA, "radiografia-integridad.sql"));
const FIXTURE = leer(resolve(QA, "radiografia-integridad.fixture.sql"));
const MARCA_DATOS = "-- ── datos sintéticos ──";
const MARCA_MONTOS = "MONTOS-NO-VA-A-GIT · ";
/** La última sentencia de la cabecera de la transacción: ahí se inyectan los controles rojos de forma. */
const ANCLA = "set local lock_timeout = '5s';\n";
const SLOW = 240_000;

const TRUE = /^(t|true|on|y|yes|1)$/i;
const FALSE = /^(f|false|off|n|no|0)$/i;

/**
 * psql → SQL plano con las metaórdenes que usan el script y la fixture: \set, \if :{?v} / :v,
 * \else, \endif e \ir (relativo a `dir`). Cualquier otra metaorden lanza.
 * Copia de lib/studio/__tests__/cobro-factura-atomico.migration.test.ts, sobre texto.
 */
function inline(text: string, dir: string, vars: Record<string, string> = {}): string {
  const state: Record<string, string> = { ...vars };
  const out: string[] = [];
  function run(source: string, base: string) {
    const stack: { active: boolean; taken: boolean }[] = [];
    const active = () => stack.every((frame) => frame.active);
    for (const line of source.split(/\r?\n/)) {
      const meta = line.match(/^\\(\w+)\s*(.*)$/);
      if (!meta) {
        if (active()) out.push(line);
        continue;
      }
      const [, command, rest] = meta;
      if (command === "if") {
        let taken = false;
        if (active()) {
          const defined = rest.match(/^:\{\?(\w+)\}$/);
          const value = defined ? String(defined[1] in state)
            : rest.trim().startsWith(":") ? String(state[rest.trim().slice(1)]) : rest.trim();
          if (!TRUE.test(value) && !FALSE.test(value)) throw new Error("\\if no booleano: " + rest);
          taken = TRUE.test(value);
        }
        stack.push({ active: taken, taken });
      } else if (command === "else") {
        const frame = stack[stack.length - 1];
        frame.active = !frame.taken;
      } else if (command === "endif") {
        stack.pop();
      } else if (!active()) {
        continue;
      } else if (command === "set") {
        const [name, value] = rest.trim().split(/\s+/);
        if (name !== "ON_ERROR_STOP") state[name] = value;
      } else if (command === "ir") {
        const path = resolve(base, rest.trim());
        run(leer(path), dirname(path));
      } else {
        throw new Error("metaorden psql no soportada: \\" + command);
      }
    }
    if (stack.length > 0) throw new Error("\\if sin cerrar");
  }
  run(text, dir);
  return out.join("\n");
}

type Fila = { orden: number; seccion: string; indicador: string; n: number | string; monto_usd: unknown };

/** Las filas que agrupan (una por estado, moneda, origen o año): su clave lleva el indicador. */
const GRUPOS = new Set([20, 30, 70, 120]);
const clave = (orden: number, indicador: string) => (GRUPOS.has(orden) ? `${orden}|${indicador}` : `${orden}`);

/**
 * Lo que da la radiografía sobre la fixture, en modo conteos. [orden, indicador, n].
 * Revisado a mano, fila por fila, contra la fixture.
 */
const ESPERADO: readonly [number, string, number][] = [
  [10, "tenants con movimiento", 16], // A-N, P, S y T menos F (P entra por sus asientos: FP1 está borrada)
  [11, "facturas", 46], // A 23 (F21 borrada no) + B3 C2 E1 G1 H2 I2 J2 K2 M3 N1 P1 S2 T1 (FP3 borrador; FP1 borrada no)
  [12, "asientos asentados vivos", 81], // A 39 + B3 C1 D1 E5 G4 H1 I2 J9 K3 L2 N1 P4 S4 T2 (ver la fila 30)
  [13, "recibos vivos", 25], // A 16 (R5 R9 R19 R20 anulados) + RB1 RB2 RG1 RI1 RJ1 RK1 RK2 RN1 RT1 (RS1 anulado)
  [14, "reportes de pago", 7], // P1 P2 P4 P5 P6 P7 P8 (P3 borrado)
  [15, "cuentas por pagar", 19], // BA1-BA5 (BA6 borrada), BB1-BB4, BE1, BG1 BG2, BI1, BJ1, BL1, BM1 BM2, BP1, BS1
  [16, "pagos a proveedor vivos", 5], // OP1 OP3 OPB1 OPJ1 OPL1 (OP2 y OPS1 anulados)
  [20, "facturas · anulada · USD", 5], // F4 F5 F16 F17 FM2
  [20, "facturas · anulada · VES", 2], // FJ2 FB2
  [20, "facturas · borrador · CNY", 1], // F23
  [20, "facturas · borrador · USD", 2], // F9 FM1
  [20, "facturas · borrador · USDT", 1], // F24
  [20, "facturas · borrador · VES", 1], // FP3, con su asiento de venta vivo (SDD-0563)
  [20, "facturas · emitida · CNY", 1], // F19
  [20, "facturas · emitida · USD", 10], // F1 F13 F25 FC1 FC2 FH1 FI1 FK1 FS1 FS2
  [20, "facturas · emitida · USDT", 1], // F8
  [20, "facturas · emitida · VES", 3], // F20 FE1 FH2
  [20, "facturas · pagada · USD", 2], // F11 FM3
  [20, "facturas · pagada · VES", 6], // F7 FB3 FG1 FK2 FN1 FT1
  [20, "facturas · parcial · USD", 9], // F2 F3 F10 F12 F14 F15 F18 FB1 FJ1
  [20, "facturas · parcial · VES", 1], // FI2
  [20, "facturas · vencida · USD", 1], // F6
  [21, "facturas no borrador en VES/CNY sin tasa", 3], // F7 (nula), F19 CNY (nula), F20 (0); F23 es borrador
  [22, "facturas no borrador en USDT sin tasa (informativa)", 1], // F8; F24 es borrador
  [23, "facturas en VES/CNY con asiento de venta vivo", 5], // FE1 FG1 FI2 (AFI2, sin líneas) FJ2 FP3 (borrador)
  [24, "recibos vivos en VES/CNY con asiento de cobro vivo", 6], // RG1 RI1 RK1 RK2 RN1 RT1 (RS1 anulado; RB2 sin asiento)
  [30, "asientos · anulado · receipt", 3], // AR3 AR8 AR14V
  [30, "asientos · anulado · supplier_bill", 2], // ABA3 ABB2
  [30, "asientos · asentado · invoice", 26], // A 12 + AFB1 AFC2 AFE1 AFG1 AFH1 AFI2 AFJ1A AFJ1B AFJ2 AFK1 AFP1 AFP2 AFP3 AFS1 (AX13 borrado)
  [30, "asientos · asentado · manual", 8], // M1 U1 MBA1 MOP1 MD1 M2 ME2 ME3
  [30, "asientos · asentado · otro", 1], // U2, origen libre CENTINELA
  // A 12 (AR1 AR2 AR4 AR5 AR6 AR10 AR11 AR12 AR14 AR15 AR18 AR21) + ARB1 ARG1 ARI1 ARJ1A ARJ1B ARK1 ARK2 ARN1
  // ARS1 ART1 (AR15V AR16 borrados)
  [30, "asientos · asentado · receipt", 22],
  [30, "asientos · asentado · receipt_reclass", 4], // AR9 AR11X AR21X ART1X
  [30, "asientos · asentado · referral_credit", 3], // AQ1 AQ3 AQ5
  [30, "asientos · asentado · supplier_bill", 11], // ABA1 ABA4 ABB1 ABE1 ABG1 ABG2 ABJ1A ABJ1B ABL1 ABP1 ABS1
  [30, "asientos · asentado · supplier_payment", 6], // AOP1 AOP2 AOPJ1A AOPJ1B AOPL1 AOPS1
  [30, "asientos · borrador · invoice", 1], // AF4
  [30, "asientos · borrador · manual", 1], // MB1
  [30, "asientos · borrador · receipt", 1], // AR17
  [40, "facturas anuladas con asiento de venta vivo", 4], // F5 F16 F17 FJ2 (F4 sólo en borrador; FB2 y FM2 sin asiento)
  [41, "  de ellas con abonos (cobrado o recibo vivo)", 2], // F16 (recibo R12), F17 (cobrado); F5 sólo tiene R19 anulado
  [42, "recibos anulados con asiento de cobro vivo", 2], // R5 RS1
  [43, "recibos anulados con asiento de reclasificación vivo", 1], // R9
  [44, "cuentas por pagar anuladas con asiento vivo", 4], // BA4 BG1 BG2 BP1
  [45, "pagos a proveedor anulados con asiento vivo", 2], // OP2 OPS1
  [46, "asientos de crédito de referido vivos sin crédito aplicado", 2], // AQ3 (Q3 revertido) AQ5 (sin referral_id ni applied_entry_id)
  [47, "asientos de venta vivos cuya factura está borrada o no existe", 2], // AFP1 (FP1 borrada) AFP2 (sin invoice_id)
  // A 7 (F2 F3 F6 F7 F13 F19 F20) + FB3 FC1 FH2 FI1 FK2 FM3 FN1 FS2 FT1 (FI2 tiene AFI2)
  [50, "facturas emitidas, parciales, pagadas o vencidas sin asiento de venta vivo", 16],
  [51, "recibos vivos sin asiento de cobro vivo", 6], // R3 R8 R13 R16 R17 RB2
  [52, "  de ellos con vínculo a un asiento anulado", 2], // R3 R8 (R16 apunta a uno borrado y R17 a un borrador)
  [53, "recibos vivos con asiento de cobro vivo pero sin vínculo", 1], // R4
  // R10 RI1 RK2; R11 y RT1 la tienen por receipt_id, y R21 por journal_entry_id
  [54, "recibos vivos identificados sin asiento de reclasificación vivo", 3],
  [55, "cuentas por pagar vivas sin asiento vivo", 6], // BA2 BA5 BB3 BB4 BI1 BM2
  [56, "pagos a proveedor vivos sin asiento vivo", 2], // OP3 OPB1
  [57, "créditos de referido aplicados sin asiento vivo", 1], // Q2 (Q1 tiene AQ1 por applied_entry_id; Q4 borrado)
  // R14 (AR14V anulado), R15 (AR15V borrado) y R21 (AR21X, una reclasificación viva: de otro origen)
  [58, "recibos vivos con asiento de cobro vivo y el vínculo a otro asiento (anulado, borrado o de otro origen)", 3],
  [60, "facturas con más de un asiento de venta vivo", 1], // FJ1
  [61, "recibos con más de un asiento de cobro vivo", 1], // RJ1
  [62, "cuentas por pagar con más de un asiento vivo", 1], // BJ1 (MBA1 es manual)
  [63, "pagos a proveedor con más de un asiento vivo", 1], // OPJ1 (MOP1 es manual)
  [70, "reportes · cancelado", 1], // P7
  [70, "reportes · confirmado", 4], // P1 P5 P6 P8
  [70, "reportes · rechazado", 1], // P4
  [70, "reportes · reportado", 1], // P2
  [71, "confirmados (ninguno crea recibo ni asiento)", 4], // P1 P5 P6 P8
  [72, "  de ellos en otra moneda que su factura", 1], // P5 (VES sobre F10 en USD)
  [73, "  de ellos con un recibo vivo del mismo monto en su factura", 1], // P6 = R3 (P1 = R20, anulado)
  // F2 F4 F14 F18 FB1 FB3 FG1 FI2 FJ1 FK2 FN1 FT1, y F25: cobrado 0 = recibos 0, con el reporte P8
  [80, "facturas con cobrado igual a sus recibos vivos", 13],
  [81, "facturas con cobrado mayor que sus recibos vivos", 8], // F3 F7 F10 F11 F12 F15 F17 FM3
  [82, "facturas con cobrado menor que sus recibos vivos", 2], // F13 F16
  [83, "facturas con cobrado igual a recibos + reportes confirmados + créditos de referido", 16], // la 80 − F25 + F3 F10 F12 F15
  [84, "facturas con cobrado mayor que sus tres fuentes", 4], // F7 F11 F17 FM3
  [85, "facturas con cobrado menor que sus tres fuentes", 3], // F13 F16 F25
  [86, "facturas anuladas con cobrado", 2], // F4 F17
  [87, "facturas sin cobrado ni fuentes", 23], // A 9 (F1 F5 F6 F8 F9 F19 F20 F23 F24) + FB2 FC1 FC2 FE1 FH1 FH2 FI1 FJ2 FK1 FM1 FM2 FP3 FS1 FS2
  [90, "tenants sin movimiento en el mayor (facturas abiertas, 1.1.2 sin asientos vivos)", 1], // I
  // A (F19 F20) y H (FH2), abiertas en VES/CNY sin asiento, desde la SDD-0563; P no, porque FP3 es borrador
  [91, "tenants no comparables (factura abierta en VES/CNY, o factura no borrador o recibo con factura en VES/CNY con asiento vivo)", 7], // A E G H J N T
  [92, "tenants sin movimiento en la cuenta (0 contra 0)", 2], // L M
  [93, "tenants que cuadran", 2], // B K
  [94, "tenants con el mayor por encima de las facturas abiertas", 2], // D (subcuenta 1.1.2.1) P (huérfanos y el borrador FP3)
  [95, "tenants con el mayor por debajo de las facturas abiertas", 2], // C S
  [96, "  de los que cuadran o no, con facturas abiertas en VES/CNY fuera de la suma", 0], // control: desde la SDD-0563 son no comparables
  [97, "asientos manuales vivos que tocan 1.1.2", 4], // M1 MD1 M2 ME2 (MB1 en borrador)
  [100, "tenants sin movimiento en el mayor (cuentas por pagar abiertas, 2.1.1 sin asientos vivos)", 1], // I
  [101, "tenants no comparables (cuenta por pagar o pago en VES/CNY con asiento vivo)", 2], // E (BE1) L (OPL1)
  [102, "tenants sin movimiento en la cuenta (0 contra 0)", 7], // C D H K M N T
  [103, "tenants que cuadran", 1], // B
  [104, "tenants con el mayor por encima de las cuentas por pagar", 3], // G (anuladas) J (duplicados) P (BP1 anulada sin tasa)
  [105, "tenants con el mayor por debajo de las cuentas por pagar", 2], // A S
  [106, "  de los que cuadran o no, con cuentas por pagar abiertas en VES/CNY fuera de la suma", 1], // A (BA5)
  [110, "asientos asentados con debe distinto de haber", 1], // U1
  [111, "asientos asentados con menos de dos líneas", 2], // U2 AFI2
  [120, "año 2025", 1], // F7
  [120, "año 2026", 39], // las 41 no borrador − F7 − F11
  [121, "sin fecha de emisión", 1], // F11
  [130, "asientos vivos que tocan 4.5", 29], // 25 de factura (AFI2 no tiene líneas) + M1 U1 MD1 (4.5.1) ME2 (4.5 y 4.5.1, una vez)
  [131, "asientos vivos que tocan 2.1.5", 2], // M2 (2.1.5.1) ME3 (2.1.5 y 2.1.5.1, una vez)
];

/** Modo montos: las seis filas con monto, todas de documentos en USD o USDT. */
const MONTOS_ESPERADOS: Record<string, string> = {
  "40": "850.85", // F5 + F16 + F17 (FJ2 en VES no suma)
  "50": "1542.71", // F2 F3 F6 F13 FC1 FI1 FM3 FS2
  "51": "65.46", // R3 + R8 + R13 + R16 + R17
  "71": "127.46", // P1 + P6 + P8 (P5 en VES no suma)
  "84": "231.14", // F11 + F17 + FM3 (F7 en VES no suma)
  "85": "55.38", // F13 + F16 + F25 (el reporte P8 contra cobrado 0)
};
/** La cabecera del SQL dice el número en letras. */
const EN_LETRAS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"];

const SECCIONES = new Set([
  "0 · tamaño",
  "1 · documentos por estado y moneda",
  "2 · asientos por estado y origen",
  "3 · B1 documentos anulados con asiento vivo",
  "4 · B3 documentos sin asiento vivo",
  "5 · documentos con más de un asiento vivo de su origen",
  "6 · B4 reportes de pago",
  "7 · cobrado contra sus fuentes",
  "8 · 1.1.2 mayor contra facturas abiertas",
  "9 · 2.1.1 mayor contra cuentas por pagar",
  "10 · B16 partida doble",
  "11 · B5 facturas no borrador por año de emisión",
  "12 · 4.5 ingresos y 2.1.5 IVA del mayor",
]);
const ORIGENES = "manual|invoice|receipt|receipt_reclass|supplier_bill|supplier_payment|expense|claim|depreciacion|"
  + "referral_credit|nomina_settlement|supplier_charge|currency_conversion|supplier_claim_offset|otro";
const INDICADORES_DE_GRUPO = [
  /^facturas · (borrador|emitida|parcial|pagada|vencida|anulada) · (USD|VES|USDT|CNY)$/,
  new RegExp(`^asientos · (borrador|asentado|anulado) · (${ORIGENES})$`),
  /^reportes · (reportado|confirmado|rechazado|cancelado)$/,
  /^año \d{4}$/,
];
const INDICADORES = new Set(ESPERADO.filter(([orden]) => !GRUPOS.has(orden)).map(([, indicador]) => indicador));

/** Las columnas de la salida, en su orden. Ninguna más. */
const COLUMNAS = ["orden", "seccion", "indicador", "n", "monto_usd"];
/** Un valor con forma de monto: un número con decimales, o su texto. */
const conFormaDeMonto = (x: unknown) =>
  (typeof x === "number" && !Number.isInteger(x)) || (typeof x === "string" && /^-?\d+\.\d+$/.test(x));

/** Lo que una salida no puede traer. Vacío = cumple. */
function violaciones(filas: Fila[], modo: "conteos" | "montos"): string[] {
  const v = new Set<string>();
  for (const f of filas) {
    if (Object.keys(f).join(",") !== COLUMNAS.join(",")) v.add("columnas fuera de la forma");
    if (!/^\d+$/.test(String(f.n))) v.add("n no entero");
    if (modo === "conteos" && f.monto_usd !== null) v.add("monto en conteos");
    if (modo === "conteos" && Object.values(f).some(conFormaDeMonto)) v.add("valor con forma de monto");
    let seccion = String(f.seccion);
    if (modo === "montos") {
      if (!seccion.startsWith(MARCA_MONTOS)) v.add("sección sin la marca de montos");
      seccion = seccion.slice(MARCA_MONTOS.length);
    }
    if (!SECCIONES.has(seccion)) v.add("sección fuera del vocabulario");
    if (!INDICADORES.has(f.indicador) && !INDICADORES_DE_GRUPO.some((re) => re.test(f.indicador))) {
      v.add("indicador fuera del vocabulario");
    }
    if (/centinela/i.test(JSON.stringify(f))) v.add("centinela");
  }
  return [...v].sort();
}

const aMapa = (filas: Fila[]) => {
  const m = new Map<string, number>();
  for (const f of filas) m.set(clave(Number(f.orden), f.indicador), Number(f.n));
  return m;
};
const BASE = new Map(ESPERADO.map(([orden, indicador, n]) => [clave(orden, indicador), n]));

/** Las filas que cambian respecto del esperado: clave → n nuevo (null si la fila desaparece). */
function cambios(filas: Fila[]): Record<string, number | null> {
  const otro = aMapa(filas);
  const out: Record<string, number | null> = {};
  for (const k of new Set([...BASE.keys(), ...otro.keys()])) {
    if (BASE.get(k) !== otro.get(k)) out[k] = otro.get(k) ?? null;
  }
  return out;
}

/** El script con un único cambio; falla si el texto a cambiar no aparece exactamente una vez. */
function mutar(de: string, a: string): string {
  const partes = SCRIPT.split(de);
  expect(partes, `el texto del mutante aparece ${partes.length - 1} veces`).toHaveLength(2);
  return partes.join(a);
}

type Mutante = { nombre: string; de: string; a: string; cambia: Record<string, number | null> };

/** Las definiciones de la consulta del Director (2026-10-18) que la radiografía corrige. */
const MUTANTES_DEL_DIRECTOR: Mutante[] = [
  {
    nombre: "vivo = no anulado (cuenta los borradores)",
    de: "where je.deleted_at is null and je.status = 'asentado'",
    a: "where je.deleted_at is null and je.status::text <> 'anulado'",
    // AF4 (borrador de F4), MB1 (borrador manual de B) y AR17 (borrador del cobro de R17) pasan a
    // vivos: A y B quedan por encima; R17 deja de estar sin asiento.
    cambia: { "12": 84, "40": 5, "41": 3, "51": 5, "93": 1, "94": 3, "97": 5, "130": 31 },
  },
  {
    nombre: "asiento de factura sin filtrar el origen",
    de: "(select count(*) from je_vivo j where j.source = 'invoice' and j.invoice_id = i.id) as asientos",
    a: "(select count(*) from je_vivo j where j.invoice_id = i.id) as asientos",
    // F3 queda «con asiento» por el crédito AQ1; F15 suma AQ3 y AQ5 y sale duplicada.
    cambia: { "50": 15, "60": 2 },
  },
  {
    nombre: "recibo sin asiento = recibo sin vínculo",
    de: "from rec where vivo and asientos = 0\n",
    a: "from rec where vivo and not con_vinculo\n",
    // R3 R8 R16 R17 (vínculo a asientos que no son vivos) dejan de contar; entra R4 (asiento sin
    // vínculo); R13 y RB2 siguen.
    cambia: { "51": 3 },
  },
  {
    nombre: "cuentas por pagar abiertas con las anuladas",
    de: "        and not b.anulada and b.moneda in ('USD', 'USDT')),",
    a: "        and b.moneda in ('USD', 'USDT')),",
    // B suma BB2 y queda por debajo; A (BA3, BA4) ya estaba por debajo; G suma BG1 y sigue por
    // encima; BP1 (P) está en CNY y no suma.
    cambia: { "103": 0, "105": 3 },
  },
  {
    nombre: "facturas abiertas sin 'vencida'",
    de: "i.status::text in ('emitida', 'parcial', 'pagada', 'vencida') as abierta",
    a: "i.status::text in ('emitida', 'parcial', 'pagada') as abierta",
    // F6 sale de «sin asiento» y de la suma de A, que pasa a quedar por encima.
    cambia: { "50": 15 }, // F6 (A, por F19 y F20, ya es no comparable)
  },
  {
    nombre: "sin tasa cuenta USDT",
    de: "estado <> 'borrador' and moneda not in ('USD', 'USDT')\n       and (fx_rate is null or fx_rate <= 0)), null",
    a: "estado <> 'borrador' and moneda <> 'USD'\n       and (fx_rate is null or fx_rate <= 0)), null",
    cambia: { "21": 4 }, // F8 (F24 es borrador)
  },
  {
    nombre: "partida doble con join interno",
    de: "  left join public.journal_lines l on l.entry_id = j.id\n  group by j.id",
    a: "  join public.journal_lines l on l.entry_id = j.id\n  group by j.id",
    cambia: { "111": 0 }, // U2 y AFI2 desaparecen
  },
];

/** Las reglas nuevas: cada una tiene su trampa en la fixture. */
const MUTANTES_DE_REGLAS: Mutante[] = [
  {
    nombre: "sin tasa sólo en VES",
    de: "estado <> 'borrador' and moneda not in ('USD', 'USDT')\n       and (fx_rate is null or fx_rate <= 0)), null",
    a: "estado <> 'borrador' and moneda = 'VES'\n       and (fx_rate is null or fx_rate <= 0)), null",
    cambia: { "21": 2 }, // F19 en CNY
  },
  {
    nombre: "sin tasa sin la tasa cero",
    de: "moneda not in ('USD', 'USDT')\n       and (fx_rate is null or fx_rate <= 0))",
    a: "moneda not in ('USD', 'USDT')\n       and fx_rate is null)",
    cambia: { "21": 2 }, // F20 con tasa 0
  },
  {
    nombre: "sin tasa con los borradores",
    de: "(select count(*) from fac where estado <> 'borrador' and moneda not in ('USD', 'USDT')",
    a: "(select count(*) from fac where moneda not in ('USD', 'USDT')",
    cambia: { "21": 4 }, // F23, borrador CNY sin tasa
  },
  {
    nombre: "USDT sin tasa con los borradores",
    de: "(select count(*) from fac where estado <> 'borrador' and moneda = 'USDT'",
    a: "(select count(*) from fac where moneda = 'USDT'",
    cambia: { "22": 2 }, // F24, borrador USDT sin tasa
  },
  {
    nombre: "año de emisión con los borradores",
    de: "from fac where estado <> 'borrador' and issued_at is not null group by",
    a: "from fac where issued_at is not null group by",
    cambia: { "120|año 2026": 40 }, // F23, borrador con fecha
  },
  {
    nombre: "cobrado sin los créditos de referido",
    de: "x.recibos + x.reportes + x.creditos as fuentes",
    a: "x.recibos + x.reportes as fuentes",
    cambia: { "83": 14, "84": 6 }, // F3 y F15
  },
  {
    nombre: "cobrado igual a los recibos cuenta el 0 contra 0",
    de: "where paid_amount = recibos and (paid_amount > 0 or fuentes > 0))",
    a: "where paid_amount = recibos)",
    cambia: { "80": 36 }, // las 23 de la fila 87
  },
  {
    nombre: "cobrado igual a los recibos sin mirar las fuentes",
    de: "where paid_amount = recibos and (paid_amount > 0 or fuentes > 0))",
    a: "where paid_amount = recibos and paid_amount > 0)",
    cambia: { "80": 12 }, // F25: cobrado 0 y recibos 0, con el reporte P8 (la partición pierde una factura)
  },
  {
    nombre: "cobrado igual a las tres fuentes cuenta el 0 contra 0",
    de: "where paid_amount = fuentes and paid_amount > 0)",
    a: "where paid_amount = fuentes)",
    cambia: { "83": 39 }, // las 23 de la fila 87
  },
  {
    nombre: "sin cobrado ni fuentes sin mirar las fuentes",
    de: "where paid_amount = 0 and fuentes = 0)",
    a: "where paid_amount = 0)",
    cambia: { "87": 26 }, // F13 y F16, con un recibo vivo, y F25, con el reporte P8
  },
  {
    nombre: "1.1.2 sin subcuentas",
    de: "a.code = '1.1.2' or a.code like '1.1.2.%' as es_cxc",
    a: "a.code = '1.1.2' as es_cxc",
    // D (1.1.2.1) pierde su movimiento: 0 contra 0. MD1 deja de contar como manual en 1.1.2;
    // ME2 sigue por su línea en 1.1.2 (y E sigue no comparable).
    cambia: { "92": 3, "94": 1, "97": 3 },
  },
  {
    nombre: "2.1.1 sin subcuentas",
    de: "a.code = '2.1.1' or a.code like '2.1.1.%' as es_cxp",
    a: "a.code = '2.1.1' as es_cxp",
    cambia: { "104": 2, "105": 3 }, // J pierde ABJ1B (2.1.1.1) y queda por debajo
  },
  {
    nombre: "4.5 sin subcuentas",
    de: "a.code = '4.5' or a.code like '4.5.%' as es_ingreso",
    a: "a.code = '4.5' as es_ingreso",
    cambia: { "130": 28 }, // MD1 (4.5.1); ME2 sigue por su línea en 4.5
  },
  {
    nombre: "2.1.5 sin subcuentas",
    de: "a.code = '2.1.5' or a.code like '2.1.5.%' as es_iva",
    a: "a.code = '2.1.5' as es_iva",
    cambia: { "131": 1 }, // M2 (2.1.5.1); ME3 sigue por su línea en 2.1.5
  },
  {
    nombre: "manuales en 1.1.2 contados por línea",
    de: "(select count(distinct entry_id) from lin where es_cxc and source = 'manual')",
    a: "(select count(entry_id) from lin where es_cxc and source = 'manual')",
    cambia: { "97": 5 }, // ME2 tiene dos líneas en 1.1.2
  },
  {
    nombre: "4.5 contado por línea",
    de: "(select count(distinct entry_id) from lin where es_ingreso)",
    a: "(select count(entry_id) from lin where es_ingreso)",
    cambia: { "130": 30 }, // ME2 tiene dos líneas en 4.5
  },
  {
    nombre: "2.1.5 contado por línea",
    de: "(select count(distinct entry_id) from lin where es_iva)",
    a: "(select count(entry_id) from lin where es_iva)",
    cambia: { "131": 3 }, // ME3 tiene dos líneas en 2.1.5
  },
  {
    nombre: "la reclasificación se da por hecha con cualquier asiento de cobro",
    de: "where j.source = 'receipt_reclass'",
    a: "where j.source in ('receipt', 'receipt_reclass')",
    // R5 y RS1 entran en la 43; R10, RI1 y RK2 salen de la 54, y RK2 vuelve no comparable a K.
    cambia: { "43": 3, "54": 0, "91": 8, "93": 1 },
  },
  {
    nombre: "reclasificación unida sólo por el lado del asiento",
    de: "(select count(*) from je_vivo j where j.source = 'receipt_reclass'\n"
      + "           and (j.id = r.journal_entry_id or j.receipt_id = r.id)) as reclasificaciones",
    a: "(select count(*) from je_vivo j where j.source = 'receipt_reclass'\n"
      + "           and j.receipt_id = r.id) as reclasificaciones",
    cambia: { "54": 4 }, // R21: AR21X no lleva receipt_id, solo la une su journal_entry_id
  },
  {
    nombre: "reclasificación unida sólo por el lado del documento",
    de: "(select count(*) from je_vivo j where j.source = 'receipt_reclass'\n"
      + "           and (j.id = r.journal_entry_id or j.receipt_id = r.id)) as reclasificaciones",
    a: "(select count(*) from je_vivo j where j.source = 'receipt_reclass'\n"
      + "           and j.id = r.journal_entry_id) as reclasificaciones",
    // R9 sale de la 43; R11 y RT1 entran en la 54, y T, sin su reclasificación, queda por debajo.
    cambia: { "43": 0, "54": 5, "91": 6, "95": 3 },
  },
  {
    nombre: "anuladas con abonos sin el recibo vivo",
    de: "(paid_amount > 0 or con_recibo)",
    a: "(paid_amount > 0)",
    cambia: { "41": 1 }, // F16
  },
  {
    nombre: "anuladas con abonos sin el cobrado",
    de: "(paid_amount > 0 or con_recibo)",
    a: "(con_recibo)",
    cambia: { "41": 1 }, // F17
  },
  {
    nombre: "anuladas con abonos aunque el recibo esté anulado",
    de: "where r.invoice_id = i.id and r.deleted_at is null) as con_recibo",
    a: "where r.invoice_id = i.id) as con_recibo",
    cambia: { "41": 3 }, // F5, cuyo único recibo (R19) está anulado
  },
  {
    nombre: "reporte con un recibo del mismo monto aunque esté anulado",
    de: "                  and r.deleted_at is null and r.amount = p.amount) as recibo_mismo_monto",
    a: "                  and r.amount = p.amount) as recibo_mismo_monto",
    cambia: { "73": 2 }, // P1 = R20, anulado
  },
  {
    nombre: "vínculo a un asiento anulado sin su filtro",
    de: "from rec where vivo and asientos = 0 and vinculo_anulado)",
    a: "from rec where vivo and asientos = 0)",
    cambia: { "52": 6 }, // R13 R16 R17 RB2
  },
  {
    nombre: "vínculo a un asiento anulado: cualquier asiento",
    de: "where e.id = r.journal_entry_id\n                  and e.status = 'anulado') as vinculo_anulado",
    a: "where e.id = r.journal_entry_id) as vinculo_anulado",
    cambia: { "52": 4 }, // R16 (borrado) y R17 (borrador)
  },
  {
    nombre: "vínculo viejo sólo si el asiento está anulado",
    de: "asientos > 0 and con_vinculo and not vinculo_vivo",
    a: "asientos > 0 and con_vinculo and vinculo_anulado",
    cambia: { "58": 1 }, // R15 (AR15V borrado) sale
  },
  {
    nombre: "vínculo viejo sin exigir el asiento de cobro vivo",
    de: "asientos > 0 and con_vinculo and not vinculo_vivo",
    a: "con_vinculo and not vinculo_vivo",
    cambia: { "58": 7 }, // entran R3 R8 R16 R17, que no tienen asiento
  },
  {
    nombre: "vínculo viejo: un asiento vivo de otro origen cuenta como vínculo vivo",
    de: "exists (select 1 from je_vivo j where j.source = 'receipt' and j.id = r.journal_entry_id) as vinculo_vivo",
    a: "exists (select 1 from je_vivo j where j.id = r.journal_entry_id) as vinculo_vivo",
    cambia: { "58": 2 }, // R21, cuyo vínculo es su reclasificación AR21X
  },
  {
    nombre: "decisión 7: no comparable por saldo abierto en VES/CNY (regla del prototipo)",
    de: "     exists (select 1 from fac f where f.tenant_id = m.tenant_id and f.estado <> 'borrador'\n"
      + "               and f.moneda not in ('USD', 'USDT') and f.asientos > 0)\n"
      + "       or exists (select 1 from rec r where r.tenant_id = m.tenant_id and r.vivo and r.con_factura\n"
      + "                    and (not r.identificado or r.reclasificaciones > 0)\n"
      + "                    and r.moneda not in ('USD', 'USDT') and r.asientos > 0),",
    a: "     exists (select 1 from fac f where f.tenant_id = m.tenant_id and f.abierta\n"
      + "               and f.moneda not in ('USD', 'USDT') and f.total_amount <> f.paid_amount),",
    // G (VES pagada, asentada al nominal) y J (FJ2 anulada ya no cuenta) salen por encima, y T
    // (FT1 pagada) y N (FN1 pagada, su recibo ya no cuenta) por debajo. Quedan A y H, que desde
    // la SDD-0563 entran por `fuera`, y E por el saldo de FE1.
    cambia: { "91": 3, "94": 4, "95": 4 },
  },
  {
    nombre: "decisión 7: no comparable sin exigir el asiento de la factura",
    de: "               and f.moneda not in ('USD', 'USDT') and f.asientos > 0)",
    a: "               and f.moneda not in ('USD', 'USDT'))",
    // B (FB2 FB3) y K (FK2) pasan a no comparables; A y H ya lo eran, y F23 y FP3 son borradores.
    cambia: { "91": 9, "93": 0 },
  },
  {
    nombre: "decisión 7: no comparable sin los recibos",
    de: "               and f.moneda not in ('USD', 'USDT') and f.asientos > 0)\n"
      + "       or exists (select 1 from rec r where r.tenant_id = m.tenant_id and r.vivo and r.con_factura\n"
      + "                    and (not r.identificado or r.reclasificaciones > 0)\n"
      + "                    and r.moneda not in ('USD', 'USDT') and r.asientos > 0),",
    a: "               and f.moneda not in ('USD', 'USDT') and f.asientos > 0),",
    // N y T quedan por debajo.
    cambia: { "91": 5, "95": 4 },
  },
  {
    nombre: "decisión 7: no comparable sin exigir el asiento del recibo",
    de: "and r.moneda not in ('USD', 'USDT') and r.asientos > 0),",
    a: "and r.moneda not in ('USD', 'USDT')),",
    cambia: { "91": 8, "93": 1 }, // B, por RB2: VES, vivo, con factura y sin asiento
  },
  {
    nombre: "decisión 7: no comparable con los recibos sin referencia",
    de: "r.tenant_id = m.tenant_id and r.vivo and r.con_factura\n",
    a: "r.tenant_id = m.tenant_id and r.vivo\n",
    cambia: { "91": 8, "93": 1 }, // K, por RK1: su asiento va a 2.1.8
  },
  {
    nombre: "decisión 7: no comparable con el recibo identificado sin reclasificar",
    de: "\n                    and (not r.identificado or r.reclasificaciones > 0)",
    a: "",
    cambia: { "91": 8, "93": 1 }, // K, por RK2: su asiento va a 2.1.8 (RI1 está en I, que no se mueve)
  },
  {
    nombre: "decisión 7: no comparable sin los identificados ya reclasificados",
    de: "(not r.identificado or r.reclasificaciones > 0)",
    a: "(not r.identificado)",
    cambia: { "91": 6, "95": 3 }, // T, cuyo único recibo VES se reclasificó a 1.1.2
  },
  {
    nombre: "decisión 7: no comparable sólo con los recibos reclasificados",
    de: "(not r.identificado or r.reclasificaciones > 0)",
    a: "(r.reclasificaciones > 0)",
    cambia: { "91": 6, "95": 3 }, // N, cuyo recibo VES se aplicó al cobrar (G sigue por FG1)
  },
  {
    nombre: "decisión 7: no comparable con los recibos anulados",
    de: "r.tenant_id = m.tenant_id and r.vivo and r.con_factura\n",
    a: "r.tenant_id = m.tenant_id and r.con_factura\n",
    cambia: { "91": 8, "95": 1 }, // S (RS1 anulado con su asiento vivo)
  },
  {
    nombre: "decisión 7: no comparable sin las facturas anuladas",
    de: "     exists (select 1 from fac f where f.tenant_id = m.tenant_id and f.estado <> 'borrador'\n"
      + "               and f.moneda not in ('USD', 'USDT') and f.asientos > 0)",
    a: "     exists (select 1 from fac f where f.tenant_id = m.tenant_id and f.estado <> 'borrador' and f.estado <> 'anulada'\n"
      + "               and f.moneda not in ('USD', 'USDT') and f.asientos > 0)",
    cambia: { "91": 6, "94": 3 }, // J (FJ2 anulada al nominal) queda por encima
  },
  {
    nombre: "SDD-0563: el borrador con asiento de venta vivo vuelve no comparable la 1.1.2",
    de: "where f.tenant_id = m.tenant_id and f.estado <> 'borrador'\n",
    a: "where f.tenant_id = m.tenant_id\n",
    cambia: { "91": 8, "94": 1 }, // P, por FP3: borrador VES con AFP3 vivo
  },
  {
    nombre: "SDD-0563: la factura abierta en VES/CNY sin asiento no vuelve no comparable la 1.1.2 (regla anterior)",
    de: " or (cuenta = '1.1.2' and fuera) then",
    a: " then",
    // H (FH2) vuelve a cuadrar y A (F19 F20) queda por debajo; los dos, con facturas fuera de la suma.
    cambia: { "91": 5, "93": 3, "95": 3, "96": 2 },
  },
  {
    nombre: "SDD-0563: la cuenta por pagar abierta en VES/CNY también vuelve no comparable la 2.1.1",
    de: "(cuenta = '1.1.2' and fuera)",
    a: "fuera",
    cambia: { "101": 3, "105": 1, "106": 0 }, // A, por BA5: la enmienda es solo de 1.1.2
  },
  {
    nombre: "decisión 6: «no comparable» antes que el mayor vacío",
    de: "         case when debe = 0 and haber = 0 and abiertos > 0 then 'sin movimiento en el mayor'\n"
      + "              when no_comparable or (cuenta = '1.1.2' and fuera) then 'no comparable'\n",
    a: "         case when no_comparable or (cuenta = '1.1.2' and fuera) then 'no comparable'\n"
      + "              when debe = 0 and haber = 0 and abiertos > 0 then 'sin movimiento en el mayor'\n",
    cambia: { "90": 0, "91": 8 }, // I: FI2, VES, tiene un asiento de venta vivo, sin líneas
  },
  {
    nombre: "decisión 6: el mayor vacío sin exigir documentos abiertos",
    de: "case when debe = 0 and haber = 0 and abiertos > 0 then",
    a: "case when debe = 0 and haber = 0 then",
    cambia: { "90": 3, "92": 0, "100": 8, "102": 0 }, // L y M en 1.1.2; C D H K M N T en 2.1.1
  },
  {
    nombre: "decisión 6: facturas «abiertas» sin exigir que estén abiertas",
    de: "where f.tenant_id = m.tenant_id and f.abierta\n        and f.total_amount <> f.paid_amount),",
    a: "where f.tenant_id = m.tenant_id\n        and f.total_amount <> f.paid_amount),",
    cambia: { "90": 2, "92": 1 }, // M, por el borrador FM1 y la anulada FM2
  },
  {
    nombre: "decisión 6: facturas «abiertas» sin exigir saldo",
    de: "and f.abierta\n        and f.total_amount <> f.paid_amount),",
    a: "and f.abierta),",
    cambia: { "90": 2, "92": 1 }, // M, por la pagada FM3
  },
  {
    nombre: "decisión 6: cuentas por pagar «abiertas» con las anuladas",
    de: "(select count(*) from cxp b where b.tenant_id = m.tenant_id and not b.anulada\n",
    a: "(select count(*) from cxp b where b.tenant_id = m.tenant_id\n",
    cambia: { "100": 2, "102": 6 }, // M, por BM1
  },
  {
    nombre: "decisión 6: cuentas por pagar «abiertas» sin exigir saldo",
    de: "and not b.anulada\n        and b.total_amount <> b.paid_amount),",
    a: "and not b.anulada),",
    cambia: { "100": 2, "102": 6 }, // M, por la pagada BM2
  },
  {
    nombre: "0 contra 0 cuenta como «cuadra»",
    de: "              when debe = 0 and haber = 0 then 'sin movimiento en la cuenta'\n",
    a: "",
    cambia: { "92": 0, "93": 4, "102": 0, "103": 8 },
  },
  {
    nombre: "fuera de la suma sin exigir que la factura esté abierta",
    de: "exists (select 1 from fac f where f.tenant_id = m.tenant_id and f.abierta\n"
      + "               and f.moneda not in ('USD', 'USDT') and f.total_amount <> f.paid_amount)),",
    a: "exists (select 1 from fac f where f.tenant_id = m.tenant_id\n"
      + "               and f.moneda not in ('USD', 'USDT') and f.total_amount <> f.paid_amount)),",
    cambia: { "91": 9, "93": 1, "94": 1 }, // B (FB2 anulada) y P (FP3, borrador con saldo)
  },
  {
    nombre: "fuera de la suma sin exigir saldo en la factura",
    de: "               and f.moneda not in ('USD', 'USDT') and f.total_amount <> f.paid_amount)),",
    a: "               and f.moneda not in ('USD', 'USDT'))),",
    cambia: { "91": 9, "93": 0 }, // B (FB3) y K (FK2), pagadas
  },
  {
    nombre: "fuera de la suma sin exigir saldo en la cuenta por pagar",
    de: "and b.moneda not in ('USD', 'USDT') and b.total_amount <> b.paid_amount))",
    a: "and b.moneda not in ('USD', 'USDT')))",
    cambia: { "106": 2 }, // B, por BB3 pagada
  },
  {
    nombre: "2.1.1 no comparable sin los pagos",
    de: "               and b.moneda not in ('USD', 'USDT') and b.asientos > 0)\n"
      + "       or exists (select 1 from pag p where p.tenant_id = m.tenant_id and p.vivo\n"
      + "                    and p.moneda not in ('USD', 'USDT') and p.asientos > 0),",
    a: "               and b.moneda not in ('USD', 'USDT') and b.asientos > 0),",
    cambia: { "101": 1, "103": 2 }, // L cuadra
  },
  {
    nombre: "2.1.1 no comparable con los pagos anulados",
    de: "p.tenant_id = m.tenant_id and p.vivo\n",
    a: "p.tenant_id = m.tenant_id\n",
    cambia: { "101": 3, "105": 1 }, // S (OPS1 anulado con su asiento vivo)
  },
  {
    nombre: "2.1.1 no comparable sin exigir el asiento del pago",
    de: "and p.moneda not in ('USD', 'USDT') and p.asientos > 0),",
    a: "and p.moneda not in ('USD', 'USDT')),",
    cambia: { "101": 3, "103": 0 }, // B, por OPB1: VES, vivo y sin asiento
  },
  {
    nombre: "2.1.1 no comparable sin exigir el asiento de la cuenta por pagar",
    de: "               and b.moneda not in ('USD', 'USDT') and b.asientos > 0)",
    a: "               and b.moneda not in ('USD', 'USDT'))",
    cambia: { "101": 4, "103": 0, "105": 1, "106": 0 }, // A (BA5) y B (BB3), en CNY sin asiento
  },
  {
    nombre: "2.1.1 no comparable con las cuentas por pagar anuladas",
    de: "     exists (select 1 from cxp b where b.tenant_id = m.tenant_id and not b.anulada\n"
      + "               and b.moneda not in ('USD', 'USDT') and b.asientos > 0)",
    a: "     exists (select 1 from cxp b where b.tenant_id = m.tenant_id\n"
      + "               and b.moneda not in ('USD', 'USDT') and b.asientos > 0)",
    cambia: { "101": 4, "104": 1 }, // G (BG2, con tasa) y P (BP1, sin tasa)
  },
  {
    nombre: "fila 24 sin exigir que el recibo esté vivo",
    de: "from rec where vivo and moneda not in ('USD', 'USDT') and asientos > 0)",
    a: "from rec where moneda not in ('USD', 'USDT') and asientos > 0)",
    cambia: { "24": 7 }, // RS1
  },
  {
    nombre: "fila 24 sin exigir el asiento de cobro",
    de: "from rec where vivo and moneda not in ('USD', 'USDT') and asientos > 0)",
    a: "from rec where vivo and moneda not in ('USD', 'USDT'))",
    cambia: { "24": 7 }, // RB2, sin asiento
  },
  {
    nombre: "crédito de referido unido por la factura (el respaldo viejo)",
    de: "   and (j.referral_id = c.id or j.id = c.applied_entry_id)",
    a: "   and (j.referral_id = c.id or (j.referral_id is null and j.invoice_id = c.applied_invoice_id))",
    cambia: { "46": 1, "57": 0 }, // AQ5 y Q2, los dos en F15, se tapan entre sí
  },
  {
    nombre: "crédito de referido sin el lado del documento",
    de: "   and (j.referral_id = c.id or j.id = c.applied_entry_id)",
    a: "   and j.referral_id = c.id",
    cambia: { "46": 3, "57": 2 }, // AQ1 y Q1 se desconocen
  },
  {
    nombre: "créditos de referido borrados cuentan",
    de: "  from public.referrals c\n  where c.deleted_at is null",
    a: "  from public.referrals c",
    cambia: { "57": 2, "83": 15, "85": 4 }, // Q4 sobre F15
  },
  {
    nombre: "el reporte cancelado se cuenta como reportado",
    de: "case when p.cancelled_at is not null then 'cancelado' else p.status::text end as estado",
    a: "p.status::text as estado",
    cambia: { "70|reportes · reportado": 2, "70|reportes · cancelado": null },
  },
  {
    nombre: "recibo unido sólo por el lado del documento",
    de: "(select count(*) from je_vivo j where j.source = 'receipt'\n"
      + "           and (j.id = r.journal_entry_id or j.receipt_id = r.id)) as asientos",
    a: "(select count(*) from je_vivo j where j.source = 'receipt'\n"
      + "           and j.id = r.journal_entry_id) as asientos",
    // R4 sin asiento; R14, R15 y R21 (vínculo viejo) también, y R14 entra en la 52; RJ1 con uno.
    cambia: { "51": 10, "52": 3, "53": 0, "58": 0, "61": 0 },
  },
  {
    nombre: "recibo unido sólo por el lado del asiento",
    de: "(select count(*) from je_vivo j where j.source = 'receipt'\n"
      + "           and (j.id = r.journal_entry_id or j.receipt_id = r.id)) as asientos",
    a: "(select count(*) from je_vivo j where j.source = 'receipt'\n"
      + "           and j.receipt_id = r.id) as asientos",
    cambia: { "51": 7 }, // R18: su asiento no lleva receipt_id
  },
  {
    nombre: "el asiento unido por los dos lados cuenta dos veces",
    de: "(select count(*) from je_vivo j where j.source = 'receipt'\n"
      + "           and (j.id = r.journal_entry_id or j.receipt_id = r.id)) as asientos",
    a: "((select count(*) from je_vivo j where j.source = 'receipt' and j.id = r.journal_entry_id)\n"
      + "          + (select count(*) from je_vivo j where j.source = 'receipt' and j.receipt_id = r.id)) as asientos",
    // R1 R2 R6 R10 R11 R12 R5 RB1 RG1 RI1 RJ1 RK1 RK2 RN1 RS1 RT1: unidos por los dos lados.
    cambia: { "61": 16 },
  },
  {
    nombre: "cuenta por pagar unida sólo por el lado del asiento",
    de: "           and (j.id = b.journal_entry_id or j.bill_id = b.id)) as asientos",
    a: "           and j.bill_id = b.id) as asientos",
    cambia: { "62": 0 }, // BJ1: ABJ1A sólo está del lado del documento
  },
  {
    nombre: "cuenta por pagar sin filtrar el origen",
    de: "(select count(*) from je_vivo j where j.source = 'supplier_bill'\n",
    a: "(select count(*) from je_vivo j where true\n",
    cambia: { "62": 2 }, // BA1 suma el manual MBA1
  },
  {
    nombre: "pago unido sólo por el lado del asiento",
    de: "           and (j.id = p.journal_entry_id or j.supplier_payment_id = p.id)) as asientos",
    a: "           and j.supplier_payment_id = p.id) as asientos",
    cambia: { "63": 0 }, // OPJ1
  },
  {
    nombre: "pago sin filtrar el origen",
    de: "(select count(*) from je_vivo j where j.source = 'supplier_payment'\n",
    a: "(select count(*) from je_vivo j where true\n",
    cambia: { "63": 2 }, // OP1 suma el manual MOP1
  },
  {
    nombre: "asientos de venta huérfanos sin las facturas borradas",
    de: "where i.id = j.invoice_id and i.deleted_at is null)",
    a: "where i.id = j.invoice_id)",
    cambia: { "47": 1 }, // AFP1: FP1 existe, pero está borrada
  },
  {
    nombre: "asientos de venta huérfanos sin los que no tienen factura",
    de: "(select count(*) from je_vivo j where j.source = 'invoice'\n       and not exists",
    a: "(select count(*) from je_vivo j where j.source = 'invoice' and j.invoice_id is not null\n       and not exists",
    cambia: { "47": 1 }, // AFP2, sin invoice_id
  },
  {
    nombre: "facturas borradas cuentan",
    de: "  from public.invoices i\n  where i.deleted_at is null",
    a: "  from public.invoices i",
    // F21 (borrador) y FP1 (emitida, con su asiento AFP1): P sigue por encima.
    cambia: {
      "11": 48, "20|facturas · borrador · USD": 3, "20|facturas · emitida · USD": 11, "87": 25, "120|año 2026": 40,
    },
  },
  {
    nombre: "cuentas por pagar borradas cuentan",
    de: "  from public.supplier_bills b\n  where b.deleted_at is null",
    a: "  from public.supplier_bills b",
    cambia: { "15": 20, "55": 7 }, // BA6
  },
  {
    nombre: "asientos borrados cuentan como vivos",
    de: "where je.deleted_at is null and je.status = 'asentado'",
    a: "where je.status = 'asentado'",
    // AX13 da asiento a F13; AR15V es el segundo asiento de R15 y su vínculo deja de ser viejo;
    // AR16 da asiento a R16.
    cambia: { "12": 84, "50": 15, "51": 5, "58": 2, "61": 2, "130": 30 },
  },
];

/** La fuga: el nombre del cliente en un indicador. */
const FUGA = {
  de: "'facturas · ' || estado || ' · ' || moneda,",
  a: "'facturas · ' || estado || ' · ' || moneda || ' · ' || (select min(i.client_name) from public.invoices i),",
};
/** Quitar la máscara: el monto sale también en modo conteos. */
const SIN_MASCARA = {
  de: "then round(monto, 2) end as monto_usd",
  a: "then round(monto, 2) else round(monto, 2) end as monto_usd",
};
/** Una sexta columna con el monto crudo, fuera de la máscara (por ejemplo, para depurar). */
const SEXTA_COLUMNA = {
  de: "then round(monto, 2) end as monto_usd",
  a: "then round(monto, 2) end as monto_usd, monto as monto_crudo",
};

/** Columnas de texto del negocio y datos personales que el script no puede nombrar. */
const IDENTIFICADORES_PROHIBIDOS = new RegExp(
  "\\b(client_name|client_markbox|invoice_code|receipt_code|entry_code|bill_code|payment_code|referral_code|"
    + "supplier_code|supplier_name|memo|line_memo|reference|notes|note|name|name_cn|tax_id|email|phone|"
    + "payer_name|payer_relation|referrer_markbox|referred_[a-z_]+|proof_path|shipment_code|lines|concept|"
    + "contact_[a-z]+|display_name|slug|resolution_reason|cancelled_by|confirmed_by|billing_[a-z_]+)\\b",
  "gi",
);
/** Cualquier palabra que escribe, sin exigir su forma completa (un alias o `only` no la esconden). */
const ESCRITURA = /\b(insert|update|delete|merge|into|create|alter|drop|truncate|grant|revoke|copy|call|nextval|setval)\b/gi;
/**
 * El SQL sin comentarios, como los lee PostgreSQL: `--` hasta el fin de la línea y `/* … *\/`, que
 * se anidan. Las cadenas ('…', E'…' con sus escapes, "…" y $etiqueta$…$etiqueta$) quedan intactas,
 * para que un `/*` o un `--` dentro de una cadena no esconda lo que sigue. Conserva los saltos de
 * línea y deja un espacio donde había un comentario de bloque.
 */
function sinComentarios(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const dos = sql.slice(i, i + 2);
    if (dos === "--") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (dos === "/*") {
      let nivel = 0;
      do {
        if (sql.startsWith("/*", i)) { nivel++; i += 2; }
        else if (sql.startsWith("*/", i)) { nivel--; i += 2; }
        else { if (sql[i] === "\n") out += "\n"; i++; }
      } while (nivel > 0 && i < sql.length);
      out += " ";
    } else if (sql[i] === "'" || sql[i] === '"') {
      const comilla = sql[i];
      const escapes = comilla === "'" && /(^|[^\w$])[eE]$/.test(sql.slice(Math.max(0, i - 2), i));
      let j = i + 1;
      while (j < sql.length && sql[j] !== comilla) j += escapes && sql[j] === "\\" ? 2 : 1;
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (sql[i] === "$" && !/[\w$]/.test(sql[i - 1] ?? "") && /^\$(?:[A-Za-z_]\w*)?\$/.test(sql.slice(i))) {
      const etiqueta = /^\$(?:[A-Za-z_]\w*)?\$/.exec(sql.slice(i))![0];
      const fin = sql.indexOf(etiqueta, i + etiqueta.length);
      const hasta = fin < 0 ? sql.length : fin + etiqueta.length;
      out += sql.slice(i, hasta);
      i = hasta;
    } else {
      out += sql[i];
      i++;
    }
  }
  return out;
}
const hallazgos = (re: RegExp, texto: string) => [...new Set([...texto.matchAll(re)].map((m) => m[0].toLowerCase()))];

/**
 * Las sentencias que cierran, abren o cambian la transacción. Sólo valen la primera y la última.
 * `set [local|session] transaction read write` y `set [local|session] transaction_read_only = off`
 * vuelven de escritura la transacción si llegan antes de la primera consulta, y los `set local`
 * de la cabecera no toman instantánea (comprobado en PGlite).
 */
const CONTROL_DE_TRANSACCION = new RegExp(
  "^(commit|end|abort|rollback|begin|start\\s+transaction|savepoint|release|prepare\\s+transaction"
    + "|set\\s+(?:(?:local|session)\\s+)?(?:transaction|session\\s+characteristics|(?:default_)?transaction_read_only)"
    + "|reset\\s+(?:default_)?transaction_read_only)\\b",
  "i",
);

/** La forma que exige infra/ops/migraciones/aplicar.sh:114-117 a una lectura, y más. Vacío = cumple. */
function formaPsql(sql: string): string[] {
  const lineas = sql.split("\n");
  const utiles = lineas.filter((l) => l.trim() !== "" && !l.trim().startsWith("--"));
  const sentencias = utiles.filter((l) => !l.trim().startsWith("\\"));
  const problemas: string[] = [];
  if (utiles[0] !== "\\set ON_ERROR_STOP on") problemas.push("primera línea útil");
  if (sentencias[0] !== "begin transaction read only;") problemas.push("primera sentencia");
  if (lineas.filter((l) => l.trim() !== "").at(-1) !== "rollback;") problemas.push("última línea");
  // Una metaorden con sangría también la ejecuta psql; aquí sólo valen las cuatro, en la columna 0.
  for (const m of utiles.filter((l) => l.trim().startsWith("\\"))) {
    if (!/^\\(set|if|else|endif)\b/.test(m)) problemas.push("metaorden " + m.trim().split(/\s/)[0]);
  }
  // psql también lee una metaorden al final de una sentencia (`… \gexec`).
  const texto = sinComentarios(sentencias.join("\n"));
  if (texto.includes("\\")) problemas.push("metaorden dentro de una sentencia");
  // Entre la primera sentencia y el `rollback;` final, ningún control de transacción: un `commit;`
  // en el medio confirmaría lo que viene después fuera de la transacción de solo lectura. Los
  // comentarios se quitan antes de partir, para que `/* nota */ commit;` empiece por `commit`.
  const cuerpo = texto.split(";").map((s) => s.trim()).filter(Boolean);
  for (const s of cuerpo.slice(1, -1)) {
    const control = s.match(CONTROL_DE_TRANSACCION);
    if (control) problemas.push("control de transacción en el medio: " + control[1].toLowerCase().replace(/\s+/g, " "));
  }
  return problemas;
}

/** Filas de una salida en modo montos (la marca seguida del número de sección). */
const filasDeMontos = (texto: string) => texto.match(/MONTOS-NO-VA-A-GIT · \d+ · /g) ?? [];

function archivosDeTexto(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre === ".git") continue;
    const path = join(dir, nombre);
    if (statSync(path).isDirectory()) out.push(...archivosDeTexto(path));
    else if ([".md", ".txt", ".csv", ".json"].includes(extname(nombre).toLowerCase())) out.push(path);
  }
  return out;
}

describe("SDD-0559 · radiografía de integridad contable (PGlite)", () => {
  let db: PGlite;
  let vacio: Fila[] = [];
  const correr = async (sql: string, vars: Record<string, string> = {}) =>
    (await db.exec(inline(sql, QA, vars))).flatMap((r) => r.rows as Fila[]);

  beforeAll(async () => {
    db = new PGlite();
    const corte = FIXTURE.indexOf(MARCA_DATOS);
    expect(corte).toBeGreaterThan(0);
    await db.exec(inline(FIXTURE.slice(0, corte), QA));
    vacio = await correr(SCRIPT);
    await db.exec(inline(FIXTURE.slice(corte), QA));
  }, SLOW);

  afterAll(async () => {
    await db?.close();
  });

  it("sobre el esquema real vacío da sólo las filas fijas, todas en cero y sin monto", () => {
    const fijas = ESPERADO.filter(([orden]) => !GRUPOS.has(orden));
    expect(vacio).toHaveLength(fijas.length);
    expect(vacio.map((f) => clave(Number(f.orden), f.indicador)).sort()).toEqual(
      fijas.map(([orden, indicador]) => clave(orden, indicador)).sort(),
    );
    expect(vacio.every((f) => Number(f.n) === 0 && f.monto_usd === null)).toBe(true);
  });

  it("los conteos sobre la fixture son exactamente los esperados", async () => {
    const filas = await correr(SCRIPT);
    expect(filas).toHaveLength(ESPERADO.length);
    expect(Object.fromEntries(aMapa(filas))).toEqual(Object.fromEntries(BASE));
  });

  it("cada tenant con movimiento cae en un solo estado de 1.1.2 y de 2.1.1", async () => {
    const m = aMapa(await correr(SCRIPT));
    const suma = (desde: number) => [0, 1, 2, 3, 4, 5].reduce((s, i) => s + (m.get(String(desde + i)) ?? 0), 0);
    expect(suma(90)).toBe(m.get("10"));
    expect(suma(100)).toBe(m.get("10"));
  });

  it("cada factura cae en una sola fila del cobrado, contra los recibos y contra las tres fuentes", async () => {
    const m = aMapa(await correr(SCRIPT));
    const suma = (...filas: number[]) => filas.reduce((s, orden) => s + (m.get(String(orden)) ?? 0), 0);
    expect(suma(80, 81, 82, 87)).toBe(m.get("11"));
    expect(suma(83, 84, 85, 87)).toBe(m.get("11"));
  });

  it("modo conteos: sólo conteos, vocabulario cerrado y ningún CENTINELA", async () => {
    expect(violaciones(await correr(SCRIPT), "conteos")).toEqual([]);
  });

  it("modo montos: la marca en cada sección, los mismos conteos y seis montos de documentos en USD/USDT", async () => {
    const filas = await correr(SCRIPT, { montos: "on" });
    expect(violaciones(filas, "montos")).toEqual([]);
    expect(Object.fromEntries(aMapa(filas))).toEqual(Object.fromEntries(BASE));
    const montos = Object.fromEntries(
      filas.filter((f) => f.monto_usd !== null).map((f) => [String(f.orden), String(f.monto_usd)]),
    );
    expect(montos).toEqual(MONTOS_ESPERADOS);
    // La cabecera dice cuántas filas llevan monto: el número sale del mismo mapa que se afirma.
    expect(SCRIPT).toContain(`monto_usd trae sumas de ${EN_LETRAS[Object.keys(MONTOS_ESPERADOS).length]} filas`);
  });

  describe.each([
    ["de la consulta del Director", MUTANTES_DEL_DIRECTOR],
    ["de las reglas nuevas", MUTANTES_DE_REGLAS],
  ])("mutantes %s", (_grupo, lista) => {
    it.each(lista)("muere: $nombre", async (m) => {
      expect(cambios(await correr(mutar(m.de, m.a)))).toEqual(m.cambia);
    });
  });

  it("control rojo de privacidad: proyectar client_name aparece como CENTINELA", async () => {
    const filas = await correr(mutar(FUGA.de, FUGA.a));
    expect(violaciones(filas, "conteos")).toEqual(["centinela", "indicador fuera del vocabulario"]);
  });

  it("control rojo de privacidad: sin la máscara, el modo conteos trae montos", async () => {
    const filas = await correr(mutar(SIN_MASCARA.de, SIN_MASCARA.a));
    expect(violaciones(filas, "conteos")).toEqual(["monto en conteos", "valor con forma de monto"]);
  });

  it("control rojo de privacidad: una sexta columna con el monto crudo cambia la forma y trae montos", async () => {
    const filas = await correr(mutar(SEXTA_COLUMNA.de, SEXTA_COLUMNA.a));
    expect(violaciones(filas, "conteos")).toEqual(["columnas fuera de la forma", "valor con forma de monto"]);
  });

  it("estático: el script no nombra columnas de texto del negocio ni escribe", () => {
    const sql = sinComentarios(SCRIPT);
    expect(hallazgos(IDENTIFICADORES_PROHIBIDOS, sql)).toEqual([]);
    expect(hallazgos(ESCRITURA, sql)).toEqual([]);
    // Control: la fuga se detecta antes de correr nada.
    expect(hallazgos(IDENTIFICADORES_PROHIBIDOS, sinComentarios(mutar(FUGA.de, FUGA.a)))).toEqual(["client_name"]);
    // Control: la escritura se detecta con alias, con `only` y con comillas.
    expect(hallazgos(ESCRITURA, sinComentarios(mutar(ANCLA, ANCLA + "update public.invoices as i set paid_amount = i.paid_amount where false;\n"))))
      .toEqual(["update"]);
    expect(hallazgos(ESCRITURA, "update only public.invoices i set x = 1;\ndelete from \"invoices\" where false;"))
      .toEqual(["update", "delete"]);
  });

  it("forma psql de solo lectura: primera sentencia, último rollback y ningún control de transacción en el medio", () => {
    expect(formaPsql(SCRIPT)).toEqual([]);
    expect(formaPsql(mutar("begin transaction read only;", "begin;"))).toEqual(["primera sentencia"]);
    expect(formaPsql(mutar("rollback;\n", "commit;\n"))).toEqual(["última línea"]);
    for (const control of [
      "commit", "end", "abort", "rollback", "begin", "start transaction read only", "savepoint s", "release s",
      "prepare transaction 'x'", "set transaction read write", "set session characteristics as transaction read write",
      "set local transaction read write", "set session transaction read write",
      "set local transaction_read_only = off", "set session transaction_read_only = off",
      "set transaction_read_only = off", "reset transaction_read_only", "set default_transaction_read_only = off",
    ]) {
      const palabra = control.match(CONTROL_DE_TRANSACCION)?.[1].toLowerCase();
      expect(palabra, control).toBeTruthy();
      expect(formaPsql(mutar(ANCLA, ANCLA + control + ";\n")), control)
        .toEqual(["control de transacción en el medio: " + palabra]);
    }
    // Los `set local` de la cabecera no son controles.
    expect("set local statement_timeout = '60s'".match(CONTROL_DE_TRANSACCION)).toBeNull();
    // Un comentario delante no esconde el control: de bloque, anidado o en dos líneas.
    const commit = "control de transacción en el medio: commit";
    expect(formaPsql(mutar(ANCLA, ANCLA + "/* nota */ commit;\n"))).toEqual([commit]);
    expect(formaPsql(mutar(ANCLA, ANCLA + "/* a /* b */ c */ commit;\n"))).toEqual([commit]);
    expect(formaPsql(mutar(ANCLA, ANCLA + "/* nota\n   en dos líneas */ set local transaction_read_only = off;\n")))
      .toEqual(["control de transacción en el medio: set local transaction_read_only"]);
    // Ni una cadena que parece abrir un comentario: el control que sigue se ve igual.
    expect(formaPsql(mutar(ANCLA, ANCLA + "select '--'; commit;\n"))).toEqual([commit]);
    expect(formaPsql(mutar(ANCLA, ANCLA + "select '/*'; commit; select '*/';\n"))).toEqual([commit]);
    expect(formaPsql(mutar(ANCLA, ANCLA + "select \"/*\"; commit; select \"*/\";\n"))).toEqual([commit]);
    expect(formaPsql(mutar(ANCLA, ANCLA + "select $x$/*$x$; commit; select $x$*/$x$;\n"))).toEqual([commit]);
    expect(formaPsql(mutar(ANCLA, ANCLA + "select E'\\'/*'; commit; select '*/';\n")))
      .toEqual(["metaorden dentro de una sentencia", commit]);
    // El mutante de la revisión: commit, una escritura con alias y otra transacción.
    const mutante = mutar(ANCLA, ANCLA + "commit;\nupdate public.invoices as i set paid_amount = i.paid_amount where false;\n"
      + "start transaction read only;\n");
    expect(formaPsql(mutante)).toEqual([
      "control de transacción en el medio: commit", "control de transacción en el medio: start transaction",
    ]);
    expect(hallazgos(ESCRITURA, sinComentarios(mutante))).toEqual(["update"]);
    // Metaórdenes escondidas: con sangría o al final de una sentencia.
    expect(formaPsql(mutar(ANCLA, ANCLA + "  \\! echo x\n"))).toEqual(["metaorden \\!"]);
    expect(formaPsql(mutar(ANCLA, "set local lock_timeout = '5s' \\gexec\n"))).toEqual(["metaorden dentro de una sentencia"]);
  });

  it("la fixture se niega a correr sobre una base con objetos de aplicación", async () => {
    const guarda = FIXTURE.slice(FIXTURE.indexOf("do $guarda$"), FIXTURE.indexOf("$guarda$;") + "$guarda$;".length);
    await expect(db.exec(guarda)).rejects.toThrow(/fixture rechazada/);
  });

  // Lee todo docs/ y .agents/: bajo la carga de `pnpm verify` pasó del tope general de 20 s
  // (20940ms en el verify de la #287, 2026-10-19). Lleva el de las pruebas lentas.
  it("guarda de Git: ninguna salida en modo montos en docs/ ni en .agents/", () => {
    const conMontos = ["docs", ".agents"]
      .flatMap((d) => archivosDeTexto(resolve(ROOT, d)))
      .filter((path) => filasDeMontos(readFileSync(path, "utf8")).length > 0)
      .map((path) => relative(ROOT, path));
    expect(conMontos).toEqual([]);
    // Control: la misma función detecta una fila sintética en modo montos.
    expect(filasDeMontos("40|MONTOS-NO-VA-A-GIT · 3 · B1 documentos anulados con asiento vivo|x|1|1.00")).toHaveLength(1);
    expect(filasDeMontos("la marca `MONTOS-NO-VA-A-GIT · ` encabeza cada sección")).toHaveLength(0);
  }, SLOW);
});
