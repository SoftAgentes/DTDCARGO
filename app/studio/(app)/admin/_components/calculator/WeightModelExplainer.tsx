/**
 * WeightModelExplainer — bloque "por qué llegamos a este modelo de peso".
 *
 * Presentacional (sin hooks): resumen visual de las 4 cifras que justifican el
 * modelo (equilibrio físico 397 · densidad real ≈250 · gracia 1.000 · +$2/kg) +
 * la explicación por escrito al lado + botón "Descargar guía completa".
 *
 * Contexto (recalibración con data real de 33 contenedores, 2023–2026): el punto
 * donde un 40'HQ se llena de peso y volumen a la vez es 397 kg/m³; la carga real
 * promedia ≈250; 0 de 32 se llenaron por peso; solo 2,7% de clientes supera los
 * 1.000 kg/m³. De ahí: gracia 1.000 kg/m³ sin recargo + $2/kg continuo sobre el
 * excedente (auto-cotiza, no deriva al asesor), sobre el mayor entre declarado y
 * medido. NO cambia el pricing — solo lo explica.
 *
 * Solo tokens var(--*). La guía se sirve estática desde public/interno/.
 */

import { Icon } from "@/app/studio/_components/icons";

const GUIDE_HREF = "/interno/guia-peso.html";

type Stat = {
  value: string;
  unit: string;
  label: string;
  caption: string;
};

const STATS: Stat[] = [
  {
    value: "397",
    unit: "kg/m³",
    label: "Equilibrio físico del 40'HQ",
    caption: "donde peso y volumen se llenan a la vez",
  },
  {
    value: "≈ 250",
    unit: "kg/m³",
    label: "Densidad real promedio",
    caption: "33 contenedores · 2023–2026",
  },
  {
    value: "1.000",
    unit: "kg/m³",
    label: "Gracia sin recargo",
    caption: "cubre al 97,3% de los clientes",
  },
  {
    value: "+$2",
    unit: "/kg",
    label: "Sobre el excedente",
    caption: "se auto-cotiza, no deriva al asesor",
  },
];

export function WeightModelExplainer() {
  return (
    <section
      aria-labelledby="weight-why-title"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: "22px 24px",
        marginBottom: "var(--s-6)",
      }}
    >
      {/* Encabezado */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--s-4)",
          flexWrap: "wrap",
          marginBottom: "var(--s-5)",
        }}
      >
        <div>
          <div className="studio-eyebrow" style={{ color: "var(--wine-text)", marginBottom: 6 }}>
            El modelo de peso
          </div>
          <h3
            id="weight-why-title"
            className="studio-display"
            style={{
              fontSize: 18,
              margin: 0,
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Por qué llegamos a este modelo
          </h3>
        </div>
        <a
          href={GUIDE_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="studio-btn studio-btn-ghost studio-btn-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {Icon.download(14)}
          Descargar guía completa
        </a>
      </div>

      {/* Dos columnas: cifras | explicación (stack en angosto) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "var(--s-6)",
          alignItems: "start",
        }}
      >
        {/* Cifras */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "var(--s-3)",
          }}
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "14px 16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--s-1)" }}>
                <span
                  style={{
                    font: "800 22px/1 var(--f-mono)",
                    color: "var(--wine-text)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.value}
                </span>
                <span
                  style={{
                    font: "600 11px/1 var(--f-mono)",
                    color: "var(--ink-soft)",
                  }}
                >
                  {s.unit}
                </span>
              </div>
              <div
                style={{
                  font: "700 12px/1.3 var(--f-sans)",
                  color: "var(--ink)",
                  margin: "8px 0 2px",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  font: "400 11.5px/1.4 var(--f-sans)",
                  color: "var(--ink-soft)",
                }}
              >
                {s.caption}
              </div>
            </div>
          ))}
        </div>

        {/* Explicación */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
          <p
            style={{
              font: "400 13px/1.6 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            El punto donde un contenedor 40&apos;HQ se llena de{" "}
            <strong style={{ color: "var(--ink)" }}>peso y de volumen a la vez</strong>{" "}
            es <strong style={{ color: "var(--ink)" }}>397 kg/m³</strong>. La carga
            real de DTD promedia <strong style={{ color: "var(--ink)" }}>≈ 250 kg/m³</strong>:
            de 32 contenedores medidos, <strong style={{ color: "var(--ink)" }}>ninguno
            se llenó por peso</strong>, y solo el{" "}
            <strong style={{ color: "var(--ink)" }}>2,7%</strong> de los clientes supera
            los 1.000 kg/m³.
          </p>
          <p
            style={{
              font: "400 13px/1.6 var(--f-sans)",
              color: "var(--ink-soft)",
              margin: 0,
            }}
          >
            Por eso la gracia es alta —{" "}
            <strong style={{ color: "var(--ink)" }}>1.000 kg/m³ sin recargo</strong> — y
            el excedente se cobra de forma continua:{" "}
            <strong style={{ color: "var(--ink)" }}>+$2 por cada kg</strong> por encima,
            sobre el <strong style={{ color: "var(--ink)" }}>mayor entre el peso
            declarado y el medido</strong>. Se calcula solo en la web. La única
            excepción: un envío a la vez{" "}
            <strong style={{ color: "var(--ink)" }}>muy pesado y muy denso</strong>, que
            acapararía el peso del contenedor, se cotiza a medida con el asesor.
          </p>
        </div>
      </div>
    </section>
  );
}
