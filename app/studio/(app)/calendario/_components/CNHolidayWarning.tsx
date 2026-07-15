/**
 * CNHolidayWarning — card permanente sobre el impacto de los feriados
 * críticos CN (SDD-0015). Información estratégica: regla de las
 * 3 semanas de anticipación.
 */

export function CNHolidayWarning() {
  return (
    <div
      style={{
        background: "var(--warning-bg, rgba(184,137,58,0.10))",
        border: "1px solid var(--warning)",
        borderRadius: 10,
        padding: "var(--s-4)",
        display: "flex",
        gap: "var(--s-3)",
        alignItems: "flex-start",
      }}
      role="note"
    >
      <span
        aria-hidden
        style={{
          font: "900 16px/1 var(--f-display)",
          color: "var(--warning)",
          flexShrink: 0,
          marginTop: 2,
        }}
      >
        !
      </span>
      <div style={{ flex: 1 }}>
        <div
          className="studio-eyebrow"
          style={{ color: "var(--warning)", marginBottom: 6 }}
        >
          Atención feriados CN
        </div>
        <p
          style={{
            font: "500 12px/1.5 var(--f-sans)",
            color: "var(--ink)",
            margin: 0,
          }}
        >
          <strong style={{ color: "var(--ink)" }}>
            Año Nuevo Chino
          </strong>{" "}
          (16-24 feb) y{" "}
          <strong style={{ color: "var(--ink)" }}>Golden Week</strong>{" "}
          (1-7 oct) paralizan Yiwu y Shenzhen. Planifica zarpes con{" "}
          <strong style={{ color: "var(--ink)" }}>
            3 semanas de anticipación
          </strong>
          .
        </p>
      </div>
    </div>
  );
}
