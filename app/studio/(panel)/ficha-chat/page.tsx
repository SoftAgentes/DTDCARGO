/**
 * /studio/ficha-chat — Dashboard App «Ficha DTD» (SDD-0585, paso 2.4).
 *
 * Es la URL que se registra en Chatwoot (Ajustes → Integraciones → Dashboard
 * apps), y Chatwoot la monta en un iframe al lado de cada conversación. Va
 * fuera del layout con sidebar: grupo `(panel)`, sin layout propio.
 *
 *  - Cabeceras (E2-D28): solo el chat la enmarca (`frame-ancestors`, en
 *    `next.config.ts`).
 *  - Sesión (E2-D29): la cookie de Supabase (`SameSite=Lax`) viaja porque chat y
 *    Studio son el mismo sitio. El proxy la deja pasar sin sesión para no dejar
 *    el marco en blanco; acá no se lee ningún dato sin ella, y la acción
 *    `pedirFichaDtd` repite el candado.
 *  - El origen del chat sale de `chatwootOriginFromEnv`, el MISMO que usa la CSP:
 *    si divergieran, el `postMessage` se descartaría en silencio.
 */

import type { Metadata } from "next";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/db/server";
import { resolveLocale } from "@/lib/i18n/resolve-server";
import { LocaleProvider } from "@/lib/i18n";
import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { FichaDtdClient } from "./_components/FichaDtdClient";

export const metadata: Metadata = { title: "Ficha DTD" };
export const dynamic = "force-dynamic";

export default async function FichaChatPage() {
  const user = await getUser();
  let userProfileLocale: string | null = null;
  let userTenantRegion: string | null = null;
  if (user) {
    const supabase = await createClient();
    const [{ data: perfil }, { data: membresia }] = await Promise.all([
      supabase.from("user_profiles").select("locale").eq("user_id", user.id).maybeSingle<{ locale: string | null }>(),
      supabase.from("user_tenants").select("region").eq("user_id", user.id).maybeSingle<{ region: string | null }>(),
    ]);
    userProfileLocale = perfil?.locale ?? null;
    userTenantRegion = membresia?.region ?? null;
  }
  const { locale, region } = await resolveLocale({ userProfileLocale, userTenantRegion });

  return (
    <LocaleProvider locale={locale} region={region}>
      <FichaDtdClient origenChat={chatwootOriginFromEnv()} conSesion={!!user} loginUrl="/studio/login" />
    </LocaleProvider>
  );
}
