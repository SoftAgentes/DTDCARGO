/**
 * Almacén China · «En camino» (SDD-0682 §2.2). Server component, sin estado.
 *
 * Una fila por contenedor que ya salió de la bodega: buque, ETA, días que faltan
 * y porcentaje de avance. Nada más (Sam: «solo el contador y el porcentaje»).
 * No lleva nombres de importador: solo cuántos clientes y cuántas cajas.
 */

import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { t, type Locale } from "@/lib/i18n";
import type { ContenedorEnCamino } from "@/lib/studio/almacen-cn-contenedores";
import { textoDeDias } from "@/lib/studio/almacen-cn-vistas";
import { formatFecha } from "@/lib/studio/embarques-contenedores";

// ETA y días toman el ancho de su texto (no estimado) y no se parten: si un texto
// crece, se ve, en vez de re-maquetar la fila (/ui-check).
const COLUMNAS =
  "minmax(160px,1.3fr) minmax(120px,1fr) minmax(110px,max-content) minmax(110px,max-content) minmax(140px,1fr) minmax(150px,1fr)";

function Dias({ locale, dias }: { locale: Locale; dias: number | null }) {
  const x = textoDeDias(dias);
  if (x.tipo === "sin_eta") {
    return <span style={{ color: "var(--ink-soft)" }}>{t(locale, "warehouse_cn.camino.no_eta")}</span>;
  }
  if (x.tipo === "hoy") return <strong>{t(locale, "warehouse_cn.camino.arrives_today")}</strong>;
  if (x.tipo === "vencida") {
    return (
      <strong style={{ color: "var(--danger-text)" }}>
        {t(locale, "warehouse_cn.camino.days_late", { days: x.dias })}
      </strong>
    );
  }
  return <strong>{t(locale, "warehouse_cn.camino.days_left", { days: x.dias })}</strong>;
}

function Avance({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
      <span
        role="progressbar"
        aria-label={etiqueta}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={v}
        style={{
          flex: 1,
          height: 8,
          borderRadius: 999,
          background: "var(--border)",
          overflow: "hidden",
        }}
      >
        <span style={{ display: "block", width: `${v}%`, height: "100%", background: "var(--ink)" }} />
      </span>
      <span style={{ font: "700 12px/1 var(--f-mono)", minWidth: 40, textAlign: "right" }}>{v}%</span>
    </span>
  );
}

function Fila({ locale, c }: { locale: Locale; c: ContenedorEnCamino }) {
  const carga =
    c.clientes === 1
      ? t(locale, "warehouse_cn.camino.load_text_one", { pieces: c.piezas })
      : t(locale, "warehouse_cn.camino.load_text", { clients: c.clientes, pieces: c.piezas });
  return (
    <div
      role="row"
      style={{
        display: "grid",
        gridTemplateColumns: COLUMNAS,
        gap: "var(--s-3)",
        alignItems: "center",
        padding: "var(--s-3) var(--s-4)",
        borderTop: "1px solid var(--border)",
        font: "500 13px/1.3 var(--f-sans)",
      }}
    >
      <span role="cell" style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ font: "700 13px/1.2 var(--f-sans)" }}>{c.nombre}</span>
        {c.containerNo && (
          <span style={{ font: "500 11.5px/1.2 var(--f-mono)", color: "var(--ink-soft)" }}>
            {c.containerNo}
          </span>
        )}
      </span>
      <span role="cell" style={{ color: "var(--ink-soft)", overflowWrap: "anywhere" }}>
        {c.vessel ?? "—"}
      </span>
      <span role="cell" style={{ whiteSpace: "nowrap" }}>
        {c.eta ? formatFecha(c.eta) : "—"}
      </span>
      <span role="cell" style={{ whiteSpace: "nowrap" }}>
        <Dias locale={locale} dias={c.diasRestantes} />
      </span>
      <span role="cell">
        <Avance valor={c.progreso} etiqueta={`${t(locale, "warehouse_cn.camino.col_progress")} · ${c.nombre}`} />
      </span>
      <span role="cell" style={{ color: "var(--ink-soft)" }}>
        {carga}
      </span>
    </div>
  );
}

function Grupo({
  locale,
  titulo,
  lista,
}: {
  locale: Locale;
  titulo: string;
  lista: ContenedorEnCamino[];
}) {
  if (lista.length === 0) return null;
  return (
    <section style={{ marginBottom: "var(--s-5)" }}>
      <h2
        style={{
          font: "800 13px/1 var(--f-sans)",
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--ink)",
          margin: "0 0 var(--s-2)",
        }}
      >
        {titulo} · {lista.length}
      </h2>
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: "var(--r-lg)",
          background: "var(--bg-surface)",
          overflowX: "auto",
        }}
      >
        <div role="table" aria-label={titulo} style={{ minWidth: 900 }}>
          <div
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: COLUMNAS,
              gap: "var(--s-3)",
              padding: "var(--s-2) var(--s-4)",
              font: "700 11px/1 var(--f-sans)",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_container")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_vessel")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_eta")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_days")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_progress")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_load")}</span>
          </div>
          {lista.map((c) => (
            <Fila key={c.id} locale={locale} c={c} />
          ))}
        </div>
      </div>
    </section>
  );
}

/** `contenedores` `null` = no se pudo leer: se dice, no se muestra vacío como si no hubiera. */
export function CaminoCn({
  locale,
  contenedores,
}: {
  locale: Locale;
  contenedores: ContenedorEnCamino[] | null;
}) {
  if (contenedores === null) {
    return <Aviso tono="error">{t(locale, "warehouse_cn.camino.unavailable")}</Aviso>;
  }
  if (contenedores.length === 0) {
    return (
      <EmptyState
        eyebrow={t(locale, "warehouse_cn.view.en_camino")}
        title={t(locale, "warehouse_cn.camino.empty_title")}
        description={t(locale, "warehouse_cn.camino.empty_description")}
      />
    );
  }
  return (
    <>
      <p
        style={{
          font: "400 13px/1.4 var(--f-sans)",
          color: "var(--ink-soft)",
          margin: "0 0 var(--s-4)",
          maxWidth: "70ch",
        }}
      >
        {t(locale, "warehouse_cn.camino.description")}
      </p>
      <Grupo
        locale={locale}
        titulo={t(locale, "warehouse_cn.camino.group_mar")}
        lista={contenedores.filter((c) => c.grupo === "mar")}
      />
      <Grupo
        locale={locale}
        titulo={t(locale, "warehouse_cn.camino.group_origen")}
        lista={contenedores.filter((c) => c.grupo === "origen")}
      />
    </>
  );
}
