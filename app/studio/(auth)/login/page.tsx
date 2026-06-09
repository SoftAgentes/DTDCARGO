/**
 * Página de login del Studio (server wrapper).
 *
 * Lee `?next=` de la URL y lo pasa al form client. La server action (./actions.ts)
 * valida ese `next` y redirige ahí tras el login (lo usa el hub interno gateado:
 * `/studio/login?next=/interno`). Sin `next` → redirige a `/studio/resumen`.
 */

import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrá al Studio",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <LoginForm next={next} />;
}
