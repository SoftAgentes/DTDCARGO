/**
 * Ajustes del Studio.
 *
 * MVP-0: placeholder. Configuraciones reales (tarifas, integraciones, equipo, branding)
 * vienen en SDDs futuros.
 *
 * Refactor visual: eyebrow con guión wine-soft + H1 30px + spacing rítmico 8/12/32.
 */

export const metadata = {
  title: "Ajustes",
};

export default function AjustesPage() {
  return (
    <div style={{ maxWidth: 800 }}>
      <span className="studio-eyebrow">Configuración</span>
      <h1
        className="studio-display"
        style={{ fontSize: 30, margin: "8px 0 32px", color: "var(--ink)" }}
      >
        Ajustes.
      </h1>

      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 28,
        }}
      >
        <p
          style={{
            font: "400 14px/1.6 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Tarifas, integraciones, gestión de equipo y branding del tenant vendrán en
          SDDs futuros. Por ahora, este es un placeholder.
        </p>
      </div>
    </div>
  );
}
