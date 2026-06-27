/**
 * /m/emp/registro?inv=<token> — auto-registro del candidato (SDD-0113 Slice A).
 *
 * Página PÚBLICA (el candidato no tiene sesión). Valida el token server-side con
 * un cliente de servicio: si la invitación es usable, precarga cargo/área y
 * muestra el form; si no, un mensaje de link inválido. El submit lo maneja
 * `submitRegistrationAction` (token-only). El candidato NO gana acceso: el admin
 * aprueba la solicitud desde el Studio.
 */

import { createAdminClient } from "@/lib/db/admin";
import { getInviteByToken } from "@/lib/studio/nomina/invite-queries";
import { isInviteUsable } from "@/lib/studio/nomina/invite-types";
import { RegistroForm } from "./RegistroForm";

export const metadata = { title: "Registro de empleado" };

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ inv?: string }>;
}) {
  const { inv } = await searchParams;
  const token = (inv ?? "").trim();

  const invite = token ? await getInviteByToken(createAdminClient(), token) : null;
  const usable = invite ? isInviteUsable(invite) : false;

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-base)",
        padding: "24px 16px 48px",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <header style={{ marginBottom: 24 }}>
        <span className="studio-eyebrow">DTD Cargo · RRHH</span>
        <h1 className="studio-display" style={{ fontSize: 24, margin: "6px 0 4px", color: "var(--ink)" }}>
          Registro de empleado
        </h1>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
          Completa tus datos. Tu solicitud queda en revisión: el administrador la aprueba antes de
          darte acceso.
        </p>
      </header>

      {!usable ? (
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
            padding: "20px 18px",
          }}
        >
          <div style={{ font: "700 14px/1.3 var(--f-sans)", color: "var(--ink)", marginBottom: 6 }}>
            Link inválido o vencido
          </div>
          <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
            Esta invitación no es válida o ya venció. Pídele al administrador de DTD un link nuevo.
          </p>
        </div>
      ) : (
        <RegistroForm
          token={token}
          cargoSugerido={invite?.cargo ?? null}
          departamentoSugerido={invite?.department ?? null}
        />
      )}
    </main>
  );
}
