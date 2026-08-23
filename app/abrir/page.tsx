/**
 * `/abrir` · página PÚBLICA del enlace de acceso que llega por correo (SDD-0278).
 *
 * ⚠️ **Esta página NO consume el token, y ése es el punto entero del SDD.**
 * Un escáner de correo hace GET y no aprieta botones. Acá se lee y se dibuja; el
 * token se gasta en el POST de `abrirConEnlaceAction`.
 *
 * Vive en la raíz y no bajo `app/portal/` a propósito: es la puerta, no el portal.
 * Bajo `app/portal/layout.tsx` heredaría el remapeo de `--font-archivo*` a
 * Sora/Nunito, y quedaría con una tipografía distinta a `/entrar`, `/registro` y
 * `/entrar/[code]`, que son las otras mitades de la misma puerta.
 *
 * `noindex`: el token es una llave al portador. Esta URL no va a ningún índice.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { AbrirButton } from "./_components/AbrirButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Sin "· DTD Cargo": el layout raíz ya aplica la plantilla `%s · DTD Cargo`.
  title: "Entra a tu portal",
  description:
    "Entra a tu portal de DTD Cargo para ver tus envíos, tus facturas y tu Shipping Mark.",
  robots: { index: false, follow: false },
};

export default async function AbrirPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const tokenHash = sp.token_hash?.trim() ?? "";
  const type = sp.type?.trim() ?? "";

  if (!tokenHash || type !== "magiclink") return <EnlaceIncompleto />;

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
        Entra a tu portal
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

      <AbrirButton tokenHash={tokenHash} type={type} />

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

/**
 * El enlace llegó cortado (pasa cuando el cliente de correo parte la URL larga
 * en dos líneas y sólo se copia la primera). No es un fallo de seguridad: es el
 * caso de "esto no se ve como un enlace completo".
 */
function EnlaceIncompleto() {
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
        Este enlace está incompleto
      </h1>
      <p
        style={{
          font: "500 14.5px/1.6 var(--font-archivo)",
          color: "var(--color-grey-700)",
          margin: "0 0 22px",
        }}
      >
        A veces el correo parte el enlace en dos líneas y sólo se copia la primera.
        Vuelve a tu correo y toca el botón <b>Entrar a mi portal</b>, o pide uno
        nuevo desde la puerta.
      </p>
      <Link href="/entrar" className="btn btn-primary">
        Pedir un enlace nuevo
      </Link>
    </Marco>
  );
}
