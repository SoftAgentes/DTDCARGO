import type { Metadata } from "next";
import Link from "next/link";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { listRegisterCities } from "@/lib/portal/register-cities";
import { hashRegistroToken } from "@/lib/portal/registro-link";
import {
  isRegistroTokenShape,
  REGISTRO_AUTOSERVICIO_INVALIDO,
} from "@/lib/portal/registro-link-types";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RegistroLinkForm } from "../../link/[token]/RegistroLinkForm";

export const metadata: Metadata = {
  title: "Crea tu portal",
  // Enlace personal: no se indexa ni se sigue.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * SDD-0672 (entrega 2) · el enlace de autoservicio que `/entrar` le manda al
 * correo de la ficha de un cliente sin portal. El GET.
 *
 * ⚠️ Sólo LEE (`portal_registration_link_peek_self`): un escáner de correo o un
 * robot de vista previa abre el enlace con un GET, y si esta página gastara algo
 * el enlace le llegaría muerto al cliente (lección de la SDD-0253). Se gasta en el
 * POST (`./actions.ts`).
 *
 * 🔴 NO muestra el Shipping Mark ni el nombre: el correo de la ficha lo cargó el
 * equipo y puede ser de otra persona. La ficha se revela recién cuando la cédula
 * o el WhatsApp coinciden (la guarda de la migración 0562).
 *
 * Ruta pública respaldada por la base, igual que `app/registro`: admin client con
 * el visitante anónimo y el token como control. Sin la migración 0562 la función
 * no existe y la página dice «Enlace no disponible».
 */
export default async function RegistroActivarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let correo: string | null = null;
  let vivo = false;
  if (isRegistroTokenShape(token)) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("portal_registration_link_peek_self", {
        p_token_hash: hashRegistroToken(token),
      });
      const row = (Array.isArray(data) ? data[0] : data) as
        | { issued_to_email?: string | null }
        | null
        | undefined;
      vivo = !error && !!row;
      correo = vivo ? (row?.issued_to_email ?? null) : null;
    } catch {
      vivo = false;
    }
  }

  const cities = vivo ? await listRegisterCities(await createClient()) : [];

  return (
    <>
      <Nav />
      <main className={`${jetbrainsMonoUi.variable} bg-paper min-h-screen`}>
        {vivo ? (
          <RegistroLinkForm
            token={token}
            markbox={null}
            cities={cities}
            variante="autoservicio"
            prefillEmail={correo}
          />
        ) : (
          <section className="mx-auto max-w-[560px] px-4 py-16 sm:py-24">
            <h1
              className="text-[26px] leading-[1.1] text-ink"
              style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
            >
              Enlace no disponible
            </h1>
            <p className="mt-3 text-[14.5px] text-grey-700 leading-[1.6]">
              {REGISTRO_AUTOSERVICIO_INVALIDO}
            </p>
            <p className="mt-6 text-[14px] text-grey-700">
              <Link href="/entrar" className="text-wine font-semibold underline underline-offset-2">
                Ir a «Entrar»
              </Link>
            </p>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
