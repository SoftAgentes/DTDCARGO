/**
 * Layout raíz de la ZONA INTERNA del equipo (`/interno/*`).
 *
 * Superficie nueva, gateada por login del ERP (el guard real vive en
 * `(app)/layout.tsx`). Acá solo metadata: TODO `/interno` es noindex — material
 * interno del equipo, nunca para buscadores. El `<html>`/`<body>` + las fuentes
 * (Archivo / Archivo Black / Noto Sans SC) los provee `app/layout.tsx`.
 *
 * Primer inquilino: el hub de marca en `/interno/marca`. Cada herramienta interna
 * nueva = una subcarpeta más, sin tocar auth.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Recursos internos",
    template: "%s · Recursos internos DTD Cargo",
  },
  description: "Recursos internos del equipo de DTD Cargo.",
  robots: { index: false, follow: false, nocache: true },
};

export default function InternoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
