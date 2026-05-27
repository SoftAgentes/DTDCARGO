"use client";

/**
 * InviteUserDrawer · form rico para invitar usuario (SDD-0024 Fase C).
 *
 * Layout siguiendo Claude Design v1.3.1:
 *   - Grid 2 col: Nombre + Apellido
 *   - Email full-width
 *   - Grid 2 col: Rol select + Equipo select
 *   - Scope warehouses (solo si rol matchea operations/warehouse/support):
 *     - Eyebrow + badge "N hubs"
 *     - Texto explicativo "este user solo verá X hubs"
 *     - Grid CN warehouses (5 hubs con flag + nombre bilingüe + sub)
 *     - Grid VE warehouses (4 hubs)
 *     - Cards permiso lectura/escritura
 *   - Toggle 2FA al primer login
 *   - Card resumen gradient navy con bullets dinámicos
 *
 * Fase C es UI-only: campos extras (Nombre/Apellido/Equipo/Scope/Permiso/
 * 2FA) NO se persisten todavía. La server action solo procesa email+role.
 * Schema upgrade llega en Fase B.
 *
 * Success view (post submit): link de copia + WhatsApp share fallback,
 * mientras Resend Fase 2 manda email automático.
 */

import { useActionState, useState } from "react";
import {
  DrawerShell,
  DrawerFooter,
} from "@/app/studio/_components/ui/drawer/DrawerShell";
import {
  ROLE_LABELS,
  STUDIO_USER_ROLES,
  type StudioUserRole,
  type UserActionState,
} from "@/lib/studio/user-types";
import { inviteUserAction } from "../actions";

const INITIAL: UserActionState = {};

interface Props {
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// Static data · Fase C UI-only. Cuando llegue schema real,
// estos hubs salen de warehouses table.
// ─────────────────────────────────────────────────────────────

const CN_WAREHOUSES = [
  { code: "YIW-A1", flag: "🇨🇳", name: "Yiwu · A1", sub: "义乌港二期 · directo" },
  { code: "YIW-A2", flag: "🇨🇳", name: "Yiwu · A2", sub: "义乌港二期 · transferencia" },
  { code: "CAN-C1", flag: "🇨🇳", name: "Guangzhou · C1", sub: "南沙 · puerto" },
  { code: "SZX-A2", flag: "🇨🇳", name: "Shenzhen · A2", sub: "盐田 · puerto" },
  { code: "SHA-A1", flag: "🇨🇳", name: "Shanghai · A1", sub: "浦东 · directo" },
];

const VE_WAREHOUSES = [
  { code: "PBL", flag: "🇻🇪", name: "Puerto Cabello", sub: "Carabobo · principal" },
  { code: "LGU", flag: "🇻🇪", name: "La Guaira", sub: "La Guaira · capital" },
  { code: "MAR", flag: "🇻🇪", name: "Maracaibo", sub: "Zulia · occidente" },
  { code: "PFI", flag: "🇻🇪", name: "Punto Fijo", sub: "Falcón · oriente" },
];

const TEAM_OPTIONS = [
  "Dirección",
  "Ventas",
  "Op. CN",
  "Op. VE",
  "Finanzas",
  "CX",
] as const;

const PERMISSION_OPTIONS = [
  {
    value: "read" as const,
    label: "Solo lectura",
    desc: "Ver recepciones · no editar",
  },
  {
    value: "write" as const,
    label: "Lectura + escritura",
    desc: "Crear y editar recepciones del hub",
  },
];

/** Roles que necesitan scope de almacén. */
const ROLES_WITH_SCOPE: StudioUserRole[] = ["operations", "warehouse", "support"];

// ─────────────────────────────────────────────────────────────

export function InviteUserDrawer({ onClose }: Props) {
  // Form state — algunos campos solo viven en UI hasta Fase B schema
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<StudioUserRole>("operations");
  const [team, setTeam] = useState<string>("Op. CN");
  const [scope, setScope] = useState<string[]>([]);
  const [permission, setPermission] = useState<"read" | "write">("write");
  // 2FA opcional · default OFF para no molestar en testing. Cada user
  // puede activarlo después desde "Mi perfil" → tab Contraseña/2FA.
  const [twoFa, setTwoFa] = useState(false);

  const [state, formAction, isPending] = useActionState(
    inviteUserAction,
    INITIAL,
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "err">("idle");

  const needsScope = ROLES_WITH_SCOPE.includes(role);

  const copyLink = async () => {
    if (!state.invitationLink) return;
    try {
      await navigator.clipboard.writeText(state.invitationLink);
      setCopyStatus("ok");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("err");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    }
  };

  const toggleScope = (code: string) => {
    setScope((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));
  };

  const handleRoleChange = (newRole: StudioUserRole) => {
    setRole(newRole);
    setScope([]); // reset scope al cambiar rol
  };

  return (
    <DrawerShell
      title="Invitar usuario"
      subtitle="Vamos a generar un link de invitación que expira en 7 días"
      onClose={onClose}
      pending={isPending}
      width={640}
    >
      {state.ok && state.invitationLink ? (
        <SuccessView
          invitationLink={state.invitationLink}
          onClose={onClose}
          copyStatus={copyStatus}
          onCopy={copyLink}
        />
      ) : (
        <>
          <form
            id="invite-user-form"
            action={formAction}
            style={{
              flex: 1,
              overflow: "auto",
              padding: "20px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <input type="hidden" name="role" value={role} />

            {/* ─── Nombre + Apellido ─── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Field
                label="Nombre"
                name="first_name"
                value={firstName}
                onChange={setFirstName}
                disabled={isPending}
                placeholder="María"
              />
              <Field
                label="Apellido"
                name="last_name"
                value={lastName}
                onChange={setLastName}
                disabled={isPending}
                placeholder="Pérez"
              />
            </div>

            {/* ─── Email ─── */}
            <Field
              label="Email"
              name="email"
              type="email"
              required
              value=""
              onChange={() => {}}
              uncontrolled
              error={state.fieldErrors?.email}
              disabled={isPending}
              placeholder="maria@dtdcargo.com"
            />

            {/* ─── Rol + Equipo ─── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <SelectField
                label="Rol"
                value={role}
                onChange={(v) => handleRoleChange(v as StudioUserRole)}
                disabled={isPending}
                options={STUDIO_USER_ROLES.map((r) => ({
                  value: r,
                  label: ROLE_LABELS[r],
                }))}
              />
              <SelectField
                label="Equipo"
                value={team}
                onChange={setTeam}
                disabled={isPending}
                options={TEAM_OPTIONS.map((t) => ({ value: t, label: t }))}
              />
            </div>

            {/* ─── Scope warehouses (solo si rol lo requiere) ─── */}
            {needsScope && (
              <ScopeSection
                scope={scope}
                onToggle={toggleScope}
                permission={permission}
                onPermissionChange={setPermission}
              />
            )}

            {/* ─── Toggle 2FA opcional ─── */}
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                background: "var(--bg-elevated)",
                borderRadius: 7,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={twoFa}
                onChange={(e) => setTwoFa(e.target.checked)}
                style={{
                  accentColor: "var(--wine)",
                  width: 16,
                  height: 16,
                  marginTop: 2,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    font: "500 12.5px/1.4 var(--font-sans, 'Archivo')",
                    color: "var(--ink)",
                  }}
                >
                  Sugerir 2FA al primer login{" "}
                  <span
                    style={{
                      color: "var(--ink-mute)",
                      fontWeight: 400,
                    }}
                  >
                    (opcional)
                  </span>
                </div>
                <div
                  style={{
                    font: "500 11px/1.4 var(--font-sans, 'Archivo')",
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  El user verá un prompt para activar 2FA, pero podrá saltarlo.
                  Nunca obligamos a configurar 2FA en testing.
                </div>
              </div>
            </label>

            {/* ─── Resumen gradient navy ─── */}
            <SummaryCard
              role={role}
              team={team}
              needsScope={needsScope}
              scope={scope}
              permission={permission}
              twoFa={twoFa}
            />

            {/* ─── Error general del action ─── */}
            {state.error && (
              <div
                role="alert"
                style={{
                  padding: "10px 12px",
                  background: "var(--danger-bg, #FCEDED)",
                  border: "1px solid var(--danger, #A8323E)",
                  borderRadius: 6,
                  color: "var(--danger, #A8323E)",
                  fontSize: 13,
                }}
              >
                {state.error}
              </div>
            )}

            {/* Disclaimer Fase C */}
            <p
              style={{
                font: "500 11px/1.4 var(--font-sans, 'Archivo')",
                color: "var(--ink-mute)",
                margin: 0,
              }}
            >
              V1 persiste solo email + rol. Nombre, equipo, scope, permiso y
              2FA viven en UI hasta que llegue Fase B del schema. Cuando el
              user acepte la invitación cargará su nombre.
            </p>
          </form>
          <DrawerFooter
            formId="invite-user-form"
            onClose={onClose}
            isPending={isPending}
            canSubmit={true}
            submitLabel={isPending ? "Generando…" : "Generar link"}
          />
        </>
      )}
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Scope section
// ─────────────────────────────────────────────────────────────

function ScopeSection({
  scope,
  onToggle,
  permission,
  onPermissionChange,
}: {
  scope: string[];
  onToggle: (code: string) => void;
  permission: "read" | "write";
  onPermissionChange: (p: "read" | "write") => void;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            font: "600 11px/1 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Almacén/es asignado/s
        </span>
        <ScopeBadge count={scope.length} />
      </div>
      <div
        style={{
          font: "500 11px/1.4 var(--font-sans, 'Archivo')",
          color: "var(--ink-mute)",
          marginBottom: 10,
        }}
      >
        Este usuario solo verá recepciones y embarques del/los hub/s
        seleccionados.{" "}
        <b style={{ color: "var(--ink)" }}>
          No podrá cambiar de almacén ni ver otros hubs.
        </b>
      </div>

      {/* CN */}
      <div
        className="studio-eyebrow"
        style={{
          color: "var(--wine)",
          marginBottom: 8,
          fontSize: 10,
        }}
      >
        🇨🇳 Almacenes China
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {CN_WAREHOUSES.map((w) => (
          <WarehouseCheckbox
            key={w.code}
            warehouse={w}
            checked={scope.includes(w.code)}
            onToggle={() => onToggle(w.code)}
          />
        ))}
      </div>

      {/* VE */}
      <div
        className="studio-eyebrow"
        style={{
          color: "var(--wine)",
          marginBottom: 8,
          fontSize: 10,
        }}
      >
        🇻🇪 Almacenes Venezuela
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 14,
        }}
      >
        {VE_WAREHOUSES.map((w) => (
          <WarehouseCheckbox
            key={w.code}
            warehouse={w}
            checked={scope.includes(w.code)}
            onToggle={() => onToggle(w.code)}
          />
        ))}
      </div>

      {/* Permiso lectura/escritura */}
      <div>
        <span
          style={{
            display: "block",
            font: "600 11px/1 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Permiso dentro del almacén
        </span>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
          }}
        >
          {PERMISSION_OPTIONS.map((opt) => {
            const sel = permission === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPermissionChange(opt.value)}
                style={{
                  padding: 12,
                  textAlign: "left",
                  background: sel ? "var(--wine-tint, #FBE9EC)" : "var(--bg-surface)",
                  border: `1.5px solid ${sel ? "var(--wine)" : "var(--border)"}`,
                  borderRadius: 7,
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <div
                  style={{
                    font: "700 12.5px/1.2 var(--font-sans, 'Archivo')",
                    color: sel ? "var(--wine)" : "var(--ink)",
                  }}
                >
                  {opt.label}
                </div>
                <div
                  style={{
                    font: "500 11px/1.3 var(--font-sans, 'Archivo')",
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WarehouseCheckbox({
  warehouse,
  checked,
  onToggle,
}: {
  warehouse: { code: string; flag: string; name: string; sub: string };
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        cursor: "pointer",
        background: checked ? "var(--wine-tint, #FBE9EC)" : "var(--bg-surface)",
        border: `1px solid ${checked ? "var(--wine)" : "var(--border)"}`,
        borderRadius: 7,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ accentColor: "var(--wine)" }}
      />
      <span style={{ fontSize: 16 }}>{warehouse.flag}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: "700 12px/1.2 var(--font-sans, 'Archivo')",
            color: "var(--ink)",
          }}
        >
          {warehouse.name}
        </div>
        <div
          style={{
            font: "500 10.5px/1.2 var(--font-sans, 'Archivo')",
            color: "var(--ink-soft)",
            marginTop: 2,
          }}
        >
          {warehouse.sub}
        </div>
      </div>
    </label>
  );
}

function ScopeBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        background: "var(--wine-tint, #FBE9EC)",
        color: "var(--wine, #7F0F1A)",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {count === 0 ? "sin definir" : `${count} hub${count > 1 ? "s" : ""}`}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Summary card · gradient navy
// ─────────────────────────────────────────────────────────────

function SummaryCard({
  role,
  team,
  needsScope,
  scope,
  permission,
  twoFa,
}: {
  role: StudioUserRole;
  team: string;
  needsScope: boolean;
  scope: string[];
  permission: "read" | "write";
  twoFa: boolean;
}) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background:
          "linear-gradient(135deg, var(--ink) 0%, #1F3055 100%)",
        color: "#fff",
        borderRadius: 7,
      }}
    >
      <div
        style={{
          font: "700 10.5px/1 var(--font-sans, 'Archivo')",
          color: "var(--wine-soft, #C2747F)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        Este usuario podrá:
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          font: "500 12.5px/1.6 var(--font-sans, 'Archivo')",
          color: "var(--ink-inv-soft, rgba(255,255,255,0.85))",
        }}
      >
        <div>
          ✓ Rol: <b style={{ color: "#fff" }}>{ROLE_LABELS[role]}</b>
        </div>
        <div>
          ✓ Equipo: <b style={{ color: "#fff" }}>{team}</b>
        </div>
        {needsScope ? (
          scope.length > 0 ? (
            <div>
              ✓ Ver solo:{" "}
              <b style={{ color: "#fff" }}>{scope.join(" · ")}</b> (
              {permission === "write" ? "lectura + escritura" : "solo lectura"})
            </div>
          ) : (
            <div style={{ color: "var(--wine-soft, #C2747F)" }}>
              ⚠ Falta asignar al menos un almacén
            </div>
          )
        ) : (
          <div>✓ Acceso global · sin restricción por almacén</div>
        )}
        {twoFa && <div>✓ Se le sugerirá activar 2FA (opcional)</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Success view post-submit
// ─────────────────────────────────────────────────────────────

function SuccessView({
  invitationLink,
  onClose,
  copyStatus,
  onCopy,
}: {
  invitationLink: string;
  onClose: () => void;
  copyStatus: "idle" | "ok" | "err";
  onCopy: () => void;
}) {
  return (
    <>
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            padding: 14,
            background: "var(--success-bg, #E5F4ED)",
            border: "1px solid var(--success, #1F8A5B)",
            borderRadius: 6,
            fontSize: 13,
            color: "var(--ink)",
          }}
        >
          <strong style={{ color: "var(--success, #1F8A5B)" }}>
            Invitación creada
          </strong>
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--ink-soft)",
              fontSize: 12,
            }}
          >
            Copiá el link y mandáselo a tu invitado por WhatsApp, email o como
            prefieras. Expira en 7 días. (Cuando Resend esté listo, el sistema
            lo manda automático.)
          </p>
        </div>

        <div>
          <span
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-soft)",
              display: "block",
              marginBottom: 6,
            }}
          >
            Link de invitación
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
            <input
              type="text"
              readOnly
              value={invitationLink}
              onFocus={(e) => e.target.select()}
              style={{
                flex: 1,
                height: 38,
                padding: "0 10px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--bg-elevated)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 12,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={onCopy}
              className="studio-btn studio-btn-primary studio-btn-sm"
              style={{ minWidth: 100 }}
            >
              {copyStatus === "ok"
                ? "✓ Copiado"
                : copyStatus === "err"
                  ? "Error"
                  : "Copiar"}
            </button>
          </div>
        </div>
      </div>
      <footer
        style={{
          padding: "14px 22px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="studio-btn studio-btn-primary"
          onClick={onClose}
        >
          Cerrar
        </button>
      </footer>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Generic field helpers
// ─────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  disabled,
  required,
  uncontrolled,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email";
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  /** Si true, no setea value (el input es uncontrolled — útil para email que va al FormData). */
  uncontrolled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        htmlFor={`invite-${name}`}
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </label>
      <input
        id={`invite-${name}`}
        name={name}
        type={type}
        {...(uncontrolled ? {} : { value })}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        autoComplete={
          type === "email" ? "email" : name === "first_name" ? "given-name" : "family-name"
        }
        className="studio-input"
        style={
          error
            ? { borderColor: "var(--danger, #A8323E)" }
            : undefined
        }
      />
      {error && (
        <span
          style={{
            color: "var(--danger)",
            fontSize: 11.5,
            fontWeight: 600,
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="studio-input"
        style={{ cursor: "pointer" }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
