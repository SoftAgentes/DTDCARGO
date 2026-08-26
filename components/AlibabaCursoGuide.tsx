/**
 * Guía interactiva de compra en Alibaba embebida en una lección de la Academia
 * (SDD-0099 · widget `alibaba_curso`, migración 0393).
 *
 * Espejo de `AlibabaAddressGuide`, pero para la guía COMPLETA: aquélla resuelve
 * sólo la dirección de la bodega, ésta son las 9 etapas con calculadoras.
 *
 * Vive en `components/` y sólo importa de sí mismo → lo pueden montar los dos
 * lados de la frontera público↔ERP.
 *
 * El `markbox` viaja por querystring: la guía lo lee (`?mark=`), precarga el
 * campo, arma el destinatario que exige Alibaba (`林冠 DTD-1042`) y saluda por
 * nombre. Sin `markbox` sale en modo manual (`DTD-XXXX`) con CTA al registro.
 * La sanitización es la MISMA que la de `guiaAlibabaHref` y la de la guía.
 */

"use client";

import { guiaAlibabaHref } from "@/lib/guia-alibaba";

export function AlibabaCursoGuide({
  markbox,
  name,
}: {
  markbox?: string;
  name?: string;
}) {
  return (
    <iframe
      src={guiaAlibabaHref(markbox, name)}
      title="Cómo comprar en Alibaba — guía interactiva de DTD Cargo"
      loading="lazy"
      className="w-full rounded-xl border"
      style={{ height: "80vh", minHeight: 560, borderColor: "var(--color-grey-200)" }}
    />
  );
}
