"use client";

/**
 * AppearanceSection — sección "Apariencia" del admin (SDD-0120).
 *
 * Preferencias por-usuario (localStorage, mismo patrón que el theme existente,
 * sin migración) + material de marca read-only:
 *   1. Preferencias   → Tema (light/dark) + Densidad (compact/normal/spacious).
 *   2. Paleta de marca → swatches bloqueados (reglas de marca, ver BRAND.md).
 *   3. Recursos de marca → links al hub interno + Brand Book.
 *   4. Logo & favicon → por implementar (requiere storage + gobernanza de marca).
 *
 * El tema ya se togglea desde la barra superior (sol/luna); acá se comparte el
 * mismo mecanismo vía `appearance-prefs` (evento `studio:appearance`) para que
 * ambos controles queden sincronizados. La densidad es nueva: el CSS ya trae
 * los modificadores `[data-density]`, faltaba dónde elegirla.
 */

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Icon } from "@/app/studio/_components/icons";
import { SegmentedControl } from "@/app/studio/_components/ui/SegmentedControl";
import {
  applyDensity,
  applyTheme,
  APPEARANCE_EVENT,
  readDensity,
  readTheme,
  type StudioDensity,
  type StudioTheme,
} from "@/app/studio/_components/appearance-prefs";

function subscribeAppearance(onChange: () => void): () => void {
  window.addEventListener(APPEARANCE_EVENT, onChange);
  return () => window.removeEventListener(APPEARANCE_EVENT, onChange);
}

const BRAND_COLORS = [
  { name: "Wine", token: "--wine", hex: "#7F0F1A" },
  { name: "Wine-soft", token: "--wine-soft", hex: "#C2747F" },
  { name: "Ink", token: "--ink", hex: "#0F1E3D" },
  { name: "Paper", token: "--bg-base", hex: "#FBFAF7" },
];

const BRAND_RESOURCES = [
  { title: "Marca · hub interno", sub: "Logo, portadas, recursos gráficos", href: "/interno/marca" },
  { title: "Brand Book", sub: "Sistema completo de identidad y aplicaciones", href: "/marca/brand-book" },
];

export function AppearanceSection() {
  const theme = useSyncExternalStore<StudioTheme>(
    subscribeAppearance,
    readTheme,
    () => "light",
  );
  const density = useSyncExternalStore<StudioDensity>(
    subscribeAppearance,
    readDensity,
    () => "normal",
  );

  const onTheme = (next: StudioTheme) => {
    applyTheme(next);
  };
  const onDensity = (next: StudioDensity) => {
    applyDensity(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 1. Preferencias */}
      <Card>
        <CardEyebrow>Preferencias de esta cuenta</CardEyebrow>

        <FieldBlock label="Tema" hint="También lo puedes cambiar desde el sol/luna de la barra superior.">
          <SegmentedControl<StudioTheme>
            value={theme}
            onChange={onTheme}
            variant="cards"
            columns={2}
            ariaLabel="Tema del Studio"
            options={[
              { value: "light", label: "Claro", description: "Fondo paper", icon: Icon.sun(16) },
              { value: "dark", label: "Oscuro", description: "Fondo navy", icon: Icon.moon(16) },
            ]}
          />
        </FieldBlock>

        <FieldBlock label="Densidad" hint="Ajusta el espaciado de tablas y listados.">
          <SegmentedControl<StudioDensity>
            value={density}
            onChange={onDensity}
            variant="cards"
            columns={3}
            ariaLabel="Densidad de la interfaz"
            options={[
              { value: "compact", label: "Compacta", description: "Más filas visibles" },
              { value: "normal", label: "Normal", description: "Equilibrada" },
              { value: "spacious", label: "Amplia", description: "Más aire" },
            ]}
          />
        </FieldBlock>
      </Card>

      {/* 2. Paleta de marca (read-only) */}
      <Card>
        <CardEyebrow>Paleta de marca</CardEyebrow>
        <p style={{ font: "500 12px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: "0 0 12px" }}>
          Los colores oficiales están bloqueados por reglas de marca (ver BRAND.md). No se editan desde acá.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {BRAND_COLORS.map((c) => (
            <div key={c.name} style={{ padding: "var(--s-3)", background: "var(--bg-elevated)", borderRadius: "var(--r-md)" }}>
              <div
                style={{
                  width: "100%",
                  height: 48,
                  background: `var(${c.token})`,
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                }}
              />
              <div style={{ marginTop: "var(--s-2)", font: "700 12px/1 var(--f-sans)", color: "var(--ink)" }}>{c.name}</div>
              <code style={{ font: "600 10.5px/1.3 var(--f-mono)", color: "var(--ink-soft)" }}>{c.token}</code>
              <div style={{ marginTop: "var(--s-1)", font: "500 10.5px/1 var(--f-mono)", color: "var(--ink-soft)" }}>{c.hex}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Recursos de marca */}
      <Card>
        <CardEyebrow>Recursos de marca</CardEyebrow>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
          {BRAND_RESOURCES.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                padding: "12px 14px",
                textDecoration: "none",
                background: "var(--bg-elevated)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  flexShrink: 0,
                  borderRadius: "var(--r-sm)",
                  background: "var(--bg-sidebar)",
                  color: "var(--ink-side-strong)",
                  display: "grid",
                  placeItems: "center",
                  font: "900 13px/1 var(--f-brand-display)",
                }}
              >
                D
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "700 13px/1.3 var(--f-sans)", color: "var(--ink)" }}>{r.title}</span>
                <span style={{ display: "block", font: "500 11.5px/1.3 var(--f-sans)", color: "var(--ink-soft)" }}>{r.sub}</span>
              </span>
              <span style={{ color: "var(--ink-mute)", flexShrink: 0, font: "600 14px/1 var(--f-sans)" }}>↗</span>
            </Link>
          ))}
        </div>
      </Card>

      {/* 4. Logo & favicon — por implementar */}
      <section
        style={{
          background: "var(--bg-surface)",
          border: "2px dashed var(--border-strong)",
          borderRadius: "var(--r-lg)",
          padding: "var(--s-5) var(--s-6)",
        }}
      >
        <div
          style={{
            font: "700 10px/1 var(--f-sans)",
            color: "var(--wine-text)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: "var(--s-2)",
          }}
        >
          Logo & favicon · por implementar
        </div>
        <p style={{ font: "400 13px/1.5 var(--f-sans)", color: "var(--ink-soft)", margin: 0, maxWidth: "62ch" }}>
          Subir logo/favicon propios por tenant requiere Storage y pasar por gobernanza de marca. Queda para un SDD
          futuro; hoy el logo único es el isólogo oficial vía <code style={{ font: "600 12px/1 var(--f-mono)" }}>&lt;BrandMark&gt;</code>.
        </p>
      </section>
    </div>
  );
}

// ── Primitivas locales ────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
      }}
    >
      {children}
    </section>
  );
}

function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 14 }}>
      {children}
    </div>
  );
}

function FieldBlock({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ font: "700 12.5px/1 var(--f-sans)", color: "var(--ink)", marginBottom: "var(--s-1)" }}>{label}</div>
      {hint && (
        <div style={{ font: "500 11.5px/1.4 var(--f-sans)", color: "var(--ink-soft)", marginBottom: 10 }}>{hint}</div>
      )}
      {children}
    </div>
  );
}
