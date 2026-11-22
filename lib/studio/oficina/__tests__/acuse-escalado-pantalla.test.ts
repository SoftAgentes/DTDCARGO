/**
 * SDD-0626 · 0560 · La tarjeta de revisión y «Acuse» en los escalados (decisión del DG, 17/11/2026).
 *
 * - En un ESCALADO, «Acuse» nace en «No evaluado» y una línea lo explica: a Sam no se le pide marcarlo.
 * - En una RESPUESTA nada cambia: ninguna casilla nace marcada.
 * - El aviso junto a los botones dice lo que de verdad hace el conteo con «No evaluado» (frases aprobadas por el DG).
 * La regla del conteo la decide la base por el tipo del borrador (0560), no esta marca.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TarjetaBorrador } from "@/app/studio/(app)/admin/oficina-virtual/_components/TarjetaBorrador";
import { CASILLAS, type BorradorPendiente } from "@/lib/studio/oficina/revisiones";

const BASE: BorradorPendiente = {
  borradorId: "00000000-0000-4000-8000-000000000001",
  taskId: "00000000-0000-4000-8000-000000000002",
  tipo: "respuesta",
  texto: "Hola.",
  guion: "acuse-general",
  motivo: null,
  prioridad: null,
  creadoEn: "2026-11-17T12:00:00Z",
  conversacion: 17,
};

const pintar = (b: BorradorPendiente) => renderToStaticMarkup(createElement(TarjetaBorrador, { b, accion: () => {} }));

/** Las casillas «No evaluado» que nacen marcadas. */
function marcadas(html: string): string[] {
  return [...html.matchAll(/<input type="checkbox" name="(sin_[a-z_]+)"([^>]*)>/g)]
    .filter((m) => /\bchecked\b/.test(m[2]))
    .map((m) => m[1]);
}

const LINEA_ESCALADO = "En un escalado no hay respuesta al cliente: deja «Acuse» en «No evaluado»; no cuenta en contra.";
const AVISO =
  "Guardar sin marcas significa «revisé y cumple». Con algo en «No evaluado», la conversación no cuenta como correcta, salvo «Acuse» en un escalado. Rechazar exige marcar al menos un «Falló».";
const normalizar = (s: string) => s.replace(/\s+/g, " ");

describe("0560 · «Acuse» en la tarjeta de un escalado", () => {
  it("en un escalado, «Acuse» nace en «No evaluado» (y nada más) y la línea lo explica", () => {
    const html = pintar({ ...BASE, tipo: "escalado", texto: null, guion: null, motivo: "dinero", prioridad: 3 });
    expect(marcadas(html)).toEqual(["sin_acuse"]);
    expect(normalizar(html)).toContain(LINEA_ESCALADO);
    // Ninguna «Falló» nace marcada.
    expect(html).not.toMatch(/name="falla_[a-z_]+"[^>]*\bchecked\b/);
  });

  it("en una respuesta ninguna casilla nace marcada y no sale la línea del escalado", () => {
    const html = pintar(BASE);
    expect(marcadas(html)).toEqual([]);
    expect(normalizar(html)).not.toContain(LINEA_ESCALADO);
    for (const c of CASILLAS) expect(html).toContain(`name="sin_${c.clave}"`);
  });

  it("el aviso junto a los botones es el aprobado, y ya no dice que «No evaluado» no cuenta", () => {
    for (const b of [BASE, { ...BASE, tipo: "escalado" as const, texto: null, motivo: "dinero", prioridad: 3 }]) {
      const html = normalizar(pintar(b));
      expect(html).toContain(AVISO);
      expect(html).not.toContain("no cuenta ni bien ni mal");
    }
  });
});
