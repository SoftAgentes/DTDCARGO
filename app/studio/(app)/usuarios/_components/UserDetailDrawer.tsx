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
 * NO trae "actividad reciente" a propósito. El Norte la dibuja, pero antes de
 * prometerla hay que resolver de dónde salen esos datos: hoy la auditoría vive
 * repartida en varias tablas y no hay una vista por persona. Dibujarla con
 * datos inventados sería peor que no tenerla.
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
import { RolYAlcanceCard } from "./ficha/RolYAlcanceCard";
import {
  changeMemberEmailAction,
  disableUserAction,
  enableUserAction,
  sendAccessLinkAction,
  updateMemberProfileAction,
} from "../actions";

const INICIAL: UserActionState = {};

export function UserDetailDrawer({
  member,
  esYo,
  onClose,
}: {
  member: UserMembershipWithProfile;
  /** El admin se está mirando a sí mismo — cambia el aviso del correo. */
  esYo?: boolean;
  onClose: () => void;
}) {
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
      width={620}
    >
      <div
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

        {/* ── Rol y alcance ──────────────────────────────────── */}
        <Seccion titulo="Rol y alcance">
          <RolYAlcanceCard member={member} esYo={esYo} onCambio={onClose} />
        </Seccion>

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

      <DrawerFooter
        formId="ficha-perfil-form"
        onClose={onClose}
        isPending={pendiente}
        canSubmit={!pendiente}
        submitLabel="Guardar datos"
      />
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
        <Badge tone="warning" size="sm" dot>
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
