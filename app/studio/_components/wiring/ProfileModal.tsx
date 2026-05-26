"use client";

/**
 * ProfileModal — 3 tabs (Datos personales · Contraseña · Preferencias).
 * SDD-0034.
 *
 * V1: solo UI. "Guardar" muestra toast verde sin persistir.
 * V2 cuando exista tabla user_profiles: wirear mutations.
 */

import { useState } from "react";

export type ProfileTab = "profile" | "password" | "prefs";

export function ProfileModal({
  initialTab,
  onClose,
}: {
  initialTab: ProfileTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ProfileTab>(initialTab);

  return (
    <ModalShell title="Mi perfil" onClose={onClose} width={620}>
      {/* Tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 2,
          borderBottom: "1px solid var(--border)",
          padding: "0 22px",
        }}
      >
        {(["profile", "password", "prefs"] as ProfileTab[]).map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              role="tab"
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "12px 14px",
                background: "transparent",
                border: 0,
                borderBottom: active
                  ? "2px solid var(--wine)"
                  : "2px solid transparent",
                color: active ? "var(--ink)" : "var(--ink-soft)",
                font: `${active ? "700" : "500"} 13px/1 var(--f-sans)`,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t === "profile"
                ? "Datos personales"
                : t === "password"
                  ? "Contraseña"
                  : "Preferencias"}
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: "22px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {tab === "profile" && <ProfileTabContent onClose={onClose} />}
        {tab === "password" && <PasswordTabContent onClose={onClose} />}
        {tab === "prefs" && <PrefsTabContent onClose={onClose} />}
      </div>
    </ModalShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab · Datos personales
// ─────────────────────────────────────────────────────────────

function ProfileTabContent({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("Sam Bonny");
  const [email, setEmail] = useState("bigbonnysam@gmail.com");
  const [phone, setPhone] = useState("");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <>
      <Field label="Nombre" value={name} onChange={setName} />
      <Field label="Email" value={email} onChange={setEmail} type="email" />
      <Field label="Teléfono" value={phone} onChange={setPhone} placeholder="+58 414 …" />

      <p
        style={{
          font: "500 11.5px/1.4 var(--f-sans)",
          color: "var(--ink-mute)",
          margin: 0,
        }}
      >
        V1: cambios visuales no persisten todavía. Tabla{" "}
        <code style={{ font: "600 11px/1 var(--f-mono)", color: "var(--ink)" }}>
          user_profiles
        </code>{" "}
        llega en un SDD futuro.
      </p>

      <Footer
        onClose={onClose}
        primary={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? "Guardado" : "Guardar cambios"}
          </button>
        }
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab · Contraseña
// ─────────────────────────────────────────────────────────────

function PasswordTabContent({ onClose }: { onClose: () => void }) {
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pw3, setPw3] = useState("");
  const [saved, setSaved] = useState(false);

  const tooShort = pw2.length > 0 && pw2.length < 12;
  const mismatch = pw3.length > 0 && pw2 !== pw3;
  const canSubmit = pw1.length > 0 && pw2.length >= 12 && pw2 === pw3 && !saved;

  const handleChange = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <>
      <div
        style={{
          padding: 12,
          background: "var(--warning-bg)",
          color: "var(--ink)",
          borderRadius: "var(--r-sm)",
          font: "500 12.5px/1.4 var(--f-sans)",
        }}
      >
        La contraseña debe tener mínimo <strong>12 caracteres</strong>. Mezclá
        mayúsculas, minúsculas, números y símbolos.
      </div>

      <Field
        label="Contraseña actual"
        value={pw1}
        onChange={setPw1}
        type="password"
      />
      <Field
        label="Nueva contraseña"
        value={pw2}
        onChange={setPw2}
        type="password"
        error={tooShort ? "Mínimo 12 caracteres." : undefined}
      />
      <Field
        label="Repetí la nueva contraseña"
        value={pw3}
        onChange={setPw3}
        type="password"
        error={mismatch ? "Las contraseñas no coinciden." : undefined}
      />

      <Footer
        onClose={onClose}
        primary={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={handleChange}
            disabled={!canSubmit}
          >
            {saved ? "Cambiada" : "Cambiar contraseña"}
          </button>
        }
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab · Preferencias
// ─────────────────────────────────────────────────────────────

function PrefsTabContent({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState<"es" | "en" | "zh">("es");
  const [density, setDensity] = useState<"compact" | "comfortable">("comfortable");
  const [emailDaily, setEmailDaily] = useState(true);
  const [pushBrowser, setPushBrowser] = useState(true);
  const [sound, setSound] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <>
      <div>
        <label className="studio-label">Idioma</label>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as typeof lang)}
          className="studio-input"
          style={{ marginTop: 6 }}
        >
          <option value="es">Español</option>
          <option value="en">English</option>
          <option value="zh">中文</option>
        </select>
      </div>

      <div>
        <label className="studio-label">Densidad visual</label>
        <select
          value={density}
          onChange={(e) => setDensity(e.target.value as typeof density)}
          className="studio-input"
          style={{ marginTop: 6 }}
        >
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
      </div>

      <div style={{ marginTop: 6 }}>
        <span className="studio-label">Notificaciones</span>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <Check label="Email diario con resumen" checked={emailDaily} onChange={setEmailDaily} />
          <Check label="Push del navegador" checked={pushBrowser} onChange={setPushBrowser} />
          <Check label="Sonido en alertas" checked={sound} onChange={setSound} />
        </div>
      </div>

      <Footer
        onClose={onClose}
        primary={
          <button
            type="button"
            className="studio-btn studio-btn-primary"
            onClick={handleSave}
            disabled={saved}
          >
            {saved ? "Guardado" : "Guardar preferencias"}
          </button>
        }
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponentes shared
// ─────────────────────────────────────────────────────────────

export function ModalShell({
  title,
  onClose,
  width = 560,
  children,
}: {
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--scrim)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "92dvh",
          overflowY: "auto",
          background: "var(--bg-surface)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-pop)",
        }}
      >
        <header
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            className="studio-display"
            style={{ fontSize: 18, margin: 0, color: "var(--ink)" }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="studio-btn studio-btn-ghost studio-btn-xs"
            style={{ color: "var(--ink-soft)" }}
            aria-label="Cerrar"
          >
            Cerrar
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email" | "password";
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label className="studio-label" style={{ display: "block", marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="studio-input"
        style={
          error
            ? { borderColor: "var(--danger)" }
            : undefined
        }
      />
      {error && (
        <p
          style={{
            font: "600 11.5px/1.3 var(--f-sans)",
            color: "var(--danger)",
            margin: "6px 0 0",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        cursor: "pointer",
        font: "600 12.5px/1 var(--f-sans)",
        color: "var(--ink)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: "var(--wine)" }}
      />
      {label}
    </label>
  );
}

function Footer({
  onClose,
  primary,
}: {
  onClose: () => void;
  primary: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        marginTop: 4,
      }}
    >
      <button
        type="button"
        className="studio-btn studio-btn-ghost"
        onClick={onClose}
      >
        Cancelar
      </button>
      {primary}
    </div>
  );
}
