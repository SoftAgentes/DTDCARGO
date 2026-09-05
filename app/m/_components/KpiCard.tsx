/**
 * KpiCard mobile — versión compacta del KpiCard del Studio.
 *
 * Solo label + value + tone. Sin sub-line para que entren 3 en una
 * fila a 375px de ancho.
 */

type Tone = "wine" | "info" | "warning" | "success" | "ink";

const TONE_COLOR: Record<Tone, string> = {
  wine: "var(--wine-text)",
  info: "var(--info)",
  warning: "var(--ink)",
  success: "var(--success)",
  ink: "var(--ink)",
};

export function KpiCard({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: string | number;
  tone?: Tone;
}) {
  return (
    <div
      style={{
        padding: "var(--s-3)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          font: "700 9.5px/1 var(--f-sans)",
          color: "var(--ink-soft)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          font: "900 22px/1 var(--f-display)",
          color: TONE_COLOR[tone],
          marginTop: "var(--s-2)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}
