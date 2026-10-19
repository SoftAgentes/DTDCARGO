/**
 * SDD-0566 · Cierre contable con superclave y reporte de excepciones (puro).
 *
 * Lo comparten el servidor (acciones) y el cliente (diálogo, cajón del cierre
 * y reporte): no importa nada de base de datos. La regla vive en la migración
 * 0493; esto solo dice, en palabras de la persona, qué pasó y qué hacer
 * (ERR-01), y arma las filas del reporte.
 */

import { reportFilename, rowsToCsv, type CsvValue, type ViewCsv } from "@/lib/studio/reports/export-csv";

export type ModoCierre = "superclave" | "advertencia";

/** Lo que la pantalla necesita para pedir la excepción. Nunca trae la clave. */
export type AvisoCierre = {
  closingDate: string;
  modo: ModoCierre;
  superclaveDefinida: boolean;
};

/** Los motivos con que las RPC de 0493 dicen que no hicieron el cambio. */
export type MotivoCierre =
  | "sin_superclave"
  | "bloqueada"
  | "incorrecta"
  | "no_cerrado"
  | "no_encontrado"
  | "estado"
  | "descuadre";

export type OperacionCierre = "crear" | "asentar" | "anular" | "eliminar";

/** Lo que la persona escribe para pedir la excepción. La superclave no se guarda en ningún lado. */
export type ExcepcionDelCierre = { superclave?: string | null; motivo: string };

/** Lo que devuelven asentar, anular y eliminar: con `cierre`, la pantalla pide la excepción. */
export type ResultadoDeAsiento = { ok?: boolean; error?: string; cierre?: AvisoCierre };

/** YYYY-MM-DD → DD/MM/AAAA, sin pasar por Date (no se corre de día). */
export function fechaCorta(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** El aviso que ve quien edita un período cerrado. */
export function textoAvisoCierre(aviso: AvisoCierre): string {
  const base = `Este período ya cerró contablemente (cierre al ${fechaCorta(aviso.closingDate)}).`;
  if (aviso.modo === "advertencia") {
    return `${base} Para cambiarlo, indica el motivo: el cambio queda en el reporte «Excepciones al cierre».`;
  }
  if (!aviso.superclaveDefinida) {
    return `${base} Para cambiarlo hace falta la superclave del cierre, y todavía no está definida: pídele al admin que la defina en Contabilidad › Cierre.`;
  }
  return `${base} Para cambiarlo, ingresa la superclave y el motivo.`;
}

/** ¿El diálogo pide la superclave? */
export function pideSuperclave(aviso: AvisoCierre): boolean {
  return aviso.modo === "superclave";
}

/** ¿Se puede pedir la excepción? Sin superclave definida, en modo superclave, no. */
export function excepcionPosible(aviso: AvisoCierre): boolean {
  return aviso.modo === "advertencia" || aviso.superclaveDefinida;
}

const QUE: Record<OperacionCierre, string> = {
  crear: "crear el asiento",
  asentar: "asentar el asiento",
  anular: "anular el asiento",
  eliminar: "eliminar el borrador",
};

/** Qué decirle a la persona cuando la RPC devolvió un motivo. */
export function mensajeDeMotivo(motivo: string, operacion: OperacionCierre): string {
  switch (motivo as MotivoCierre) {
    case "incorrecta":
      return "La superclave no es correcta. Revísala e intenta de nuevo: después de 5 intentos fallidos se bloquea 15 minutos.";
    case "bloqueada":
      return "La superclave está bloqueada por intentos fallidos. Intenta de nuevo en 15 minutos o pídele al admin que la restablezca.";
    case "sin_superclave":
      return "La superclave del cierre todavía no está definida: pídele al admin que la defina en Contabilidad › Cierre.";
    case "no_cerrado":
      return `El período ya no está cerrado. Vuelve a ${QUE[operacion]} sin la superclave.`;
    case "no_encontrado":
      return "Asiento no encontrado.";
    case "estado":
      return operacion === "anular"
        ? "Solo los asientos asentados pueden anularse."
        : operacion === "eliminar"
          ? "Solo los borradores pueden eliminarse."
          : "Solo los borradores pueden asentarse.";
    case "descuadre":
      return "El asiento no balancea o tiene menos de 2 líneas: corrígelo antes de asentarlo.";
    default:
      return `No se pudo ${QUE[operacion]}. Intenta de nuevo.`;
  }
}

// ── Reporte «Excepciones al cierre» ─────────────────────────────

export type ExcepcionAlCierre = {
  id: string;
  entryId: string;
  entryCode: string;
  entryDate: string;
  closingDate: string;
  operation: OperacionCierre;
  authorizedBy: ModoCierre;
  reason: string;
  amountBefore: number;
  amountAfter: number;
  userName: string;
  createdAt: string;
};

export type TipoEventoCierre =
  | "fecha_cambiada"
  | "modo_cambiado"
  | "superclave_definida"
  | "superclave_cambiada"
  | "superclave_restablecida"
  | "intento_fallido"
  | "superclave_bloqueada";

export type EventoDelCierre = {
  id: string;
  kind: TipoEventoCierre;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  userName: string;
  createdAt: string;
};

export const ETIQUETA_OPERACION: Record<OperacionCierre, string> = {
  crear: "Alta",
  asentar: "Asentado",
  anular: "Anulación",
  eliminar: "Borrado",
};

export const ETIQUETA_AUTORIZACION: Record<ModoCierre, string> = {
  superclave: "Con superclave",
  advertencia: "Con advertencia",
};

export const ETIQUETA_MODO: Record<ModoCierre, string> = {
  superclave: "Advertencia y superclave",
  advertencia: "Solo advertencia",
};

/** El evento del historial, en una frase. Nunca menciona el valor de la clave. */
export function describirEvento(e: Pick<EventoDelCierre, "kind" | "oldValue" | "newValue">): string {
  switch (e.kind) {
    case "fecha_cambiada":
      if (!e.newValue) return `Reabrió el período (el cierre era al ${fechaCorta(e.oldValue)})`;
      if (!e.oldValue) return `Cerró el período al ${fechaCorta(e.newValue)}`;
      return `Movió el cierre del ${fechaCorta(e.oldValue)} al ${fechaCorta(e.newValue)}`;
    case "modo_cambiado":
      return `Cambió el modo: de «${ETIQUETA_MODO[e.oldValue as ModoCierre] ?? e.oldValue}» a «${ETIQUETA_MODO[e.newValue as ModoCierre] ?? e.newValue}»`;
    case "superclave_definida":
      return "Definió la superclave";
    case "superclave_cambiada":
      return "Cambió la superclave";
    case "superclave_restablecida":
      return "Restableció la superclave";
    case "intento_fallido":
      return "Intento con una superclave incorrecta";
    case "superclave_bloqueada":
      return "La superclave se bloqueó 15 minutos por intentos fallidos";
  }
}

/** Hora de Caracas (UTC−4) para el reporte, sin depender del huso del servidor. */
export function fechaHoraCaracas(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t - 4 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function excepcionesCsv(filas: readonly ExcepcionAlCierre[], hoy?: Date): ViewCsv {
  const rows: CsvValue[][] = filas.map((x) => [
    fechaHoraCaracas(x.createdAt),
    x.entryCode,
    fechaCorta(x.entryDate),
    fechaCorta(x.closingDate),
    ETIQUETA_OPERACION[x.operation],
    x.userName,
    ETIQUETA_AUTORIZACION[x.authorizedBy],
    x.reason,
    x.amountBefore,
    x.amountAfter,
  ]);
  return {
    filename: reportFilename("contable-excepciones-al-cierre", hoy),
    content: rowsToCsv(
      [
        "Cuándo (Caracas)",
        "Asiento",
        "Fecha del asiento",
        "Cierre",
        "Cambio",
        "Usuario",
        "Autorización",
        "Motivo",
        "Monto antes",
        "Monto después",
      ],
      rows,
    ),
  };
}

export function historialCsv(filas: readonly EventoDelCierre[], hoy?: Date): ViewCsv {
  const rows: CsvValue[][] = filas.map((e) => [
    fechaHoraCaracas(e.createdAt),
    describirEvento(e),
    e.userName,
    e.reason ?? "",
  ]);
  return {
    filename: reportFilename("contable-historial-del-cierre", hoy),
    content: rowsToCsv(["Cuándo (Caracas)", "Qué pasó", "Usuario", "Motivo"], rows),
  };
}
