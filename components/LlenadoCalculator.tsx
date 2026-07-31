/**
 * SDD-0184 · Fase 5 — calculadora pública de llenado de contenedor.
 *
 * "Tengo N cajas y X CBM: ¿cuánto contenedor ocupo?" — con el dibujo del reparto.
 *
 * FRONTERA: importa el motor desde `lib/shared/estiba-plan`, que es el ÚNICO
 * puente público↔ERP permitido. Cero imports de `@/lib/studio`, `@/lib/db` o
 * `@supabase/*` — ESLint lo bloquea como ERROR, no como aviso.
 *
 * El motor corre en el navegador acá (es una calculadora, no hay nada que
 * proteger) mientras que en el Studio corre en el servidor. Es el mismo código
 * puro: esa es la ventaja de que no dependa de React ni de la base.
 */

"use client";

import { useMemo, useState } from "react";
import {
  planificarCarga,
  etiquetasAncho,
  etiquetasLargo,
  type EspacioCarga,
  type Lote,
} from "@/lib/shared/estiba-plan";

/**
 * Los dos que DTD usa de verdad (SDD-0184 Fase 2). Capacidad ÚTIL, no el volumen
 * geométrico: un 40'HC mide 76,2 m³ de pared a pared pero se cargan 68.
 */
const ESPACIOS: Record<string, EspacioCarga> = {
  "40HC": {
    code: "40HC",
    label: "40' High Cube",
    cbmCapacity: 68,
    cbmAlertCeiling: 66.4,
    layout: { nx: 3, ny: 1, nz: 3 },
  },
  "20GP": {
    code: "20GP",
    label: "20' Estándar",
    cbmCapacity: 30,
    cbmAlertCeiling: null,
    layout: { nx: 2, ny: 1, nz: 3 },
  },
};

/**
 * Paleta categórica de la marca — la misma con la que el Studio colorea a cada
 * cliente en el visor del contenedor. Mudos e industriales: conviven con wine y
 * navy sin pelear, y ninguno tiene el peso de un tono de alerta.
 *
 * ⚠️ Van con respaldo porque los tokens `--cat-*` viven en `app/studio/tokens.css`
 * y esa hoja NO se carga en el sitio público (por la frontera). El respaldo NO es
 * un hex inventado: es el valor exacto del token. Si algún día la paleta se
 * promueve a `app/globals.css`, el `var()` la toma sola y el respaldo muere.
 */
const PALETA = [
  "var(--cat-1, #1F5F6B)", // petróleo
  "var(--cat-2, #3A4E8C)", // índigo
  "var(--cat-3, #5A7A34)", // musgo
  "var(--cat-4, #A85A3C)", // arcilla
  "var(--cat-5, #6B3A5E)", // ciruela
  "var(--cat-6, #4A6270)", // acero
];

type Fila = { id: string; nombre: string; cajas: string; cbm: string };

export function LlenadoCalculator() {
  const [tipo, setTipo] = useState<keyof typeof ESPACIOS>("40HC");
  const [filas, setFilas] = useState<Fila[]>([
    { id: "1", nombre: "Mi mercancía", cajas: "50", cbm: "3" },
  ]);

  const espacio = ESPACIOS[tipo];

  const plan = useMemo(() => {
    const lotes: Lote[] = filas
      .map((f, i) => ({
        id: f.id,
        markbox: f.nombre.trim() || `Carga ${i + 1}`,
        clientName: null,
        cajas: Math.max(1, Math.round(Number(f.cajas) || 0)),
        cbm: Math.max(0, Number(f.cbm) || 0),
        ordenDescarga: filas.length - i,
      }))
      .filter((l) => l.cbm > 0);
    if (lotes.length === 0) return null;
    return planificarCarga(lotes, espacio);
  }, [filas, espacio]);

  const setFila = (id: string, campo: keyof Fila, valor: string) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));

  return (
    <div className="rp-card" style={{ display: "grid", gap: 20 }}>
      {/* ── Tipo de contenedor ────────────────────────────── */}
      <div>
        <span className="rp-eyebrow" style={{ marginBottom: 8, display: "block" }}>
          ¿Qué contenedor?
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(ESPACIOS).map(([code, e]) => (
            <button
              key={code}
              type="button"
              onClick={() => setTipo(code as keyof typeof ESPACIOS)}
              aria-pressed={tipo === code}
              style={{
                flex: "1 1 160px",
                padding: "12px 16px",
                borderRadius: 10,
                cursor: "pointer",
                border:
                  tipo === code
                    ? "2px solid var(--color-wine)"
                    : "1px solid var(--border)",
                background: tipo === code ? "var(--color-wine)" : "transparent",
                color: tipo === code ? "var(--color-on-accent)" : "inherit",
                font: "700 14px/1.2 inherit",
              }}
            >
              {e.label}
              <span style={{ display: "block", font: "500 12px/1.4 inherit", opacity: 0.8 }}>
                {e.cbmCapacity} CBM útiles
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── La carga ──────────────────────────────────────── */}
      <div>
        <span className="rp-eyebrow" style={{ marginBottom: 8, display: "block" }}>
          ¿Qué vas a mandar?
        </span>
        <div style={{ display: "grid", gap: 8 }}>
          {filas.map((f, i) => (
            <div key={f.id} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                aria-label={`Nombre de la carga ${i + 1}`}
                value={f.nombre}
                onChange={(e) => setFila(f.id, "nombre", e.target.value)}
                placeholder="Mi mercancía"
                style={{ flex: "2 1 140px", ...inputStyle }}
              />
              <input
                aria-label={`Cajas de la carga ${i + 1}`}
                type="number"
                inputMode="numeric"
                min={1}
                value={f.cajas}
                onChange={(e) => setFila(f.id, "cajas", e.target.value)}
                placeholder="cajas"
                style={{ flex: "1 1 90px", ...inputStyle }}
              />
              <input
                aria-label={`CBM de la carga ${i + 1}`}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={f.cbm}
                onChange={(e) => setFila(f.id, "cbm", e.target.value)}
                placeholder="CBM"
                style={{ flex: "1 1 90px", ...inputStyle }}
              />
              {filas.length > 1 && (
                <button
                  type="button"
                  aria-label={`Quitar la carga ${i + 1}`}
                  onClick={() => setFilas((fs) => fs.filter((x) => x.id !== f.id))}
                  style={{ ...inputStyle, flex: "0 0 44px", cursor: "pointer" }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setFilas((fs) => [
              ...fs,
              { id: String(Date.now()), nombre: "", cajas: "10", cbm: "1" },
            ])
          }
          style={{
            marginTop: 10,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px dashed var(--border)",
            background: "transparent",
            cursor: "pointer",
            font: "600 13px/1 inherit",
          }}
        >
          + Agregar otra carga
        </button>
      </div>

      {/* ── El resultado ──────────────────────────────────── */}
      {plan && <Resultado plan={plan} espacio={espacio} />}
    </div>
  );
}

function Resultado({
  plan,
  espacio,
}: {
  plan: NonNullable<ReturnType<typeof planificarCarga>>;
  espacio: EspacioCarga;
}) {
  const { nx, nz } = espacio.layout;
  const tramos = etiquetasLargo(nx);
  const lados = etiquetasAncho(nz);

  const color = new Map<string, string>();
  plan.pasos.forEach((p) => {
    if (p.markbox && !color.has(p.markbox)) {
      color.set(p.markbox, PALETA[color.size % PALETA.length]);
    }
  });

  const celdas = new Map<string, { markbox: string | null; cbm: number }[]>();
  for (const paso of plan.pasos) {
    for (const z of paso.zonas) {
      const k = `${z.zx}-${z.zz}`;
      celdas.set(k, [...(celdas.get(k) ?? []), { markbox: paso.markbox, cbm: z.cbm }]);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <span className="rp-eyebrow" style={{ marginBottom: 8, display: "block" }}>
          Así queda tu contenedor
        </span>
        <p style={{ margin: "0 0 10px", font: "700 17px/1.3 inherit" }}>
          Ocupas <strong>{plan.stats.cbmUbicado} de {espacio.cbmCapacity} CBM</strong>{" "}
          ({Math.round(plan.stats.pctVolumen)}%)
          {plan.sinUbicar.length > 0 && " · y algo no te entra en uno solo"}
        </p>
      </div>

      {/* Planta 2D — la misma idea que ve el operario en el galpón */}
      <div
        role="img"
        aria-label={`Reparto: ${plan.pasos.map((p) => `${p.markbox} en ${p.destino}`).join(", ")}`}
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(48px,auto) repeat(${nz}, minmax(0,1fr))`,
          gap: 3,
          padding: 8,
          borderRadius: 10,
          border: "1px solid var(--border)",
        }}
      >
        <span aria-hidden="true" />
        {lados.map((l) => (
          <span key={l} style={cabeceraStyle}>
            {l}
          </span>
        ))}
        {tramos.map((tramo, zx) => (
          <FilaPlanta
            key={tramo}
            tramo={tramo}
            zx={zx}
            nz={nz}
            celdas={celdas}
            color={color}
          />
        ))}
      </div>

      {/* Leyenda */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "8px 16px" }}>
        {plan.pasos.map((p) => (
          <li key={p.loteId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: color.get(p.markbox ?? "") ?? PALETA[0],
              }}
            />
            <span style={{ font: "600 13px/1.3 inherit" }}>{p.markbox}</span>
            <span style={{ font: "500 12px/1.3 inherit", opacity: 0.7 }}>{p.destino}</span>
          </li>
        ))}
      </ul>

      {plan.avisos.map((a, i) => (
        <p
          key={`${a.tipo}-${i}`}
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--color-grey-100)",
            font: "500 13px/1.5 inherit",
          }}
        >
          {a.mensaje}
        </p>
      ))}

      <p style={{ margin: 0, font: "500 12.5px/1.6 inherit", opacity: 0.75 }}>
        Es una guía aproximada: se reparte por volumen, y 3 CBM en 50 cajas chicas no
        ocupan lo mismo que 3 CBM en 5 cajas grandes. Para el número exacto,
        escríbenos y lo revisamos con tu lista de empaque.
      </p>
    </div>
  );
}

function FilaPlanta({
  tramo,
  zx,
  nz,
  celdas,
  color,
}: {
  tramo: string;
  zx: number;
  nz: number;
  celdas: Map<string, { markbox: string | null; cbm: number }[]>;
  color: Map<string, string>;
}) {
  return (
    <>
      <span style={{ ...cabeceraStyle, textAlign: "right", alignSelf: "center", paddingRight: 6 }}>
        {tramo}
      </span>
      {Array.from({ length: nz }, (_, zz) => {
        const bandas = celdas.get(`${zx}-${zz}`) ?? [];
        const total = bandas.reduce((a, b) => a + b.cbm, 0);
        return (
          <span
            key={zz}
            style={{
              height: 56,
              display: "flex",
              flexDirection: "column",
              borderRadius: 6,
              overflow: "hidden",
              border:
                bandas.length === 0
                  ? "1px dashed var(--border)"
                  : "1px solid var(--border)",
            }}
          >
            {bandas.map((b, i) => (
              <span
                key={i}
                style={{
                  flex: `0 0 ${total > 0 ? (b.cbm / total) * 100 : 100}%`,
                  background: color.get(b.markbox ?? "") ?? PALETA[0],
                  minHeight: 0,
                }}
              />
            ))}
          </span>
        );
      })}
    </>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  font: "500 14px/1.2 inherit",
  color: "inherit",
  minWidth: 0,
};

const cabeceraStyle: React.CSSProperties = {
  font: "700 10px/1.2 inherit",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  opacity: 0.6,
  textAlign: "center",
  paddingBottom: 4,
};
