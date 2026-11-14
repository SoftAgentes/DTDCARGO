"use client";

/**
 * Ficha de una persona del equipo (SDD-0250 · ficha de usuario).
 *
 * Se abre al hacer clic en una fila de Usuarios. Junta en un solo lugar lo que
 * hoy está repartido: los datos de la persona, su acceso, y las acciones que ya
 * existían sueltas en la tabla.
 *
 * PARIDAD CON EL NORTE: allá la ficha es un overlay que se abre encima
 * (`shell.jsx`, OVERLAY_TITLES 'Perfil de usuario'), NO una carpeta ni una ruta
 * propia. Acá se usa el DrawerShell del Studio, que es el mismo gesto.
 *
 * SDD-0622: tres pestañas — Perfil (datos y acciones de admin), Acceso (rol
 * base, accesos extra y lo que puede ver) y Actividad (rastro de los accesos
 * extra en `entity_audit_log`). La actividad muestra SOLO eso, que sí tiene una
 * vista por persona; los cambios de rol siguen en su propia auditoría.
 */

import { useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import { Badge } from "@/app/studio/_components/ui/Badge";
import {
  ROLE_LABELS,
  formatLastLogin,
  memberStatus,
  memberStatusLabel,
  userDisplayName,
  type UserActionState,
  type UserMembershipWithProfile,
} from "@/lib/studio/user-types";
import type { RoleModuleOverrides } from "@/lib/studio/rbac";
import type { UserModuleGrantView } from "@/lib/studio/user-module-grants-queries";
import { AccesoPanel } from "./acceso/AccesoPanel";
import { ActividadAcceso } from "./acceso/ActividadAcceso";
import "./acceso/permisos.css";
import {
  changeMemberEmailAction,
  disableUserAction,
  enableUserAction,
  sendAccessLinkAction,
  updateMemberProfileAction,
} from "../actions";

const INICIAL: UserActionState = {};

export type FichaPestana = "perfil" | "acceso" | "actividad";

export function UserDetailDrawer({
  member,
  esYo,
  onClose,
  grants = [],
  overrides = {},
  nombres = {},
  pestana: pestanaInicial = "perfil",
}: {
  member: UserMembershipWithProfile;
  /** El admin se está mirando a sí mismo — cambia el aviso del correo. */
  esYo?: boolean;
  onClose: () => void;
  /** Accesos extra de esta persona (SDD-0622). */
  grants?: UserModuleGrantView[];
  /** Desvíos por rol del tenant, para «Lo que puede ver». */
  overrides?: RoleModuleOverrides;
  /** userId → nombre, para «dado por» y la actividad. */
  nombres?: Record<string, string>;
  pestana?: FichaPestana;
}) {
  const [pestana, setPestana] = useState<FichaPestana>(pestanaInicial);
  const [perfilState, perfilAction, perfilPending] = useActionState(
    updateMemberProfileAction,
    INICIAL,
  );
  const [accesoState, accesoAction, accesoPending] = useActionState(
    sendAccessLinkAction,
    INICIAL,
  );
  const [disableState, disableAction, disablePending] = useActionState(
    disableUserAction,
    INICIAL,
  );
  const [enableState, enableAction, enablePending] = useActionState(
    enableUserAction,
    INICIAL,
  );
  const [correoState, correoAction, correoPending] = useActionState(
    changeMemberEmailAction,
    INICIAL,
  );
  const [copiado, setCopiado] = useState(false);
  const [editandoCorreo, setEditandoCorreo] = useState(false);

  const estado = memberStatus(member);
  const activo = estado === "active";
  const pendiente =
    perfilPending ||
    accesoPending ||
    disablePending ||
    enablePending ||
    correoPending;
  const error =
    perfilState.error ||
    accesoState.error ||
    disableState.error ||
    enableState.error ||
    correoState.error;
  const nuncaEntro = !member.last_login_at;

  return (
    <DrawerShell
      title={userDisplayName(member.profile, member.email)}
      subtitle={`${ROLE_LABELS[member.role]} · ${memberStatusLabel(estado)}`}
      onClose={onClose}
      pending={pendiente}
      width={640}
    >
      {/* Pestañas con la forma única del Studio (SDD-0603, `.studio-tabs`). */}
      <div style={{ padding: "var(--s-3) var(--s-4) 0" }}>
        <div role="tablist" aria-label="Secciones de la ficha" className="studio-tabs">
          {(["perfil", "acceso", "actividad"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              id={`ficha-tab-${t}`}
              aria-selected={pestana === t}
              aria-controls={`ficha-panel-${t}`}
              data-activa={pestana === t ? "true" : undefined}
              tabIndex={pestana === t ? 0 : -1}
              className="studio-tab"
              onClick={() => setPestana(t)}
            >
              {t === "perfil" ? "Perfil" : t === "acceso" ? "Acceso" : "Actividad"}
            </button>
          ))}
        </div>
      </div>

      {pestana === "acceso" && (
        <div
          role="tabpanel"
          id="ficha-panel-acceso"
          aria-labelledby="ficha-tab-acceso"
          style={{ flex: 1, overflow: "auto", padding: "var(--s-4)" }}
        >
          {/* NO se pasa `onClose`: la ficha se queda abierta y `revalidatePath`
              la redibuja con la fila fresca (UsersClient guarda el ID). */}
          <AccesoPanel member={member} grants={grants} overrides={overrides} nombres={nombres} esYo={esYo} />
        </div>
      )}

      {pestana === "actividad" && (
        <div
          role="tabpanel"
          id="ficha-panel-actividad"
          aria-labelledby="ficha-tab-actividad"
          style={{ flex: 1, overflow: "auto", padding: "var(--s-4)" }}
        >
          <ActividadAcceso
            userId={member.user_id}
            nombres={nombres}
            version={grants.map((g) => `${g.moduleId}:${g.updatedAt}:${g.canEdit}`).join("|")}
          />
        </div>
      )}

      {pestana === "perfil" && (
      <div
        role="tabpanel"
        id="ficha-panel-perfil"
        aria-labelledby="ficha-tab-perfil"
        style={{
          flex: 1,
          overflow: "auto",
          padding: "var(--s-4)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-5)",
        }}
      >
        {/* ── Acceso ─────────────────────────────────────────── */}
        <Seccion titulo="Acceso">
          {/* Correo · editable (SDD-0272). Va detrás de un gesto explícito y
              no suelto entre los datos, porque guardarlo REVOCA los enlaces de
              acceso y las invitaciones vigentes del buzón anterior. */}
          <div
            style={{
              padding: "var(--s-2) 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--s-3)",
              }}
            >
              <span
                style={{
                  font: "400 12.5px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                Correo
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-2)",
                }}
              >
                <span
                  style={{
                    font: "500 12.5px/1.4 var(--f-mono)",
                    color: "var(--ink)",
                    textAlign: "right",
                    wordBreak: "break-all",
                  }}
                >
                  {member.email}
                </span>
                <button
                  type="button"
                  className="studio-btn studio-btn-ghost studio-btn-xs"
                  disabled={pendiente}
                  aria-expanded={editandoCorreo}
                  onClick={() => setEditandoCorreo((v) => !v)}
                >
                  {editandoCorreo ? "Cancelar" : "Cambiar"}
                </button>
              </span>
            </div>

            {editandoCorreo && (
              <form
                action={correoAction}
                style={{
                  marginTop: "var(--s-3)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--s-2)",
                }}
              >
                <input
                  type="hidden"
                  name="target_user_id"
                  value={member.user_id}
                />
                <Campo
                  id="ficha-correo"
                  nombre="new_email"
                  etiqueta="Correo nuevo"
                  defecto={member.email}
                  error={correoState.fieldErrors?.new_email}
                  disabled={pendiente}
                />
                <p
                  style={{
                    font: "400 11.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  Al guardar, los enlaces de acceso y las invitaciones que sigan
                  vigentes para <strong>{member.email}</strong> quedan anulados.
                  Las sesiones ya abiertas no se cierran — para eso está
                  «Suspender acceso».
                </p>
                <p
                  style={{
                    font: "400 11.5px/1.5 var(--f-sans)",
                    color: "var(--ink-soft)",
                    margin: 0,
                  }}
                >
                  Esto corrige la dirección de la <strong>misma</strong>{" "}
                  persona. Si cambió quién ocupa el puesto, desactiva a quien se
                  va e invita a quien llega: así el historial de cada quien
                  queda a su nombre.
                </p>
                {esYo && (
                  <p
                    role="alert"
                    style={{
                      font: "600 11.5px/1.5 var(--f-sans)",
                      color: "var(--ink)",
                      margin: 0,
                    }}
                  >
                    Es tu propio correo: de aquí en adelante entras con el
                    nuevo.
                  </p>
                )}
                <div>
                  <button
                    type="submit"
                    className="studio-btn studio-btn-primary studio-btn-sm"
                    disabled={pendiente}
                  >
                    {correoPending ? "Guardando…" : "Guardar correo"}
                  </button>
                </div>
              </form>
            )}

            {correoState.ok && (
              <p
                role="status"
                style={{
                  font: "600 11.5px/1.4 var(--f-sans)",
                  color: "var(--success)",
                  margin: "var(--s-2) 0 0",
                }}
              >
                Correo actualizado. Los enlaces anteriores quedaron anulados —
                mándale uno nuevo con «Enviar acceso».
              </p>
            )}
          </div>
          <Dato
            etiqueta="Último acceso"
            valor={formatLastLogin(member.last_login_at)}
            alerta={nuncaEntro}
          />
          {nuncaEntro && activo && (
            <p
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--s-2)",
                font: "500 12px/1.5 var(--f-sans)",
                color: "var(--ink)",
                margin: "var(--s-2) 0 0",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  marginTop: 5,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "var(--warning)",
                }}
              />
              Esta persona nunca ha entrado. Mándale su enlace de acceso para que
              cree su contraseña.
            </p>
          )}
        </Seccion>

        {/* El rol y el alcance se mudaron a la pestaña «Acceso» (SDD-0622),
            junto a los accesos extra: la pregunta es una sola, «qué puede
            hacer esta persona». */}

        {/* ── Datos editables ────────────────────────────────── */}
        <Seccion titulo="Datos de la persona">
          <form
            id="ficha-perfil-form"
            action={perfilAction}
            style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}
          >
            <input type="hidden" name="target_user_id" value={member.user_id} />
            <Campo
              id="ficha-first"
              nombre="first_name"
              etiqueta="Nombre"
              defecto={member.profile?.first_name ?? ""}
              error={perfilState.fieldErrors?.first_name}
              disabled={pendiente}
            />
            <Campo
              id="ficha-last"
              nombre="last_name"
              etiqueta="Apellido"
              defecto={member.profile?.last_name ?? ""}
              error={perfilState.fieldErrors?.last_name}
              disabled={pendiente}
            />
            <Campo
              id="ficha-cargo"
              nombre="position_label"
              etiqueta="Cargo"
              ayuda="Ej: Director general · Analista de operaciones. Hoy está vacío en todo el equipo."
              defecto={member.profile?.position_label ?? ""}
              error={perfilState.fieldErrors?.position_label}
              disabled={pendiente}
            />
            <Campo
              id="ficha-tel"
              nombre="phone"
              etiqueta="Teléfono"
              defecto={member.profile?.phone ?? ""}
              error={perfilState.fieldErrors?.phone}
              disabled={pendiente}
            />
          </form>
          {perfilState.ok && (
            <p
              role="status"
              style={{
                font: "600 12px/1.4 var(--f-sans)",
                color: "var(--success)",
                margin: "var(--s-2) 0 0",
              }}
            >
              Datos guardados.
            </p>
          )}
        </Seccion>

        {/* ── Acciones ───────────────────────────────────────── */}
        <Seccion titulo="Acciones de admin">
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
            {activo && (
              <form action={accesoAction} style={{ display: "inline" }}>
                <input type="hidden" name="target_user_id" value={member.user_id} />
                <button
                  type="submit"
                  disabled={pendiente}
                  className={`studio-btn studio-btn-sm ${nuncaEntro ? "studio-btn-primary" : "studio-btn-ghost"}`}
                  title="Le manda por correo un enlace para que cree su contraseña"
                >
                  {accesoPending ? "Enviando…" : "Enviar acceso"}
                </button>
              </form>
            )}

            {activo ? (
              <form action={disableAction} style={{ display: "inline" }}>
                <input type="hidden" name="target_user_id" value={member.user_id} />
                <button
                  type="submit"
                  disabled={pendiente}
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                  title="Le corta el acceso al Studio · reversible"
                  data-guia="usuarios.baja"
                >
                  {disablePending ? "Suspendiendo…" : "Suspender acceso"}
                </button>
              </form>
            ) : (
              <form action={enableAction} style={{ display: "inline" }}>
                <input type="hidden" name="target_user_id" value={member.user_id} />
                <button
                  type="submit"
                  disabled={pendiente}
                  className="studio-btn studio-btn-ghost studio-btn-sm"
                >
                  {enablePending ? "Reactivando…" : "Reactivar acceso"}
                </button>
              </form>
            )}
          </div>

          <p
            style={{
              font: "400 12px/1.5 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: "var(--s-3) 0 0",
            }}
          >
            Enviar un enlace nuevo <strong>no anula</strong> los anteriores.
            Suspender el acceso sí corta la sesión abierta.
          </p>

          {/* Rastro persistente: el admin necesita PODER COPIAR el enlace si el
              correo no llega, así que se queda en pantalla. */}
          {accesoState.ok && accesoState.accessLink && (
            <div
              style={{
                marginTop: "var(--s-3)",
                padding: "var(--s-2) var(--s-3)",
                background: "var(--success-bg)",
                borderRadius: "var(--r-sm)",
              }}
            >
              <div
                style={{
                  font: "600 12px/1.4 var(--f-sans)",
                  color: "var(--ink)",
                  marginBottom: "var(--s-2)",
                }}
              >
                Enlace enviado a {member.email}
              </div>
              <button
                type="button"
                className="studio-btn studio-btn-ghost studio-btn-xs"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(accesoState.accessLink as string)
                    .then(() => {
                      setCopiado(true);
                      setTimeout(() => setCopiado(false), 2500);
                    });
                }}
                title="Por si el correo no llega — pásaselo por un canal privado"
              >
                {copiado ? "Copiado" : "Copiar enlace"}
              </button>
            </div>
          )}
        </Seccion>

        {error && (
          <p
            role="alert"
            style={{
              font: "600 12.5px/1.45 var(--f-sans)",
              color: "var(--danger)",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
      </div>
      )}

      {pestana === "perfil" ? (
        <DrawerFooter
          formId="ficha-perfil-form"
          onClose={onClose}
          isPending={pendiente}
          canSubmit={!pendiente}
          submitLabel="Guardar datos"
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            padding: "var(--s-3) var(--s-4)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span style={{ flex: 1, font: "400 12px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
            Cada cambio de acceso queda en Actividad con quién, cuándo y motivo.
          </span>
          <button type="button" className="studio-btn studio-btn-ghost studio-btn-sm" onClick={onClose}>
            Cerrar
          </button>
        </div>
      )}
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers de presentación
// ─────────────────────────────────────────────────────────────

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3
        className="studio-eyebrow"
        style={{ margin: "0 0 var(--s-3)", color: "var(--ink-soft)" }}
      >
        {titulo}
      </h3>
      {children}
    </section>
  );
}

function Dato({
  etiqueta,
  valor,
  mono,
  alerta,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
  alerta?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--s-3)",
        padding: "var(--s-2) 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ font: "400 12.5px/1.4 var(--f-sans)", color: "var(--ink-soft)" }}>
        {etiqueta}
      </span>
      {alerta ? (
        <Badge tone="warning" size="sm">
          {valor}
        </Badge>
      ) : (
        <span
          style={{
            font: `500 12.5px/1.4 ${mono ? "var(--f-mono)" : "var(--f-sans)"}`,
            color: "var(--ink)",
            textAlign: "right",
          }}
        >
          {valor}
        </span>
      )}
    </div>
  );
}

function Campo({
  id,
  nombre,
  etiqueta,
  defecto,
  ayuda,
  error,
  disabled,
}: {
  id: string;
  nombre: string;
  etiqueta: string;
  defecto: string;
  ayuda?: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="studio-label">
        {etiqueta}
      </label>
      <input
        id={id}
        name={nombre}
        defaultValue={defecto}
        disabled={disabled}
        className="studio-input"
      />
      {ayuda && !error && (
        <p
          style={{
            font: "400 11.5px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: "4px 0 0",
          }}
        >
          {ayuda}
        </p>
      )}
      {error && (
        <p
          style={{
            font: "600 11.5px/1.4 var(--f-sans)",
            color: "var(--danger)",
            margin: "4px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
