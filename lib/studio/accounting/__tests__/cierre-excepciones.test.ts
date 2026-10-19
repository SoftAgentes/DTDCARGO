// @vitest-environment node
/**
 * SDD-0566 · Lo puro del cierre con superclave: el aviso, los mensajes de cada
 * motivo de la RPC, las etiquetas del reporte y sus CSV.
 */
import { describe, expect, it } from "vitest";
import {
  describirEvento,
  excepcionesCsv,
  excepcionPosible,
  fechaCorta,
  fechaHoraCaracas,
  historialCsv,
  mensajeDeMotivo,
  pideSuperclave,
  textoAvisoCierre,
  type AvisoCierre,
  type ExcepcionAlCierre,
} from "../cierre-excepciones";

const CON_CLAVE: AvisoCierre = { closingDate: "2026-01-31", modo: "superclave", superclaveDefinida: true };
const SIN_CLAVE: AvisoCierre = { ...CON_CLAVE, superclaveDefinida: false };
const ADVERTENCIA: AvisoCierre = { closingDate: "2026-01-31", modo: "advertencia", superclaveDefinida: false };

describe("SDD-0566 · el aviso del período cerrado", () => {
  it("con superclave definida pide la superclave y el motivo, con la fecha en DD/MM/AAAA", () => {
    expect(textoAvisoCierre(CON_CLAVE)).toBe(
      "Este período ya cerró contablemente (cierre al 31/01/2026). Para cambiarlo, ingresa la superclave y el motivo.",
    );
    expect(pideSuperclave(CON_CLAVE)).toBe(true);
    expect(excepcionPosible(CON_CLAVE)).toBe(true);
  });

  it("sin superclave definida dice que el admin tiene que definirla, y no ofrece la excepción", () => {
    expect(textoAvisoCierre(SIN_CLAVE)).toContain("todavía no está definida: pídele al admin");
    expect(excepcionPosible(SIN_CLAVE)).toBe(false);
  });

  it("en modo advertencia pide solo el motivo", () => {
    expect(textoAvisoCierre(ADVERTENCIA)).toBe(
      "Este período ya cerró contablemente (cierre al 31/01/2026). Para cambiarlo, indica el motivo: el cambio queda en el reporte «Excepciones al cierre».",
    );
    expect(pideSuperclave(ADVERTENCIA)).toBe(false);
    expect(excepcionPosible(ADVERTENCIA)).toBe(true);
  });

  it("fechaCorta no se corre de día y no inventa una fecha", () => {
    expect(fechaCorta("2026-01-31")).toBe("31/01/2026");
    expect(fechaCorta("2026-01-31T23:59:59Z")).toBe("31/01/2026");
    expect(fechaCorta(null)).toBe("");
    expect(fechaCorta("31/01/2026")).toBe("");
  });
});

describe("SDD-0566 · qué decir con cada motivo de la RPC", () => {
  it("clave mala, bloqueada y sin superclave dicen qué hacer", () => {
    expect(mensajeDeMotivo("incorrecta", "anular")).toBe(
      "La superclave no es correcta. Revísala e intenta de nuevo: después de 5 intentos fallidos se bloquea 15 minutos.",
    );
    expect(mensajeDeMotivo("bloqueada", "anular")).toContain("bloqueada por intentos fallidos");
    expect(mensajeDeMotivo("sin_superclave", "crear")).toContain("pídele al admin");
  });

  it("el estado del asiento se dice según la operación", () => {
    expect(mensajeDeMotivo("estado", "anular")).toBe("Solo los asientos asentados pueden anularse.");
    expect(mensajeDeMotivo("estado", "eliminar")).toBe("Solo los borradores pueden eliminarse.");
    expect(mensajeDeMotivo("estado", "asentar")).toBe("Solo los borradores pueden asentarse.");
  });

  it("un motivo desconocido no inventa nada", () => {
    expect(mensajeDeMotivo("lo-que-sea", "asentar")).toBe("No se pudo asentar el asiento. Intenta de nuevo.");
    expect(mensajeDeMotivo("", "crear")).toBe("No se pudo crear el asiento. Intenta de nuevo.");
  });
});

describe("SDD-0566 · el reporte", () => {
  const excepcion: ExcepcionAlCierre = {
    id: "x1",
    entryId: "e1",
    entryCode: "A-2026-0001",
    entryDate: "2026-01-10",
    closingDate: "2026-01-31",
    operation: "anular",
    authorizedBy: "superclave",
    reason: "Corrección, con coma",
    amountBefore: 100,
    amountAfter: 0,
    userName: "Contadora",
    createdAt: "2026-02-03T14:05:00Z",
  };

  it("la hora va en Caracas (UTC−4), sin depender del huso del servidor", () => {
    expect(fechaHoraCaracas("2026-02-03T14:05:00Z")).toBe("03/02/2026 10:05");
    expect(fechaHoraCaracas("2026-02-03T02:30:00Z")).toBe("02/02/2026 22:30");
    expect(fechaHoraCaracas("no-es-fecha")).toBe("");
  });

  it("el CSV de excepciones trae el cambio, el usuario, la autorización y el antes y después", () => {
    const csv = excepcionesCsv([excepcion], new Date("2026-02-04T12:00:00Z"));
    expect(csv.filename).toBe("reporte-contable-excepciones-al-cierre-2026-02-04.csv");
    const [cabecera, fila] = csv.content.split("\r\n");
    expect(cabecera).toBe(
      "Cuándo (Caracas),Asiento,Fecha del asiento,Cierre,Cambio,Usuario,Autorización,Motivo,Monto antes,Monto después",
    );
    expect(fila).toBe('03/02/2026 10:05,A-2026-0001,10/01/2026,31/01/2026,Anulación,Contadora,Con superclave,"Corrección, con coma",100,0');
  });

  it("el historial dice qué pasó, sin el valor de la clave", () => {
    expect(describirEvento({ kind: "fecha_cambiada", oldValue: null, newValue: "2026-01-31" })).toBe(
      "Cerró el período al 31/01/2026",
    );
    expect(describirEvento({ kind: "fecha_cambiada", oldValue: "2026-01-31", newValue: "2026-02-28" })).toBe(
      "Movió el cierre del 31/01/2026 al 28/02/2026",
    );
    expect(describirEvento({ kind: "fecha_cambiada", oldValue: "2026-01-31", newValue: null })).toBe(
      "Reabrió el período (el cierre era al 31/01/2026)",
    );
    expect(describirEvento({ kind: "modo_cambiado", oldValue: "superclave", newValue: "advertencia" })).toBe(
      "Cambió el modo: de «Advertencia y superclave» a «Solo advertencia»",
    );
    expect(describirEvento({ kind: "superclave_cambiada", oldValue: null, newValue: null })).toBe("Cambió la superclave");
    const csv = historialCsv([
      { id: "h1", kind: "superclave_restablecida", oldValue: null, newValue: null, reason: "La olvidamos", userName: "Admin", createdAt: "2026-02-03T14:05:00Z" },
    ]);
    expect(csv.content.split("\r\n")[1]).toBe("03/02/2026 10:05,Restableció la superclave,Admin,La olvidamos");
  });
});
