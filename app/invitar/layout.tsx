/**
 * Layout del namespace `/invitar/*` · página pública de aceptación de invitación.
 *
 * Importa `studio.css` (incluye tokens.css) para tener acceso a:
 *  - Tokens brand: var(--wine), var(--ink), var(--ink-soft), var(--success), etc.
 *  - Clases reutilizables: .studio-btn, .studio-btn-primary, etc.
 *
 * Sin este import, AcceptInvitationForm queda con botones sin estilo y
 * var(--*) cayendo a fallbacks hex (detectado en review ui-ux-designer
 * 2026-05-26: mismo patrón que /m/layout.tsx ya resolvió).
 */

import type { Metadata } from "next";
import "@/app/studio/studio.css";

export const metadata: Metadata = {
  title: "Aceptar invitación · DTD Studio",
  description: "Aceptá tu invitación al equipo de DTD Cargo Studio.",
  robots: { index: false, follow: false },
};

export default function InvitarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
