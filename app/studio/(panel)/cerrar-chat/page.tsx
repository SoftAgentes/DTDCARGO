/**
 * /studio/cerrar-chat — paso de salida de Studio (SDD-0585, paso 2.7, E2-D13).
 *
 * `signOut` manda aquí, ya sin sesión, a quien tenía abierta la Bandeja en este
 * navegador (la marca `dtd_cw_sso`). La página cierra también la sesión del
 * panel de Chatwoot y sigue al login. No lee nada: ni sesión ni datos.
 *
 *  - Proxy: pasa sin sesión (`rendersOwnSignedOutState`), como la Ficha DTD.
 *  - Cabeceras: la CSP estricta más `frame-src` del chat, para el marco oculto
 *    (`next.config.ts`). Studio sigue sin dejarse enmarcar.
 */

import type { Metadata } from "next";
import { resolveLocale } from "@/lib/i18n/resolve-server";
import { LocaleProvider } from "@/lib/i18n";
import { chatwootOriginFromEnv } from "@/lib/runtime/chatwoot-origin";
import { CerrarChatClient } from "./_components/CerrarChatClient";

export const metadata: Metadata = { title: "Cerrando sesión" };
export const dynamic = "force-dynamic";

export default async function CerrarChatPage() {
  const { locale, region } = await resolveLocale({ userProfileLocale: null, userTenantRegion: null });
  return (
    <LocaleProvider locale={locale} region={region}>
      <CerrarChatClient origenChat={chatwootOriginFromEnv()} destino="/studio/login" />
    </LocaleProvider>
  );
}
