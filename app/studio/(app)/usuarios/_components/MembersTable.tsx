"use client";

/**
 * Tabla de miembros del equipo (SDD-0274 · Slice 2 — «la fila se calla»).
 *
 * QUÉ CAMBIÓ Y POR QUÉ. La versión anterior metía en cada fila dos `<select>`
 * que aplicaban en el `onChange` y hasta tres botones de acción, uno de ellos
 * `studio-btn-primary`. Con 9 miembros eso eran **45 `useActionState` montados,
 * 18 selects que mutaban solos y un relleno vino por cada persona que no había
 * entrado**, apilados en columna. BTN-01 §2 lo nombra: una tabla «normalmente
 * usa enlace, terciario o icono para no crear decenas de primarios visuales».
 *
 * Ahora la fila **informa** y la ficha **decide**: la fila entera es el enlace,
 * cero botones, y todas las acciones viven en el drawer.
 *
 * POR QUÉ CHEVRÓN Y NO UN MENÚ `⋯`. El founder pidió que las acciones vivieran
 * dentro del perfil; un menú en la fila las devuelve a la fila. De rebote se
 * esquiva un bug real: `ActionMenu` posiciona su panel con `position:absolute`
 * y sin portal, y esta tabla vive dentro de un contenedor con `overflow:auto`,
 * así que el panel de las últimas filas se recortaría. La columna mide 40 px
 * —la misma del Norte— por si algún día se decide poner el menú.
 *
 * Siete columnas pasaron a cuatro: rol y alcance se funden, y estado y último
 * acceso también. Con eso muere el `position:sticky` de la columna de acciones,
 * que era un parche por el ancho que ocupaban los botones.
 */

import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { Icon } from "@/app/studio/_components/icons";
import {
  ROLE_LABELS,
  SCOPED_ROLES,
  WAREHOUSE_SCOPE_LABELS,
  accessStage,
  accessStageBadgeTone,
  ACCESS_STAGE_LABELS,
  formatLastLogin,
  roleBadgeTone,
  userDisplayName,
  userInitials,
  type BadgeTone,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";

/** `Avatar` no tiene tono `danger`; el rol marketing lo usa. */
type AvatarColor = "wine" | "info" | "success" | "warning" | "neutral";
function avatarColor(tone: BadgeTone): AvatarColor {
  return tone === "danger" ? "wine" : tone;
}

export function MembersTable({
  members,
  currentUserId,
  onOpenDetail,
  filtroActivo,
  onLimpiar,
}: {
  members: UserMembershipWithProfile[];
  currentUserId: string;
  onOpenDetail: (m: UserMembershipWithProfile) => void;
  /** Hay filtros puestos: cambia el vacío de «sin datos» a «sin coincidencias». */
  filtroActivo?: boolean;
  onLimpiar?: () => void;
}) {
  // TBL-01: el vacío distingue «no hay nada» de «tu filtro no encontró nada».
  // Antes era un solo texto («Sin miembros que mostrar») para los dos casos.
  if (members.length === 0) {
    return filtroActivo ? (
      <Vacio
        titulo="Ningún miembro coincide"
        detalle="Prueba con otro texto o quita los filtros."
        accion={
          onLimpiar ? (
            <button
              type="button"
              className="studio-btn studio-btn-ghost studio-btn-sm"
              onClick={onLimpiar}
            >
              Limpiar filtros
            </button>
          ) : null
        }
      />
    ) : (
      <Vacio
        titulo="Todavía no hay nadie en el equipo"
        detalle="Invita a la primera persona para empezar."
      />
    );
  }

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "auto",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <caption
          style={{
            textAlign: "left",
            padding: "var(--s-3) var(--s-4) 0",
            font: "400 12px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
          }}
        >
          Miembros del equipo, con su rol, alcance de almacén y estado de acceso.
          Cada fila abre la ficha de esa persona.
        </caption>
        <thead>
          <tr style={{ background: "var(--bg-elevated)" }}>
            <Th>Persona</Th>
            <Th>Rol y alcance</Th>
            <Th>Acceso</Th>
            <Th anclada>
              <span className="studio-sr-only">Abrir ficha</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <Fila
              key={m.user_id}
              member={m}
              esYo={m.user_id === currentUserId}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fila({
  member,
  esYo,
  onOpenDetail,
}: {
  member: UserMembershipWithProfile;
  esYo: boolean;
  onOpenDetail: (m: UserMembershipWithProfile) => void;
}) {
  const tone = roleBadgeTone(member.role);
  const etapa = accessStage(member);
  const nombre = userDisplayName(member.profile, member.email);
  const scope = member.warehouse_scope ?? "all";
  const alcance =
    member.role === "admin"
      ? "Todos los almacenes"
      : SCOPED_ROLES.has(member.role)
        ? WAREHOUSE_SCOPE_LABELS[scope]
        : "Sin lado de almacén";

  return (
    <tr
      role="button"
      tabIndex={0}
      aria-label={`Abrir la ficha de ${nombre}`}
      onClick={() => onOpenDetail(member)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onOpenDetail(member);
      }}
      className="studio-row-linkable"
      style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
    >
      <Td>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
          <Avatar
            initials={userInitials(member.profile, member.email)}
            color={avatarColor(tone)}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ font: "600 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>
              {nombre}
              {esYo && (
                <span
                  style={{
                    font: "400 11px/1 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginLeft: "var(--s-2)",
                  }}
                >
                  (tú)
                </span>
              )}
            </span>
            <span
              style={{
                font: "400 11.5px/1.3 var(--f-mono)",
                color: "var(--ink-soft)",
                wordBreak: "break-all",
              }}
            >
              {member.email}
            </span>
            {member.profile?.position_label && (
              <span style={{ font: "400 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
                {member.profile.position_label}
              </span>
            )}
          </div>
        </div>
      </Td>

      <Td>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", alignItems: "flex-start" }}>
          <Badge tone={tone} size="sm">
            {ROLE_LABELS[member.role]}
          </Badge>
          <span style={{ font: "400 11px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>
            {alcance}
          </span>
        </div>
      </Td>

      <Td>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", alignItems: "flex-start" }}>
          <Badge tone={accessStageBadgeTone(etapa)} size="sm">
            {ACCESS_STAGE_LABELS[etapa]}
          </Badge>
          <span
            style={{
              font: "400 11px/1.3 var(--f-mono)",
              color: "var(--ink-soft)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatLastLogin(member.last_login_at)}
          </span>
        </div>
      </Td>

      {/* 40 px, el ancho del Norte. Fijo para las cuatro etapas: TBL-01 pide que
          la acción de fila no cambie de sitio según el estado.
          `sticky` porque a 375 px la tabla scrollea y el chevrón —único indicio
          de que la fila abre algo— quedaba fuera de la caja visible (medido en
          navegador, SDD-0275). Ojo: NO es el `sticky` que SDD-0274 quitó; aquél
          ancoraba un racimo de botones y existía por el ancho que ocupaban.
          Éste ancla 40 px por una razón distinta: que la pista no se esconda. */}
      <Td width={40} anclada>
        <span aria-hidden style={{ color: "var(--ink-soft)", display: "grid", placeItems: "center" }}>
          {Icon.chevronR(14)}
        </span>
      </Td>
    </tr>
  );
}

function Th({ children, anclada }: { children: React.ReactNode; anclada?: boolean }) {
  return (
    <th
      scope="col"
      style={{
        ...(anclada
          ? {
              position: "sticky" as const,
              right: 0,
              background: "var(--bg-elevated)",
              borderLeft: "1px solid var(--border)",
            }
          : null),
        textAlign: "left",
        padding: "var(--s-3) var(--s-4)",
        font: "600 10px/1 var(--f-mono)",
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        // `--ink-soft` sobre `--bg-elevated` da 3,94:1, bajo el 4,5:1 que pide
        // AA para texto chico. Medido en navegador (SDD-0274).
        color: "var(--ink)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  width,
  anclada,
}: {
  children: React.ReactNode;
  width?: number;
  /** Se queda pegada a la derecha cuando la tabla scrollea. */
  anclada?: boolean;
}) {
  return (
    <td
      style={{
        padding: "var(--s-3) var(--s-4)",
        verticalAlign: "middle",
        width,
        ...(anclada
          ? {
              position: "sticky" as const,
              right: 0,
              // Sin fondo propio, el contenido que pasa por debajo se ve a
              // través de la celda anclada.
              background: "var(--bg-surface)",
              borderLeft: "1px solid var(--border)",
            }
          : null),
      }}
    >
      {children}
    </td>
  );
}

function Vacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle: string;
  accion?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: "var(--s-7) var(--s-4)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-2)",
        alignItems: "center",
      }}
    >
      <p style={{ font: "600 14px/1.3 var(--f-sans)", color: "var(--ink)", margin: 0 }}>
        {titulo}
      </p>
      <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0 }}>
        {detalle}
      </p>
      {accion}
    </div>
  );
}
