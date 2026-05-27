/**
 * /invitar/[token] · página PÚBLICA de aceptación de invitación.
 * SDD-0024 Fase 2.
 *
 * Flujo:
 *   1. Server resuelve invitation por token (admin client · bypass RLS)
 *   2. Si valid + pending → muestra form con nombre + password
 *   3. Submit → crea user en auth + asigna al tenant via RPC + redirect /studio
 *   4. Si invalid → muestra mensaje según el caso
 *
 * NO está dentro de /studio · no requiere sesión existente (el usuario
 * recién va a crear su cuenta acá).
 */

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/db/admin";
import type { UserInvitation } from "@/lib/studio/user-types";
import { invitationStatus } from "@/lib/studio/user-types";
import { AcceptInvitationForm } from "./_components/AcceptInvitationForm";

export const metadata = { title: "Aceptar invitación · DTD Studio" };
export const dynamic = "force-dynamic";

export default async function InvitarPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Resolver invitation con service_role (RLS deja ver solo por tenant del
  // user logueado · acá NO hay user todavía).
  let invitation: UserInvitation | null = null;
  try {
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
      .from("user_invitations")
      .select("*")
      .eq("token", token)
      .maybeSingle<UserInvitation>();
    invitation = data ?? null;
  } catch {
    // sin admin client · no podemos validar
  }

  if (!invitation) {
    return <InvitationError title="Invitación no encontrada" reason="El link es inválido o fue eliminado." />;
  }

  const status = invitationStatus(invitation);

  if (status === "accepted") {
    return (
      <InvitationError
        title="Invitación ya aceptada"
        reason="Esta invitación ya fue usada. Iniciá sesión normalmente desde /studio/login."
        ctaHref="/studio/login"
        ctaLabel="Iniciar sesión"
      />
    );
  }
  if (status === "revoked") {
    return (
      <InvitationError
        title="Invitación revocada"
        reason="Un admin del equipo revocó esta invitación. Pediles que te manden una nueva."
      />
    );
  }
  if (status === "expired") {
    return (
      <InvitationError
        title="Invitación expirada"
        reason="El link expiró (válido por 7 días). Pedile a un admin que te mande una nueva."
      />
    );
  }

  // Status: pending · render del form
  return (
    <AcceptInvitationContainer>
      <AcceptInvitationForm
        token={token}
        email={invitation.email}
        role={invitation.role}
      />
    </AcceptInvitationContainer>
  );
}

// ─────────────────────────────────────────────────────────────
// Server components helpers
// ─────────────────────────────────────────────────────────────

function AcceptInvitationContainer({ children }: { children: React.ReactNode }) {
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
            Te invitaron al Studio
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function InvitationError({
  title,
  reason,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  reason: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <AcceptInvitationContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            color: "var(--ink, #0F1E3D)",
            fontWeight: 600,
          }}
        >
          {title}
        </h2>
        <p style={{ margin: 0, color: "var(--ink-soft, #6B6B6B)", fontSize: 14 }}>
          {reason}
        </p>
        {ctaHref && ctaLabel && (
          <a
            href={ctaHref}
            className="studio-btn studio-btn-primary"
            style={{ alignSelf: "flex-start", marginTop: 8 }}
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </AcceptInvitationContainer>
  );
}
