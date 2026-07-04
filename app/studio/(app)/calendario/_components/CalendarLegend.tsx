/**
 * CalendarLegend — chips de leyenda debajo del grid (SDD-0015).
 */

type ChipProps = {
  label: string;
  bg: string;
  border?: string;
  textColor?: string;
};

function Chip({ label, bg, border, textColor }: ChipProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 14,
          height: 14,
          borderRadius: 3,
          background: bg,
          border: border ? `1px solid ${border}` : undefined,
          display: "inline-block",
        }}
      />
      <span
        style={{
          font: "500 11.5px/1 var(--f-sans)",
          color: textColor ?? "var(--ink-soft)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function CalendarLegend() {
  return (
    <div
      style={{
        marginTop: 16,
        padding: "12px 16px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      <span
        className="studio-eyebrow"
        style={{ color: "var(--ink-soft)" }}
      >
        Leyenda
      </span>
      <Chip
        label="Feriado CN · crítico"
        bg="var(--cal-cn-critical)"
        border="var(--wine-soft)"
      />
      <Chip
        label="Feriado CN"
        bg="var(--cal-cn-soft)"
        border="var(--wine-soft)"
      />
      <Chip
        label="Feriado VE"
        bg="var(--cal-ve-soft)"
        border="var(--success)"
      />
      <Chip label="Tarea de Bitácora" bg="var(--neutral-bg)" border="var(--border)" />
      <Chip label="Fin de semana" bg="var(--cal-weekend)" border="var(--border)" />
      <Chip label="Hoy" bg="var(--wine)" />
    </div>
  );
}
