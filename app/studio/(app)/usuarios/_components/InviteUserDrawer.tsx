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
  STUDIO_USER_ROLES,
  type StudioUserRole,
  type UserActionState,
} from "@/lib/studio/user-types";
import {
  REGION_DEFAULTS,
  SUPPORTED_REGIONS,
  useT,
  type I18nKey,
  type UserRegion,
} from "@/lib/i18n";
import { ErrorAlert } from "@/app/studio/_components/ui/ErrorAlert";
import { Aviso } from "@/app/studio/_components/ui/Aviso";

/** Rol → I18nKey para localizar labels en select + summary. */
const ROLE_KEY: Record<StudioUserRole, I18nKey> = {
  admin: "users.role.admin",
  commercial: "users.role.commercial",
  operations: "users.role.operations",
  accounting: "users.role.accounting",
  warehouse: "users.role.warehouse",
  support: "users.role.support",
  marketing: "users.role.marketing",
};
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

/** Equipos · value = identificador interno (Fase C UI-only), labelKey = display. */
const TEAM_OPTIONS: { value: string; labelKey: I18nKey }[] = [
  { value: "Dirección", labelKey: "users.team.direccion" },
  { value: "Ventas", labelKey: "users.team.ventas" },
  { value: "Op. CN", labelKey: "users.team.op_cn" },
  { value: "Op. VE", labelKey: "users.team.op_ve" },
  { value: "Finanzas", labelKey: "users.team.finanzas" },
  { value: "CX", labelKey: "users.team.cx" },
];
const TEAM_KEY_BY_VALUE: Record<string, I18nKey> = Object.fromEntries(
  TEAM_OPTIONS.map((o) => [o.value, o.labelKey]),
);

const PERMISSION_OPTIONS: {
  value: "read" | "write";
  labelKey: I18nKey;
  descKey: I18nKey;
}[] = [
  {
    value: "read",
    labelKey: "users.permission.read",
    descKey: "users.permission.read_desc",
  },
  {
    value: "write",
    labelKey: "users.permission.write",
    descKey: "users.permission.write_desc",
  },
];

/** Roles que necesitan scope de almacén. */
const ROLES_WITH_SCOPE: StudioUserRole[] = ["operations", "warehouse", "support"];

// ─────────────────────────────────────────────────────────────

export function InviteUserDrawer({ onClose }: Props) {
  const t = useT();
  // Form state — algunos campos solo viven en UI hasta Fase B schema
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [region, setRegion] = useState<UserRegion>("ve");
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
      title={t("users.invite.title")}
      subtitle={t("users.invite.subtitle")}
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
            <input type="hidden" name="region" value={region} />

            {/* ─── Nombre + Apellido ─── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <Field
                label={t("users.field.first_name")}
                name="first_name"
                value={firstName}
                onChange={setFirstName}
                disabled={isPending}
                placeholder={t("users.field.first_name_ph")}
              />
              <Field
                label={t("users.field.last_name")}
                name="last_name"
                value={lastName}
                onChange={setLastName}
                disabled={isPending}
                placeholder={t("users.field.last_name_ph")}
              />
            </div>

            {/* ─── Email ─── */}
            <Field
              label={t("users.field.email")}
              name="email"
              type="email"
              required
              value=""
              onChange={() => {}}
              uncontrolled
              error={state.fieldErrors?.email}
              disabled={isPending}
              placeholder={t("users.field.email_ph")}
            />

            {/* ─── Oficina (region) ─── */}
            <OfficePicker
              region={region}
              onChange={setRegion}
              disabled={isPending}
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
                label={t("users.field.role")}
                value={role}
                onChange={(v) => handleRoleChange(v as StudioUserRole)}
                disabled={isPending}
                options={STUDIO_USER_ROLES.map((r) => ({
                  value: r,
                  label: t(ROLE_KEY[r]),
                }))}
              />
              <SelectField
                label={t("users.field.team")}
                value={team}
                onChange={setTeam}
                disabled={isPending}
                options={TEAM_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: t(opt.labelKey),
                }))}
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
                    font: "500 12.5px/1.4 var(--f-sans)",
                    color: "var(--ink)",
                  }}
                >
                  {t("users.twofa.label")}{" "}
                  <span
                    style={{
                      color: "var(--ink-soft)",
                      fontWeight: 400,
                    }}
                  >
                    {t("users.twofa.optional")}
                  </span>
                </div>
                <div
                  style={{
                    font: "500 11px/1.4 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  {t("users.twofa.desc")}
                </div>
              </div>
            </label>

            {/* ─── Resumen gradient navy ─── */}
            <SummaryCard
              region={region}
              role={role}
              team={team}
              needsScope={needsScope}
              scope={scope}
              permission={permission}
              twoFa={twoFa}
            />

            {/* ─── Error general del action · prioriza errorCode traducido ─── */}
            <ErrorAlert state={state} />

            {/* Disclaimer Fase C */}
            <p
              style={{
                font: "500 11px/1.4 var(--f-sans)",
                color: "var(--ink-soft)",
                margin: 0,
              }}
            >
              {t("users.disclaimer")}
            </p>
          </form>
          <DrawerFooter
            formId="invite-user-form"
            onClose={onClose}
            isPending={isPending}
            canSubmit={true}
            submitLabel={
              isPending
                ? t("users.invite.submit_loading")
                : t("users.invite.submit_idle")
            }
          />
        </>
      )}
    </DrawerShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Office picker · selector de region (VE / CN) con cards visuales
// ─────────────────────────────────────────────────────────────

function OfficePicker({
  region,
  onChange,
  disabled,
}: {
  region: UserRegion;
  onChange: (r: UserRegion) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-soft)",
        }}
      >
        {t("users.office.label")}
      </span>
      <div
        role="radiogroup"
        aria-label={t("users.office.aria")}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
      >
        {SUPPORTED_REGIONS.map((r) => {
          const cfg = REGION_DEFAULTS[r];
          const sel = region === r;
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => onChange(r)}
              disabled={disabled}
              style={{
                padding: "12px 14px",
                textAlign: "left",
                background: sel
                  ? "var(--wine-tint, #FBE9EC)"
                  : "var(--bg-surface)",
                border: `1.5px solid ${sel ? "var(--wine)" : "var(--border)"}`,
                borderRadius: 7,
                cursor: disabled ? "not-allowed" : "pointer",
                font: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{cfg.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    font: "700 13px/1.2 var(--f-sans)",
                    color: sel ? "var(--wine)" : "var(--ink)",
                  }}
                >
                  {cfg.officeLabel}
                </div>
                <div
                  style={{
                    font: "500 10.5px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 2,
                  }}
                >
                  {cfg.locale === "zh-CN"
                    ? "中文 · " + cfg.timezone.split("/")[1] + " · " + cfg.currency
                    : cfg.locale + " · " + cfg.timezone.split("/")[1] + " · " + cfg.currency}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: 0,
        }}
      >
        {t("users.office.hint")}
      </p>
    </div>
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
  const t = useT();
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
            font: "600 11px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {t("users.scope.assigned_label")}
        </span>
        <ScopeBadge count={scope.length} />
      </div>
      <div
        style={{
          font: "500 11px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          marginBottom: 10,
        }}
      >
        {t("users.scope.explainer")}{" "}
        <b style={{ color: "var(--ink)" }}>
          {t("users.scope.explainer_bold")}
        </b>
      </div>

      {/* CN */}
      <div
        className="studio-eyebrow"
        style={{
          color: "var(--wine-text)",
          marginBottom: 8,
          fontSize: 10,
        }}
      >
        {t("users.scope.cn_group")}
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
          color: "var(--wine-text)",
          marginBottom: 8,
          fontSize: 10,
        }}
      >
        {t("users.scope.ve_group")}
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
            font: "600 11px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          {t("users.scope.permission_label")}
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
                    font: "700 12.5px/1.2 var(--f-sans)",
                    color: sel ? "var(--wine)" : "var(--ink)",
                  }}
                >
                  {t(opt.labelKey)}
                </div>
                <div
                  style={{
                    font: "500 11px/1.3 var(--f-sans)",
                    color: "var(--ink-soft)",
                    marginTop: 4,
                  }}
                >
                  {t(opt.descKey)}
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
            font: "700 12px/1.2 var(--f-sans)",
            color: "var(--ink)",
          }}
        >
          {warehouse.name}
        </div>
        <div
          style={{
            font: "500 10.5px/1.2 var(--f-sans)",
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
  const t = useT();
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 var(--s-2)",
        background: "var(--wine-tint, #FBE9EC)",
        color: "var(--wine, #7F0F1A)",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {count === 0
        ? t("users.scope.badge_empty")
        : t(
            count > 1
              ? "users.scope.badge_count_plural"
              : "users.scope.badge_count",
            { count },
          )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Summary card · gradient navy
// ─────────────────────────────────────────────────────────────

function SummaryCard({
  region,
  role,
  team,
  needsScope,
  scope,
  permission,
  twoFa,
}: {
  region: UserRegion;
  role: StudioUserRole;
  team: string;
  needsScope: boolean;
  scope: string[];
  permission: "read" | "write";
  twoFa: boolean;
}) {
  const t = useT();
  const regionCfg = REGION_DEFAULTS[region];
  return (
    <div
      style={{
        padding: "14px 16px",
        background:
          "linear-gradient(135deg, #0F1E3D 0%, #1F3055 100%)",
        color: "#fff",
        borderRadius: 7,
      }}
    >
      <div
        style={{
          font: "700 10.5px/1 var(--f-sans)",
          color: "var(--wine-soft, #C2747F)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {t("users.summary.heading")}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          font: "500 12.5px/1.6 var(--f-sans)",
          color: "var(--ink-inv-soft, rgba(255,255,255,0.85))",
        }}
      >
        <div>
          ✓ {t("users.summary.office")}{" "}
          <b style={{ color: "#fff" }}>
            {regionCfg.flag} {regionCfg.officeLabel}
          </b>{" "}
          <span style={{ color: "var(--wine-soft, #C2747F)" }}>
            ({regionCfg.locale} · {regionCfg.currency})
          </span>
        </div>
        <div>
          ✓ {t("users.summary.role")}{" "}
          <b style={{ color: "#fff" }}>{t(ROLE_KEY[role])}</b>
        </div>
        <div>
          ✓ {t("users.summary.team")}{" "}
          <b style={{ color: "#fff" }}>
            {TEAM_KEY_BY_VALUE[team] ? t(TEAM_KEY_BY_VALUE[team]) : team}
          </b>
        </div>
        {needsScope ? (
          scope.length > 0 ? (
            <div>
              ✓ {t("users.summary.see_only")}{" "}
              <b style={{ color: "#fff" }}>{scope.join(" · ")}</b> (
              {permission === "write"
                ? t("users.summary.perm_write")
                : t("users.summary.perm_read")}
              )
            </div>
          ) : (
            <div style={{ color: "var(--wine-soft, #C2747F)" }}>
              {t("users.summary.missing_warehouse")}
            </div>
          )
        ) : (
          <div>{t("users.summary.global_access")}</div>
        )}
        {twoFa && <div>{t("users.summary.twofa_suggested")}</div>}
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
  const t = useT();
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
        <Aviso tono="exito" titulo={t("users.success.title")}>
          {t("users.success.body")}
        </Aviso>

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
            {t("users.success.link_label")}
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
                fontFamily: "var(--f-mono)",
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
                ? t("users.success.copied")
                : copyStatus === "err"
                  ? t("users.success.copy_error")
                  : t("users.success.copy")}
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
          {t("users.success.close")}
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
