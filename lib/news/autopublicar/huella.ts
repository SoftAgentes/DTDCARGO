/**
 * SDD-0611 F3 · Huella SHA-256 de lo que se publica.
 *
 * El veredicto del Revisor vale solo para el texto exacto que revisó: se ata a
 * esta huella del titular, el cuerpo y los metadatos. Si cambia una coma, la
 * huella cambia y el veredicto no vale (`revision_vencida`).
 *
 * Gemela de `public.news_huella(jsonb)` (migración 0518): misma serialización,
 * campos en orden fijo separados por U+001F y palabras secundarias por U+001E.
 * Una prueba compara las dos.
 *
 * Solo servidor (usa `node:crypto`).
 */

import { createHash } from "node:crypto";

export const HUELLA_VERSION = "sdd0611-v1";

export interface ContenidoHuella {
  tipo: string;
  categoria: string;
  title: string;
  focus_keyword: string | null;
  secondary_keywords: ReadonlyArray<string>;
  meta_description: string | null;
  body_markdown: string;
}

export function serializarParaHuella(c: ContenidoHuella): string {
  return [
    HUELLA_VERSION,
    c.tipo ?? "",
    c.categoria ?? "",
    c.title ?? "",
    c.focus_keyword ?? "",
    (c.secondary_keywords ?? []).join("\u001e"),
    c.meta_description ?? "",
    c.body_markdown ?? "",
  ].join("\u001f");
}

export function huellaDe(c: ContenidoHuella): string {
  return createHash("sha256").update(serializarParaHuella(c), "utf8").digest("hex");
}
