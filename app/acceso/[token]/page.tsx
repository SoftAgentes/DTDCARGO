/**
 * `/acceso/[token]` · página PÚBLICA para recuperar el acceso al Studio.
 * SDD-0250 (corrección) · migr 0354.
 *
 * ⚠️ ABRIR ESTA PÁGINA NO CONSUME EL TOKEN. Sólo lo BUSCA y decide qué mostrar.
 * El token se gasta en la server action, cuando la persona guarda su clave.
 *
 * Esa distinción es todo el arreglo. La versión anterior canjeaba el token al
 * abrir el enlace, y el escáner de correo de Gmail —que abre los enlaces del
 * mensaje apenas llega para revisar que no sean maliciosos— lo consumía antes
 * de que la persona hiciera clic. Ningún enlace llegó vivo a su destinatario.
 *
 * Mismo patrón que `app/invitar/[token]`, que nunca tuvo el problema.
 */

import { createAdminClient } from "@/lib/db/admin";
import {
  accessTokenStatus,
  type AccessTokenRow,
} from "@/lib/studio/access-token";
import { SetPasswordForm } from "./_components/SetPasswordForm";

export const metadata = { title: "Recupera tu acceso · DTD Studio" };
export const dynamic = "force-dynamic";

interface TokenConUsuario extends AccessTokenRow {
  email: string | null;
}

export default async function AccesoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Admin client: la tabla tiene RLS activa SIN política para authenticated
  // (migr 0354) y acá todavía no hay sesión de nadie.
  let row: TokenConUsuario | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("studio_access_tokens")
      .select("id, tenant_id, user_id, expires_at, used_at, revoked_at")
      .eq("token", token)
      .maybeSingle<AccessTokenRow>();

    if (data) {
      const { data: authUser } = await admin.auth.admin.getUserById(data.user_id);
      row = { ...data, email: authUser?.user?.email ?? null };
    }
  } catch {
    // Sin admin client no podemos validar nada · cae al mensaje genérico.
  }

  if (!row) {
    return (
      <AccesoError
        titulo="Este enlace no existe"
        razon="Puede estar mal copiado o haber sido eliminado. Pídele uno nuevo a un admin del equipo."
      />
    );
  }

  const estado = accessTokenStatus(row);

  if (estado === "usado") {
    return (
      <AccesoError
        titulo="Este enlace ya se usó"
        razon="Ya creaste tu contraseña con él. Entra normalmente con tu correo y tu clave."
        ctaHref="/studio/login"
        ctaLabel="Ir a iniciar sesión"
      />
    );
  }
  if (estado === "revocado") {
    return (
      <AccesoError
        titulo="Este enlace fue anulado"
        razon="Un admin del equipo lo dio de baja. Pídele que te mande uno nuevo."
      />
    );
  }
  if (estado === "expirado") {
    return (
      <AccesoError
        titulo="Este enlace venció"
        razon="Los enlaces de acceso duran 7 días. Pídele a un admin que te mande uno nuevo."
      />
    );
  }

  return (
    <AccesoContainer>
      <SetPasswordForm token={token} email={row.email ?? ""} />
    </AccesoContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Server components helpers
// ─────────────────────────────────────────────────────────────

function AccesoContainer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base, #FBFAF7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "var(--bg-surface, #FFFFFF)",
          border: "1px solid var(--border, #E8E6E2)",
          borderRadius: 12,
          padding: 32,
          width: "100%",
          maxWidth: 460,
          boxShadow: "0 8px 24px rgba(15, 30, 61, 0.06)",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-soft, #6B6B6B)",
            }}
          >
            DTD Cargo · Equipo
          </span>
          <h1
            style={{
              fontFamily: "var(--font-archivo-black, 'Archivo Black')",
              fontSize: 24,
              margin: "8px 0 4px",
              color: "var(--ink, #0F1E3D)",
              letterSpacing: "-0.01em",
            }}
          >
            Crea tu contraseña
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function AccesoError({
  titulo,
  razon,
  ctaHref,
  ctaLabel,
}: {
  titulo: string;
  razon: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <AccesoContainer>
      <p
        style={{
          font: "700 15px/1.4 var(--f-sans, Archivo, sans-serif)",
          color: "var(--ink, #0F1E3D)",
          margin: "0 0 8px",
        }}
      >
        {titulo}
      </p>
      <p
        style={{
          font: "500 13.5px/1.55 var(--f-sans, Archivo, sans-serif)",
          color: "var(--ink-soft, #6B6B6B)",
          margin: 0,
        }}
      >
        {razon}
      </p>
      {ctaHref && ctaLabel && (
        <a
          href={ctaHref}
          className="studio-btn studio-btn-primary"
          style={{ marginTop: 20, display: "inline-flex" }}
        >
          {ctaLabel}
        </a>
      )}
    </AccesoContainer>
  );
}
