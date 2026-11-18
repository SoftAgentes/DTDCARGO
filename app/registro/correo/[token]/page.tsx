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
 * De la ficha muestra SOLO el Shipping Mark (el mismo que ya va en el correo).
 * Este enlace comprueba un correo, no abre el portal: mira si ya hay una sesión
 * (sólo para decirle a quien no la tiene que entre primero) y no crea ninguna.
 * El POST vuelve a exigir la sesión, y que sea la del titular.
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
  if (isRegistroTokenShape(token)) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.rpc("portal_email_check_peek", {
        p_token_hash: hashRegistroToken(token),
      });
      const row = (Array.isArray(data) ? data[0] : data) as { markbox?: string } | null | undefined;
      markbox = row?.markbox ?? null;
    } catch {
      markbox = null;
    }
  }

  // ¿Hay sesión del portal en este navegador? Sólo lectura, sólo para el texto.
  let conSesion = false;
  if (markbox) {
    try {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      conSesion = Boolean(data.user);
    } catch {
      conSesion = false;
    }
  }

  return (
    <>
      <Nav />
      <main className={`${jetbrainsMonoUi.variable} bg-paper min-h-screen`}>
        {markbox ? (
          <ComprobarCorreoForm token={token} markbox={markbox} conSesion={conSesion} />
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
