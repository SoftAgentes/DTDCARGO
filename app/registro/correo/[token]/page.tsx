import type { Metadata } from "next";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { COMPROBAR_CORREO_NO_SIRVE } from "@/lib/portal/correo-comprobacion";
import { hashRegistroToken } from "@/lib/portal/registro-link";
import { isRegistroTokenShape } from "@/lib/portal/registro-link-types";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ComprobarCorreoForm } from "./ComprobarCorreoForm";

export const metadata: Metadata = {
  title: "Comprueba tu correo",
  // Enlace personal: no se indexa ni se sigue.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Enlace de comprobación del correo (SDD-0646, D-1 opción C) — el GET.
 *
 * ⚠️ Sólo LEE. Los filtros de correo y los robots de vista previa abren los
 * enlaces con un GET; si esta página gastara algo, el enlace le llegaría muerto
 * al cliente (lección de la SDD-0253). Se gasta en el POST del botón
 * (`./actions.ts`).
 *
 * De la ficha muestra el Shipping Mark (el mismo que ya va en el correo). El
 * correo por comprobar lo muestra SOLO al titular: la base lo devuelve cuando
 * el usuario de la sesión (lo lee el servidor, no el visitante) es el de la
 * cuenta, para que el cliente vea qué correo confirma antes de confirmarlo.
 * Sin sesión o con la de otra cuenta, no sale el correo y se le pide entrar
 * primero. Este enlace comprueba un correo, no abre el portal: no crea ninguna
 * sesión. El POST vuelve a exigir la sesión, y que sea la del titular.
 *
 * Ruta pública respaldada por la base, igual que `app/registro`: usa el admin
 * client con el visitante anónimo y el token como control.
 */
export default async function ComprobarCorreoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let markbox: string | null = null;
  let correo: string | null = null;
  if (isRegistroTokenShape(token)) {
    // ¿De quién es la sesión del portal en este navegador? Sólo lectura.
    let sessionUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      sessionUserId = data.user?.id ?? null;
    } catch {
      sessionUserId = null;
    }
    try {
      const admin = createAdminClient();
      const { data } = await admin.rpc("portal_email_check_peek", {
        p_token_hash: hashRegistroToken(token),
        p_session_user_id: sessionUserId,
      });
      const row = (Array.isArray(data) ? data[0] : data) as
        | { markbox?: string; pending_email?: string | null }
        | null
        | undefined;
      markbox = row?.markbox ?? null;
      // La base sólo lo devuelve al titular; si no hay sesión, ni se mira.
      correo = markbox && sessionUserId ? (row?.pending_email ?? null) : null;
    } catch {
      markbox = null;
      correo = null;
    }
  }

  return (
    <>
      <Nav />
      <main className={`${jetbrainsMonoUi.variable} bg-paper min-h-screen`}>
        {markbox ? (
          <ComprobarCorreoForm token={token} markbox={markbox} correo={correo} />
        ) : (
          <section className="mx-auto max-w-[560px] px-4 py-16 sm:py-24">
            <h1
              className="text-[26px] leading-[1.1] text-ink"
              style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
            >
              Enlace no disponible
            </h1>
            <p className="mt-3 text-[14.5px] text-grey-700 leading-[1.6]">
              {COMPROBAR_CORREO_NO_SIRVE}
            </p>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
