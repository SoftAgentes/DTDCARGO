/**
 * /entrar/[code] · página PÚBLICA del enlace corto de acceso al portal (SDD-0253).
 *
 * ⚠️ **Esta página NO consume el código, y ése es el punto entero del SDD.**
 *
 * Antes se compartía el magic-link crudo de Supabase por WhatsApp. El robot de
 * previsualización de WhatsApp recorría la cadena `/auth/v1/verify` → callback
 * para armar la tarjeta del chat y, de paso, **quemaba el token de un solo uso
 * antes que el cliente** (medido el 2026-08-09 con DTD-9017). El enlace llegaba
 * muerto.
 *
 * Un crawler hace GET y no aprieta botones. Así que acá se LEE y se dibuja; el
 * magic-link se acuña en el POST de `abrirPortalAction`. Si alguien mueve esa
 * lógica a este render, el bug vuelve entero.
 *
 * `noindex`: el código es una llave al portador. Esta URL no va a ningún índice.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/db/admin";
import {
  classifyAccessLink,
  firstName,
  loadAccessTarget,
  resolveAccessLink,
} from "@/lib/studio/portal/access-link";
import { EntrarButton } from "./_components/EntrarButton";

export const dynamic = "force-dynamic";

/**
 * Metadata GENÉRICA a propósito: es lo que se ve en la tarjeta del chat, y ahí no
 * va el nombre de nadie. El saludo personalizado vive en el cuerpo, que sólo lee
 * quien abre el enlace.
 */
export const metadata: Metadata = {
  // Sin "· DTD Cargo": el layout raíz ya aplica la plantilla `%s · DTD Cargo`.
  // Ponerlo acá daba "Tu acceso al portal · DTD Cargo · DTD Cargo", y este título
  // es EXACTAMENTE lo que se lee en la tarjeta del chat.
  title: "Tu acceso al portal",
  description:
    "Entra a tu portal de DTD Cargo para ver tus envíos, tus facturas y tu Shipping Mark.",
  // `og:` explícito: es lo que arma la tarjeta de WhatsApp. Sin esto heredaría la
  // del sitio entero ("Logística end-to-end China → Venezuela…"), que no dice
  // nada de lo que el cliente tiene que hacer.
  openGraph: {
    title: "Tu acceso al portal · DTD Cargo",
    description: "Ábrelo y entra a ver tus envíos, tus facturas y tu Shipping Mark.",
  },
  robots: { index: false, follow: false },
};

/**
 * Resuelve el código a "se puede entrar" o "no".
 *
 * Vive FUERA del componente a propósito: lee el reloj, y leer el reloj dentro
 * del render es impuro (`react-hooks/purity`). Acá además queda claro que este
 * camino sólo consulta — el que gasta el código es el POST.
 */
async function abrirEntrada(
  code: string,
): Promise<{ ok: true; code: string; saludo: string | null } | { ok: false }> {
  const admin = createAdminClient();

  const link = await resolveAccessLink(admin, code);
  // Un solo resultado para todos los modos de fallo: no se le regala a un
  // enumerador la diferencia entre "no existe" y "existe pero ya se usó".
  if (!link || classifyAccessLink(link, Date.now()) !== "ok") return { ok: false };

  const target = await loadAccessTarget(admin, link.client_id);
  if (!target?.email) return { ok: false };

  return { ok: true, code: link.code, saludo: firstName(target.name) };
}

export default async function EntrarPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const entrada = await abrirEntrada(code);

  if (!entrada.ok) return <AccesoNoDisponible />;

  const saludo = entrada.saludo;

  return (
    <Marco>
      <h1
        style={{
          fontFamily: "var(--font-archivo-black)",
          fontSize: 26,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
          margin: "0 0 12px",
        }}
      >
        {saludo ? `Hola ${saludo}, entra a tu portal` : "Entra a tu portal"}
      </h1>

      <p
        style={{
          font: "500 14.5px/1.6 var(--font-archivo)",
          color: "var(--color-grey-700)",
          margin: "0 0 24px",
        }}
      >
        Adentro ves tus envíos, tus facturas y tu Shipping Mark.
      </p>

      <EntrarButton code={entrada.code} />

      <p
        style={{
          font: "500 12.5px/1.55 var(--font-archivo)",
          color: "var(--color-grey-700)",
          margin: "16px 0 0",
        }}
      >
        Este acceso es personal y de un solo uso. No lo reenvíes a nadie.
      </p>
    </Marco>
  );
}

// ─────────────────────────────────────────────────────────────
// Presentación
// ─────────────────────────────────────────────────────────────

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--color-white)",
          border: "1px solid var(--color-grey-200)",
          borderRadius: 12,
          padding: 32,
          width: "100%",
          maxWidth: 440,
        }}
      >
        <p
          style={{
            font: "700 10.5px/1 var(--font-archivo)",
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "var(--color-wine-text)",
            margin: "0 0 14px",
          }}
        >
          DTD Cargo · Portal del cliente
        </p>
        {children}
      </div>
    </main>
  );
}

function AccesoNoDisponible() {
  return (
    <Marco>
      <h1
        style={{
          fontFamily: "var(--font-archivo-black)",
          fontSize: 24,
          lineHeight: 1.15,
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
          margin: "0 0 10px",
        }}
      >
        Este acceso ya no está disponible
      </h1>
      <p
        style={{
          font: "500 14.5px/1.6 var(--font-archivo)",
          color: "var(--color-grey-700)",
          margin: "0 0 22px",
        }}
      >
        El enlace venció o ya se usó. Pídele a tu asesor de DTD Cargo uno nuevo, o
        entra con tu correo desde el portal.
      </p>
      <Link href="/entrar" className="btn btn-primary">
        Ir al portal
      </Link>
    </Marco>
  );
}
