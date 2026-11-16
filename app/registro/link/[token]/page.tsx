import type { Metadata } from "next";
import Link from "next/link";
import { jetbrainsMonoUi } from "@/lib/fonts";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { listRegisterCities } from "@/lib/portal/register-cities";
import { hashRegistroToken } from "@/lib/portal/registro-link";
import { isRegistroTokenShape, REGISTRO_LINK_INVALIDO } from "@/lib/portal/registro-link-types";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { RegistroLinkForm } from "./RegistroLinkForm";

export const metadata: Metadata = {
  title: "Completa tu registro",
  // Link personal: no se indexa ni se sigue.
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Primer nombre, sin MAYÚSCULA SOSTENIDA (los nombres del legado vienen así). */
function primerNombre(name: string | null): string | null {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!first) return null;
  return first.length > 2 && first === first.toUpperCase()
    ? first.charAt(0) + first.slice(1).toLowerCase()
    : first;
}

/**
 * Registro al portal por link (SDD-0646) — el GET.
 *
 * ⚠️ Sólo LEE. El robot de vista previa de WhatsApp abre el link con un GET; si
 * esta página gastara algo, el link le llegaría muerto al cliente (lección de la
 * SDD-0253). El link se gasta en el POST del formulario (`./actions.ts`).
 *
 * El Shipping Mark sale de la ficha a la que apunta el token y se muestra
 * congelado: la URL no lo lleva y el formulario no lo envía.
 *
 * Ruta pública respaldada por la base, igual que `app/registro`: usa el admin
 * client con el visitante anónimo y el token como control.
 */
export default async function RegistroLinkPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let target: { markbox: string; client_name: string | null } | null = null;
  if (isRegistroTokenShape(token)) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.rpc("portal_registration_link_peek", {
        p_token_hash: hashRegistroToken(token),
      });
      const row = (Array.isArray(data) ? data[0] : data) as typeof target | undefined;
      target = row?.markbox ? row : null;
    } catch {
      target = null;
    }
  }

  const cities = target ? await listRegisterCities(await createClient()) : [];

  return (
    <>
      <Nav />
      <main className={`${jetbrainsMonoUi.variable} bg-paper min-h-screen`}>
        {target ? (
          <RegistroLinkForm
            token={token}
            markbox={target.markbox}
            saludo={primerNombre(target.client_name)}
            cities={cities}
          />
        ) : (
          <section className="mx-auto max-w-[560px] px-4 py-16 sm:py-24">
            <h1
              className="text-[26px] leading-[1.1] text-ink"
              style={{ fontFamily: "var(--font-archivo-black)", letterSpacing: "-0.02em" }}
            >
              Enlace no disponible
            </h1>
            <p className="mt-3 text-[14.5px] text-grey-700 leading-[1.6]">{REGISTRO_LINK_INVALIDO}</p>
            <p className="mt-6 text-[14px] text-grey-700">
              ¿Ya tienes tu acceso?{" "}
              <Link href="/entrar" className="text-wine font-semibold underline underline-offset-2">
                Entra a tu portal
              </Link>
            </p>
          </section>
        )}
      </main>
      <Footer />
    </>
  );
}
