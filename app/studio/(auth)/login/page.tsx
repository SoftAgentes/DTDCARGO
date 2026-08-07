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
  title: "Entra al Studio",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; listo?: string | string[] }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  // `?listo=1` lo pone /acceso/[token] al guardar la contraseña (SDD-0250).
  // Sin este acuse, quien acaba de crear su clave aterriza en un login mudo y
  // no sabe si funcionó — detectado probando el flujo completo en producción.
  const listo = sp.listo === "1";
  return <LoginForm next={next} listo={listo} />;
}
