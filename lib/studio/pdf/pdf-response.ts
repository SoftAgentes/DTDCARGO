/**
 * SDD-0281 · Plomería compartida de los route handlers que sirven un PDF.
 *
 * Los tres documentos del carril comercial (factura del Studio, factura del
 * portal, estimado) responden igual: renderizan a buffer y devuelven
 * `application/pdf` con cabeceras de documento privado. Extraído para que las
 * cabeceras no se puedan desincronizar entre rutas — un `Cache-Control` que se
 * olvide en UNA ruta es una factura ajena cacheada en un proxy.
 *
 * No incluye el guard de permisos a propósito: cada ruta decide su propio gate
 * (RBAC del módulo en el Studio, markbox del cliente en el portal) y eso NO se
 * puede esconder detrás de un helper compartido.
 */

import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";

/**
 * Sanea un código de documento para meterlo en `Content-Disposition`. Un
 * `invoice_code` sale de la DB, pero el nombre de archivo viaja en una cabecera
 * HTTP: cualquier cosa fuera de `[A-Za-z0-9_-]` se cae.
 */
export function nombreSeguro(code: string): string {
  return String(code).replace(/[^A-Za-z0-9_-]/g, "");
}

/**
 * Renderiza el documento y lo devuelve como respuesta.
 *
 * `inline` abre el PDF en el visor del navegador (lo que quiere quien revisa);
 * `attachment` fuerza la descarga. El default es `inline` porque es lo que hace
 * el resto del ERP (SDD-0117) y porque el visor igual ofrece guardar.
 *
 * `private, no-store` no es decorativo: estos documentos llevan plata y datos
 * del cliente, y sin esto un proxy compartido puede servirle a un cliente la
 * factura de otro.
 */
export async function respuestaPdf(
  doc: ReactElement<DocumentProps>,
  opciones: { nombreArchivo: string; disposicion?: "inline" | "attachment" },
): Promise<Response> {
  const buffer = await renderToBuffer(doc);
  const disp = opciones.disposicion ?? "inline";
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disp}; filename="${opciones.nombreArchivo}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * El 404 de estas rutas. Deliberadamente sin detalle: no distingue "no existe"
 * de "no es tuya" de "no tienes permiso". Distinguirlos le confirmaría a
 * cualquiera qué códigos de factura existen.
 */
export function noEncontrado(que: string): Response {
  return new Response(`${que} no encontrado.`, {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}
