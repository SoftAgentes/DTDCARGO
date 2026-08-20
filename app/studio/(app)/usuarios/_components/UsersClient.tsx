"use client";

/**
 * Usuarios y roles — la pantalla (SDD-0274 · slices 2, 3 y 4).
 *
 * TRES PESTAÑAS, UN SOLO LUGAR. Antes la gente vivía en `Usuarios` y la matriz
 * de permisos en `Administración`: dos módulos para una sola pregunta («¿qué
 * puede hacer esta persona?»). Pedido del founder el 2026-08-19. **No cambia
 * quién entra**: `users` y `admin` son los dos admin-only, así que la matriz
 * queda al alcance de exactamente la misma gente que antes.
 *
 * Las 7 tarjetas de rol con su descripción también se mudan acá: estaban
 * apiladas encima de la tabla, empujando las filas fuera de pantalla, y
 * duplicando el `<select>` de rol de la barra de filtros.
 *
 * QUÉ VIAJA EN LA URL Y QUÉ NO. La pestaña, el filtro de estado y la ficha
 * abierta sí (`?tab=&estado=&persona=`): son estados que uno quiere compartir
 * o recuperar. **El texto buscado NO.** Es el nombre o el correo de una
 * persona, y la query string queda escrita en el historial del navegador y en
 * los logs de cualquier proxy. El filtro se comparte igual; el dato personal no
 * tiene por qué viajar. TBL-01 pide filtros restaurables y esto lo cumple para
 * los que se pueden restaurar sin publicar a nadie.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { PermissionsSection } from "@/app/studio/(app)/admin/_components/PermissionsSection";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { InviteUserDrawer } from "./InviteUserDrawer";
import { InvitationsTable } from "./InvitationsTable";
import { MembersTable } from "./MembersTable";
import { UserDetailDrawer } from "./UserDetailDrawer";
import { BandaDeTrabajo } from "./personas/BandaDeTrabajo";
import { ToolbarPersonas, type FiltroEtapa } from "./personas/ToolbarPersonas";
import type { RoleModuleOverrides } from "@/lib/studio/rbac";
import {
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  STUDIO_USER_ROLES,
  accessStage,
  compareByAccessStage,
  invitationStatus,
  roleBadgeTone,
  userDisplayName,
  type UserInvitation,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";

type Pestana = "personas" | "roles" | "invitaciones";
const PESTANAS: Pestana[] = ["personas", "roles", "invitaciones"];

export function UsersClient({
  members,
  invitations,
  currentUserId,
  roleModuleOverrides,
}: {
  members: UserMembershipWithProfile[];
  invitations: UserInvitation[];
  currentUserId: string;
  roleModuleOverrides: RoleModuleOverrides;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const tabUrl = params.get("tab");
  const tab: Pestana = PESTANAS.includes(tabUrl as Pestana)
    ? (tabUrl as Pestana)
    : "personas";
  const etapaUrl = params.get("estado");
  const etapa: FiltroEtapa =
    etapaUrl === "nunca-entro" || etapaUrl === "activo" || etapaUrl === "suspendido"
      ? etapaUrl
      : "todos";
  const personaUrl = params.get("persona");

  // El texto buscado vive SÓLO en memoria — ver el docstring.
  const [busqueda, setBusqueda] = useState("");
  const [invitarAbierto, setInvitarAbierto] = useState(false);

  function navegar(cambios: Record<string, string | null>) {
    const s = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(cambios)) {
      if (v === null) s.delete(k);
      else s.set(k, v);
    }
    const qs = s.toString();
    router.push(qs ? `/studio/usuarios?${qs}` : "/studio/usuarios", { scroll: false });
  }

  const pendientesInvit = invitations.filter((i) => invitationStatus(i) === "pending");

  // Conteos sobre el total SIN filtrar: un chip que contara sobre lo ya
  // filtrado se vaciaría a sí mismo al usarlo.
  const conteos = useMemo(() => {
    const c: Record<FiltroEtapa, number> = {
      todos: members.length,
      "nunca-entro": 0,
      activo: 0,
      suspendido: 0,
    };
    for (const m of members) c[accessStage(m)] += 1;
    return c;
  }, [members]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return members
      .filter((m) => {
        if (etapa !== "todos" && accessStage(m) !== etapa) return false;
        if (!q) return true;
        // BUS-01: el alcance declarado en el label tiene que ser el real.
        const campos = [
          userDisplayName(m.profile, m.email),
          m.email,
          m.profile?.position_label ?? "",
          ROLE_LABELS[m.role],
        ];
        return campos.some((c) => c.toLowerCase().includes(q));
      })
      .sort(compareByAccessStage);
  }, [members, etapa, busqueda]);

  const pendientesAcceso = useMemo(
    () => members.filter((m) => accessStage(m) === "nunca-entro"),
    [members],
  );

  // La ficha se resuelve por ID contra la lista viva: al revalidar, el drawer
  // se redibuja con la fila fresca en vez del snapshot de cuando se abrió.
  const fichaAbierta = personaUrl
    ? (members.find((m) => m.user_id === personaUrl) ?? null)
    : null;

  const hayFiltro = busqueda.trim() !== "" || etapa !== "todos";

  function limpiar() {
    setBusqueda("");
    navegar({ estado: null });
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Secciones de usuarios y roles"
        style={{
          display: "flex",
          gap: "var(--s-1)",
          borderBottom: "1px solid var(--border)",
          marginBottom: "var(--s-4)",
          overflowX: "auto",
        }}
      >
        <Tab activa={tab === "personas"} onClick={() => navegar({ tab: "personas" })} n={members.length}>
          Personas
        </Tab>
        <Tab activa={tab === "roles"} onClick={() => navegar({ tab: "roles" })} n={STUDIO_USER_ROLES.length}>
          Roles y permisos
        </Tab>
        <Tab
          activa={tab === "invitaciones"}
          onClick={() => navegar({ tab: "invitaciones" })}
          n={pendientesInvit.length}
        >
          Invitaciones
        </Tab>
      </div>

      {tab === "personas" && (
        <>
          <BandaDeTrabajo
            pendientes={pendientesAcceso}
            onVerPendientes={() => navegar({ estado: "nunca-entro" })}
          />
          <ToolbarPersonas
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            etapa={etapa}
            onEtapa={(e) => navegar({ estado: e === "todos" ? null : e })}
            conteos={conteos}
            mostrando={visibles.length}
            total={members.length}
            onLimpiar={limpiar}
          />
          <MembersTable
            members={visibles}
            currentUserId={currentUserId}
            onOpenDetail={(m) => navegar({ persona: m.user_id })}
            filtroActivo={hayFiltro}
            onLimpiar={limpiar}
          />
        </>
      )}

      {tab === "roles" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(272px, 1fr))",
              gap: "var(--s-3)",
              marginBottom: "var(--s-5)",
            }}
          >
            {STUDIO_USER_ROLES.map((r) => {
              const cuantos = members.filter(
                (m) => m.role === r && accessStage(m) !== "suspendido",
              ).length;
              return (
                <div
                  key={r}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    padding: "var(--s-4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--s-2)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "var(--s-2)",
                    }}
                  >
                    <Badge tone={roleBadgeTone(r)} size="sm" dot>
                      {ROLE_LABELS[r]}
                    </Badge>
                    <span
                      style={{
                        font: "700 13px/1 var(--f-mono)",
                        color: "var(--ink)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {cuantos}
                    </span>
                  </div>
                  <p
                    style={{
                      font: "400 12.5px/1.5 var(--f-sans)",
                      color: "var(--ink-soft)",
                      margin: 0,
                    }}
                  >
                    {ROLE_DESCRIPTIONS[r]}
                  </p>
                </div>
              );
            })}
          </div>

          <PermissionsSection initialOverrides={roleModuleOverrides} />
        </>
      )}

      {tab === "invitaciones" && <InvitationsTable invitations={invitations} />}

      {fichaAbierta && (
        <UserDetailDrawer
          member={fichaAbierta}
          esYo={fichaAbierta.user_id === currentUserId}
          onClose={() => navegar({ persona: null })}
        />
      )}

      {invitarAbierto && <InviteUserDrawer onClose={() => setInvitarAbierto(false)} />}

      <AccionesDeCabecera onInvitar={() => setInvitarAbierto(true)} />
    </>
  );
}

function Tab({
  activa,
  onClick,
  n,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  n: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activa}
      onClick={onClick}
      className="studio-tab"
      data-activa={activa ? "true" : undefined}
    >
      {children}
      <span className="studio-tab-n">{n}</span>
    </button>
  );
}

/**
 * El botón «Invitar usuario» se hidrata dentro del slot que deja el server
 * component (`#users-page-actions`). «Permisos por rol» desapareció de acá:
 * ahora es una pestaña, no un modal.
 */
function AccionesDeCabecera({ onInvitar }: { onInvitar: () => void }) {
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    // La bandera se llama `cancelled` y no `cancelado` a propósito: el contrato
    // `external-effect-boundaries-contract` la busca por ESE literal en los 7
    // consumidores que difieren trabajo con `queueMicrotask`. Renombrarla al
    // español rompe el contrato sin cambiar el comportamiento — y ese contrato
    // es lo único que impide que alguien borre la limpieza del efecto.
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const el = document.getElementById("users-page-actions");
      if (el) setTarget(el);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!target) return null;

  return createPortal(
    <button type="button" onClick={onInvitar} className="studio-btn studio-btn-primary">
      Invitar usuario
    </button>,
    target,
  );
}
