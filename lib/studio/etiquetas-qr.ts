/**
 * QR de las etiquetas por cartón — URL escaneable a /verificar (SDD-0100).
 *
 * Reemplaza el QR mock visual de SDD-0031 por un destino REAL: cada caja
 * codifica su Shipping Mark + caja/total, así el QR es único por cartón.
 * `/verificar` (SDD-0097, ya en prod) confirma que el MARKBOX pertenece a un
 * envío DTD sin exponer datos del cliente; `n` (caja/total) viaja para
 * trazabilidad y lo sanea la propia página.
 *
 * Lógica pura (sin React) → testeable. La consume
 * `app/studio/(app)/etiquetas/_components/Label.tsx`.
 */

// Base pública del QR. Misma resolución que el QR del proveedor en /p/[token]:
// SITE_URL si está, si no el dominio canónico.
const VERIFY_BASE =
  process.env.NEXT_PUBLIC_SITE_URL || "https://dtdcargo.com";

/**
 * URL escaneable de la etiqueta: `<base>/verificar?c=<markbox>&n=<caja>/<total>`.
 *
 * `boxCode` (SDD-0152) es OPCIONAL y solo lo lleva la etiqueta del HUB, que se
 * imprime DESPUÉS de recibir — ahí ya existe `warehouse_boxes.code` y el QR
 * puede identificar LA CAJA, no solo al cliente. La etiqueta del proveedor se
 * imprime antes de que la caja exista, así que nunca lo tiene.
 *
 * Un solo QR sirve a los dos usos: `/verificar` (público) ignora `b`, y el
 * operario lo lee al estibar. No expone nada nuevo: el código ya va impreso en
 * la etiqueta que está pegada a la caja.
 */
export function labelVerifyUrl(
  markbox: string,
  boxIndex: number,
  totalBoxes: number,
  boxCode?: string | null,
): string {
  const c = encodeURIComponent(markbox.trim());
  const base = `${VERIFY_BASE}/verificar?c=${c}&n=${boxIndex}/${totalBoxes}`;
  const b = (boxCode ?? "").trim();
  return b ? `${base}&b=${encodeURIComponent(b)}` : base;
}

// ── Lectura del QR al estibar (SDD-0152) ──────────────────────

/**
 * Qué acaba de escanear el operario.
 *
 * Conviven DOS etiquetas físicas y NO son intercambiables:
 *  · La del proveedor (`/studio/etiquetas`, SDD-0031) se imprime ANTES de que la
 *    caja llegue, así que codifica `?c=<markbox>&n=<caja>/<total>` — identifica
 *    al cliente, no a la caja: dos envíos del mismo cliente tienen ambos una
 *    "caja 1/12".
 *  · La del hub (SDD-0152) lleva `warehouse_boxes.code` (DTD-B-NNNNNN), que sí
 *    es único.
 *
 * Distinguirlas importa: sin esto, escanear la etiqueta del proveedor devuelve
 * "esa caja no existe", que manda al operario a buscar un problema inexistente.
 */
export type ScannedLabel =
  | { kind: "box_code"; code: string }
  | { kind: "verify_url"; markbox: string; boxIndex: number | null; totalBoxes: number | null }
  | { kind: "unknown"; raw: string };

const BOX_CODE_RE = /^DTD-B-\d{4,}$/i;

/**
 * ¿Es un código de caja del hub? Vive acá y no en las server actions porque en
 * un archivo `"use server"` TODO export debe ser async (Turbopack lo rechaza en
 * build, aunque tsc lo deje pasar).
 */
export function isBoxCode(code: string): boolean {
  return BOX_CODE_RE.test((code ?? "").trim());
}

export function parseScannedLabel(raw: string): ScannedLabel {
  const s = (raw ?? "").trim();
  if (!s) return { kind: "unknown", raw: s };

  // 1. El código del hub, pelado.
  if (BOX_CODE_RE.test(s)) return { kind: "box_code", code: s.toUpperCase() };

  // 2. Una URL: puede ser la del proveedor (/verificar?c=&n=) o una futura que
  //    lleve el código en `b`.
  if (/^https?:\/\//i.test(s)) {
    try {
      const url = new URL(s);
      const b = url.searchParams.get("b");
      if (b && BOX_CODE_RE.test(b.trim())) {
        return { kind: "box_code", code: b.trim().toUpperCase() };
      }
      const c = url.searchParams.get("c");
      if (c) {
        const n = url.searchParams.get("n"); // "3/12"
        const [idx, total] = (n ?? "").split("/");
        return {
          kind: "verify_url",
          markbox: c.trim().toUpperCase(),
          boxIndex: Number.isFinite(Number(idx)) && idx !== "" ? Number(idx) : null,
          totalBoxes: Number.isFinite(Number(total)) && total !== "" ? Number(total) : null,
        };
      }
    } catch {
      // URL inválida → cae a unknown
    }
  }

  return { kind: "unknown", raw: s };
}
