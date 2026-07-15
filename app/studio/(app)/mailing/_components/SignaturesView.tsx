"use client";

/**
 * SignaturesView · Mailing → Firmas (SDD-0143 · portado del Norte
 * erp/modules/mailing-signatures.jsx).
 *
 * Grid 280px / 1fr:
 *   - Izquierda: lista del equipo del tenant (Avatar + nombre + cargo +
 *     Badge con el layout configurado o "sin firma"). Seleccionable.
 *   - Derecha: editor de la firma del miembro seleccionado — selector de 5
 *     layouts (thumbnails), campos de datos, idioma, campo foto condicional,
 *     y preview en vivo de la firma renderizada como HTML real de email.
 *
 * El preview usa `renderSignatureHtml` (lib/studio/mail-signature-render.ts),
 * la misma función pura que Compose puede reusar para adjuntar la firma.
 *
 * Guardado: useActionState(upsertMailSignatureAction) + <ActionButton>.
 * Admin edita la firma de CUALQUIER miembro (la action usa admin client).
 */

import { useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/app/studio/_components/ui/Avatar";
import { Badge } from "@/app/studio/_components/ui/Badge";
import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { ActionButton } from "@/app/studio/_components/ui/ActionButton";
import { Icon } from "@/app/studio/_components/icons";
import {
  MAIL_SIGNATURE_LANGS,
  signatureLangLabel,
  type MailSignature,
  type MailSignatureLang,
  type MailSignatureLayout,
} from "@/lib/studio/mail-types";
import { renderSignatureHtml } from "@/lib/studio/mail-signature-render";
import { upsertMailSignatureAction } from "../actions";
import {
  INITIAL_MAILING_STATE,
  type SignatureTeamMember,
} from "./mailing-types";

interface Props {
  signatures: MailSignature[];
  members: SignatureTeamMember[];
}

// Nombres bonitos del Norte → enum mail_signature_layout.
const LAYOUT_OPTIONS: Array<{
  value: MailSignatureLayout;
  name: string;
  desc: string;
  usesPhoto: boolean;
}> = [
  { value: "corporate", name: "Clásico", desc: "Barra lateral + datos completos", usesPhoto: false },
  { value: "inline", name: "Compacto", desc: "Todo en una línea", usesPhoto: false },
  { value: "card", name: "Vertical", desc: "Tarjeta con borde", usesPhoto: false },
  { value: "minimal", name: "Mínimo", desc: "Nombre + email", usesPhoto: false },
  { value: "image_only", name: "Foto", desc: "Avatar + datos", usesPhoto: true },
];

const LAYOUT_SHORT: Record<MailSignatureLayout, string> = {
  corporate: "Clásico",
  inline: "Compacto",
  card: "Vertical",
  minimal: "Mínimo",
  image_only: "Foto",
};

export function SignaturesView({ signatures, members }: Props) {
  const sigByUser = useMemo(() => {
    const map = new Map<string, MailSignature>();
    for (const s of signatures) map.set(s.user_id, s);
    return map;
  }, [signatures]);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    members[0]?.userId ?? null,
  );

  if (members.length === 0) {
    return (
      <EmptyState
        eyebrow="Sin equipo"
        title="No hay miembros en este tenant"
        description="Invita usuarios desde Usuarios & Roles para configurarles la firma."
      />
    );
  }

  const selectedMember =
    members.find((m) => m.userId === selectedUserId) ?? null;
  const selectedSig = selectedUserId
    ? sigByUser.get(selectedUserId) ?? null
    : null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      {/* IZQUIERDA · lista del equipo */}
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 16px 10px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
            Equipo interno
          </div>
          <div
            style={{
              font: "900 14px/1 var(--f-display)",
              color: "var(--ink)",
              marginTop: 6,
            }}
          >
            Firmas configuradas
          </div>
        </div>
        <div>
          {members.map((m) => {
            const sig = sigByUser.get(m.userId);
            const isActive = m.userId === selectedUserId;
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => setSelectedUserId(m.userId)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderTop: "1px solid var(--border)",
                  background: isActive ? "var(--wine-tint)" : "transparent",
                  textAlign: "left",
                  cursor: "pointer",
                  border: "none",
                  borderTopWidth: 1,
                  borderTopStyle: "solid",
                  borderTopColor: "var(--border)",
                }}
              >
                <Avatar
                  initials={m.initials}
                  color={isActive ? "wine" : "neutral"}
                  size={32}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      font: "600 12.5px/1.2 var(--f-sans)",
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </div>
                  <div
                    style={{
                      font: "500 11px/1.2 var(--f-sans)",
                      color: "var(--ink-soft)",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.positionLabel || m.roleLabel}
                  </div>
                </div>
                {sig ? (
                  <Badge tone="success" size="sm">
                    {LAYOUT_SHORT[sig.layout]}
                  </Badge>
                ) : (
                  <Badge tone="neutral" size="sm">
                    Sin firma
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* DERECHA · editor */}
      <div>
        {selectedMember ? (
          <SignatureEditor
            key={selectedMember.userId}
            member={selectedMember}
            sig={selectedSig}
          />
        ) : (
          <EmptyState
            eyebrow="Firmas"
            title="Elige un miembro del equipo"
            description="Selecciona a alguien de la lista para ver o configurar su firma."
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SignatureEditor · un miembro
// ─────────────────────────────────────────────────────────────

function SignatureEditor({
  member,
  sig,
}: {
  member: SignatureTeamMember;
  sig: MailSignature | null;
}) {
  const [state, setState] =
    useState<typeof INITIAL_MAILING_STATE>(INITIAL_MAILING_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  // Valores iniciales: la firma existente o defaults derivados del miembro.
  const [layout, setLayout] = useState<MailSignatureLayout>(
    sig?.layout ?? "corporate",
  );
  const [fullName, setFullName] = useState(sig?.full_name ?? member.name);
  const [roleLabel, setRoleLabel] = useState(
    sig?.role_label ?? member.positionLabel ?? member.roleLabel,
  );
  const [email, setEmail] = useState(sig?.email ?? member.email);
  const [phone, setPhone] = useState(sig?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(sig?.whatsapp ?? "");
  const [companyName, setCompanyName] = useState(
    sig?.company_name ?? "DTD Cargo",
  );
  const [lang, setLang] = useState<MailSignatureLang>(sig?.lang ?? "es");
  const [photoUrl, setPhotoUrl] = useState(sig?.photo_url ?? "");

  const fieldErrors = state.fieldErrors ?? {};
  const usesPhoto = layout === "image_only";
  const canSubmit = fullName.trim().length >= 2;

  const previewHtml = renderSignatureHtml({
    layout,
    full_name: fullName,
    role_label: roleLabel,
    email,
    phone,
    photo_url: photoUrl,
    company_name: companyName,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Selector de layout */}
      <Card>
        <div className="studio-eyebrow" style={{ color: "var(--wine-text)" }}>
          Layout
        </div>
        <div
          style={{
            font: "900 16px/1.2 var(--f-display)",
            color: "var(--ink)",
            margin: "6px 0 14px",
          }}
        >
          Elige el formato de la firma
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 10,
          }}
        >
          {LAYOUT_OPTIONS.map((opt) => {
            const isActive = layout === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLayout(opt.value)}
                style={{
                  padding: "12px 10px",
                  textAlign: "left",
                  background: isActive
                    ? "var(--wine-tint)"
                    : "var(--bg-surface)",
                  border: `1.5px solid ${
                    isActive ? "var(--wine)" : "var(--border)"
                  }`,
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                }}
              >
                <LayoutThumb layout={opt.value} active={isActive} />
                <div
                  style={{
                    font: "700 12px/1.2 var(--f-sans)",
                    color: isActive ? "var(--wine)" : "var(--ink)",
                    marginTop: 8,
                  }}
                >
                  {opt.name}
                </div>
                <div
                  style={{
                    font: "500 10.5px/1.3 var(--f-sans)",
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
        {fieldErrors.layout && <FieldError>{fieldErrors.layout}</FieldError>}
      </Card>

      {/* Datos + Preview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <Card>
          <div
            className="studio-eyebrow"
            style={{ color: "var(--wine-text)", marginBottom: 14 }}
          >
            Datos
          </div>

          <form
            ref={formRef}
            id="signature-form"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <input type="hidden" name="user_id" value={member.userId} />
            <input type="hidden" name="layout" value={layout} />

            <Field
              label="Nombre"
              name="full_name"
              value={fullName}
              onChange={setFullName}
              error={fieldErrors.full_name}
            />
            <Field
              label="Cargo"
              name="role_label"
              value={roleLabel}
              onChange={setRoleLabel}
              error={fieldErrors.role_label}
            />
            <Field
              label="Email"
              name="email"
              type="email"
              value={email}
              onChange={setEmail}
              error={fieldErrors.email}
            />
            <Field
              label="Teléfono"
              name="phone"
              value={phone}
              onChange={setPhone}
              mono
            />
            <Field
              label="WhatsApp"
              name="whatsapp"
              value={whatsapp}
              onChange={setWhatsapp}
              mono
            />
            <Field
              label="Empresa"
              name="company_name"
              value={companyName}
              onChange={setCompanyName}
            />

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="studio-label">Idioma por defecto</span>
              <select
                name="lang"
                value={lang}
                onChange={(e) => setLang(e.target.value as MailSignatureLang)}
                className="studio-input"
              >
                {MAIL_SIGNATURE_LANGS.map((l) => (
                  <option key={l} value={l}>
                    {signatureLangLabel(l)}
                  </option>
                ))}
              </select>
              {fieldErrors.lang && <FieldError>{fieldErrors.lang}</FieldError>}
            </label>

            {usesPhoto && (
              <Field
                label="Foto (URL o iniciales)"
                name="photo_url"
                value={photoUrl}
                onChange={setPhotoUrl}
                placeholder="MA o https://…"
              />
            )}
          </form>

          {state.error && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "var(--danger-bg)",
                color: "var(--danger)",
                borderRadius: "var(--r-md)",
                font: "500 12px/1.4 var(--f-sans)",
              }}
            >
              {state.error}
            </div>
          )}
          {state.ok && state.message && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "var(--success-bg)",
                color: "var(--success)",
                borderRadius: "var(--r-md)",
                font: "500 12px/1.4 var(--f-sans)",
              }}
            >
              {state.message}
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <ActionButton
              variant="primary"
              size="sm"
              idleLabel="Guardar firma"
              loadingLabel="Guardando…"
              successLabel="Firma guardada"
              idleIcon={Icon.check(14)}
              successIcon={Icon.check(14)}
              disabled={!canSubmit}
              onAction={async () => {
                const form = formRef.current;
                if (!form) return { error: "Formulario no disponible." };
                const result = await upsertMailSignatureAction(
                  INITIAL_MAILING_STATE,
                  new FormData(form),
                );
                setState(result);
                if (result.error) return { error: result.error };
                if (
                  result.fieldErrors &&
                  Object.keys(result.fieldErrors).length > 0
                ) {
                  return { error: "Revisa los campos marcados." };
                }
                return undefined;
              }}
            />
          </div>
        </Card>

        <Card>
          <div
            className="studio-eyebrow"
            style={{ color: "var(--wine-text)", marginBottom: 14 }}
          >
            Preview
          </div>
          <div
            style={{
              background: "#FBFAF7",
              padding: 24,
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              minHeight: 220,
            }}
            // El preview es HTML de email generado por renderSignatureHtml
            // (función propia, valores del usuario escapados). No es input
            // externo sin sanitizar.
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              background: "var(--info-bg)",
              borderRadius: "var(--r-md)",
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <span style={{ color: "var(--info)", flexShrink: 0 }}>
              {Icon.info(13)}
            </span>
            <div
              style={{
                font: "500 11.5px/1.4 var(--f-sans)",
                color: "var(--ink)",
              }}
            >
              La firma se aplica al final de cada correo que envíes desde el ERP.
              Puedes sobreescribirla manualmente en Envío manual.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────

function Card({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 18,
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  mono = false,
  placeholder,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  mono?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="studio-label">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "studio-input studio-input-mono" : "studio-input"}
      />
      {error && <FieldError>{error}</FieldError>}
    </label>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        font: "500 11px/1.3 var(--f-sans)",
        color: "var(--danger)",
      }}
    >
      {children}
    </span>
  );
}

// ── Thumbnails de layout (mini visual) ───────────────────────
function LayoutThumb({
  layout,
  active,
}: {
  layout: MailSignatureLayout;
  active: boolean;
}) {
  const svgStyle: CSSProperties = {
    width: "100%",
    height: 56,
    background: active ? "var(--bg-surface)" : "var(--bg-elevated)",
    borderRadius: 4,
  };
  const stripe = "var(--wine)";
  const text = active ? "var(--ink)" : "var(--ink-soft)";
  const mute = "var(--ink-mute, #B5B5B5)";

  if (layout === "corporate") {
    return (
      <svg viewBox="0 0 80 56" style={svgStyle}>
        <rect x="8" y="10" width="2" height="36" fill={stripe} />
        <rect x="14" y="12" width="40" height="4" rx="1" fill={text} />
        <rect x="14" y="20" width="30" height="3" rx="1" fill={mute} />
        <rect x="14" y="28" width="38" height="2.5" rx="1" fill={mute} />
        <rect x="14" y="34" width="32" height="2.5" rx="1" fill={mute} />
        <rect x="14" y="42" width="22" height="2.5" rx="1" fill={stripe} />
      </svg>
    );
  }
  if (layout === "inline") {
    return (
      <svg viewBox="0 0 80 56" style={svgStyle}>
        <rect x="6" y="24" width="68" height="2.5" rx="1" fill={text} />
        <rect x="6" y="30" width="50" height="2.5" rx="1" fill={mute} />
      </svg>
    );
  }
  if (layout === "card") {
    return (
      <svg viewBox="0 0 80 56" style={svgStyle}>
        <rect
          x="20"
          y="6"
          width="40"
          height="44"
          fill="none"
          stroke={stripe}
          strokeWidth="1"
          rx="2"
        />
        <rect x="26" y="12" width="28" height="3" rx="1" fill={text} />
        <rect x="26" y="20" width="20" height="2.5" rx="1" fill={mute} />
        <rect x="26" y="28" width="28" height="2" rx="1" fill={mute} />
        <rect x="26" y="34" width="22" height="2" rx="1" fill={mute} />
        <rect x="26" y="42" width="14" height="2" rx="1" fill={stripe} />
      </svg>
    );
  }
  if (layout === "minimal") {
    return (
      <svg viewBox="0 0 80 56" style={svgStyle}>
        <rect x="8" y="22" width="38" height="3.5" rx="1" fill={text} />
        <rect x="8" y="30" width="50" height="2.5" rx="1" fill={mute} />
      </svg>
    );
  }
  // image_only
  return (
    <svg viewBox="0 0 80 56" style={svgStyle}>
      <circle cx="18" cy="28" r="10" fill={stripe} />
      <rect x="34" y="18" width="36" height="3" rx="1" fill={text} />
      <rect x="34" y="25" width="28" height="2.5" rx="1" fill={mute} />
      <rect x="34" y="33" width="32" height="2.5" rx="1" fill={mute} />
      <rect x="34" y="40" width="18" height="2" rx="1" fill={stripe} />
    </svg>
  );
}
