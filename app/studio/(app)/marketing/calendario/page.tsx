/**
 * Marketing · Calendario de contenido 2026 (SDD-0119) — V1 semilla.
 *
 * Calendario anual de fechas clave Venezuela + China que alimenta las tareas
 * del día del dashboard. V1 trae una SEMILLA curada (feriados comerciales de VE
 * + cierres de fábrica / hitos de compra en China, que son los que mueven el
 * speech de importación). Es BORRADOR: Fiorella lo afina con la Sra. Fátima y a
 * futuro se sincroniza con Notion (fuera de este cascarón).
 *
 * Las fechas movibles (Carnaval, Semana Santa, Día de la Madre/Padre, festivos
 * chinos) están calculadas para 2026 y se revisan cada año.
 */

import Link from "next/link";
import { requireModuleView } from "@/lib/studio/rbac-guard";
import { Badge, type BadgeTone } from "@/app/studio/_components/ui/Badge";

export const metadata = { title: "Calendario · Marketing · DTD Studio" };
export const dynamic = "force-dynamic";

const YEAR = 2026;

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

type Region = "VE" | "China";

type Event = {
  m: number; // 0-11
  date: string; // etiqueta corta "17 feb"
  title: string;
  region: Region;
  note: string; // por qué importa / idea de contenido
};

// Semilla curada 2026 — enfocada en lo que mueve contenido de importación.
const EVENTS: Event[] = [
  { m: 0, date: "1 ene", title: "Año Nuevo", region: "VE", note: "Arranque de año: metas de compra e inventario." },
  { m: 1, date: "16–17 feb", title: "Carnaval", region: "VE", note: "Temporada alta de consumo; disfraces y artículos de fiesta." },
  { m: 1, date: "17 feb", title: "Año Nuevo Chino", region: "China", note: "Fábricas cierran 2–4 semanas. Dolor clave: comprar ANTES o esperar. Speech de flujo de caja." },
  { m: 2, date: "8 mar", title: "Día de la Mujer", region: "VE", note: "Regalería y detalles: nicho de importación." },
  { m: 3, date: "2–3 abr", title: "Semana Santa", region: "VE", note: "Feriado largo; planificar contenido con antelación." },
  { m: 3, date: "15 abr", title: "Feria de Cantón (primavera)", region: "China", note: "Sourcing: nuevos productos y proveedores. Contenido de 'cómo comprar'." },
  { m: 4, date: "1 may", title: "Día del Trabajador", region: "VE", note: "Feriado; también cierre de fábricas en China (1–5 may)." },
  { m: 4, date: "10 may", title: "Día de las Madres", region: "VE", note: "Pico comercial fuerte: importar con tiempo. Historias de éxito." },
  { m: 5, date: "18 jun", title: "618 (mid-year sale)", region: "China", note: "Gran evento de compras; presión de fletes y precios." },
  { m: 5, date: "21 jun", title: "Día del Padre", region: "VE", note: "Pico comercial: electrónica y herramientas." },
  { m: 6, date: "5 jul", title: "Independencia", region: "VE", note: "Feriado nacional; contenido de marca país." },
  { m: 8, date: "25 sep", title: "Festival del Medio Otoño", region: "China", note: "Feriado; posibles retrasos de despacho." },
  { m: 9, date: "1–7 oct", title: "Semana Dorada (Día Nacional)", region: "China", note: "Cierre total de fábricas 1 semana. Comprar antes o asumir retraso." },
  { m: 9, date: "15 oct", title: "Feria de Cantón (otoño)", region: "China", note: "Sourcing de temporada navideña." },
  { m: 10, date: "11 nov", title: "Día del Soltero (11.11)", region: "China", note: "Mayor evento e-commerce del mundo: fletes disparados, planificar." },
  { m: 10, date: "27 nov", title: "Black Friday", region: "VE", note: "Pico de ventas; preparar inventario importado con meses de anticipación." },
  { m: 11, date: "todo dic", title: "Temporada decembrina", region: "VE", note: "Gaitas, hallacas, regalos: la mayor venta del año. Recepción de mercancía + storytelling de cajas." },
  { m: 11, date: "24–25 dic", title: "Navidad", region: "VE", note: "Cierre de campaña; agradecimiento y reseñas." },
];

const REGION_TONE: Record<Region, BadgeTone> = {
  VE: "info",
  China: "danger",
};

export default async function MarketingCalendarioPage() {
  await requireModuleView("marketing");

  return (
    <div style={{ maxWidth: 1280 }}>
      {/* Back link */}
      <div style={{ marginBottom: 20 }}>
        <Link
          href="/studio/marketing"
          style={{
            font: "600 13px/1 var(--f-sans)",
            color: "var(--ink-soft)",
            textDecoration: "none",
          }}
        >
          ← Marketing
        </Link>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div
          className="studio-eyebrow"
          style={{ marginBottom: 10, color: "var(--wine-text)" }}
        >
          Marketing · Calendario {YEAR}
        </div>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "0 0 var(--s-2)", color: "var(--ink)" }}
        >
          Calendario de contenido
        </h1>
        <p
          style={{
            font: "400 14px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "64ch",
          }}
        >
          Fechas clave de Venezuela y China para planificar el contenido del año.
          Las de China (cierres de fábrica) son las que mueven el argumento de
          compra internacional.
        </p>
      </div>

      {/* Aviso borrador + leyenda */}
      <div
        style={{
          border: "1px dashed var(--border)",
          borderRadius: 12,
          padding: "var(--s-3) var(--s-4)",
          background: "var(--bg-surface)",
          marginBottom: 28,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <p
          style={{
            font: "400 13px/1.5 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
          }}
        >
          Borrador — valídalo y complétalo con la Sra. Fátima. Después se
          sincroniza con Notion.
        </p>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Badge tone="info" size="sm">Venezuela</Badge>
          <Badge tone="danger" size="sm">China</Badge>
        </div>
      </div>

      {/* Meses con eventos */}
      {MONTHS.map((monthName, mIdx) => {
        const items = EVENTS.filter((e) => e.m === mIdx);
        if (items.length === 0) return null;
        return (
          <section key={monthName} style={{ marginBottom: 24 }}>
            <h2 className="studio-eyebrow" style={{ margin: "0 0 var(--s-3)" }}>
              {monthName}
            </h2>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                background: "var(--bg-surface)",
                overflow: "hidden",
              }}
            >
              {items.map((e, i) => (
                <div
                  key={`${e.title}-${e.date}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "88px 1fr",
                    gap: 14,
                    padding: "14px 18px",
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      font: "600 12px/1.3 var(--f-mono)",
                      color: "var(--ink)",
                      paddingTop: 2,
                    }}
                  >
                    {e.date}
                  </div>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          font: "700 14px/1.3 var(--f-sans)",
                          color: "var(--ink)",
                        }}
                      >
                        {e.title}
                      </span>
                      <Badge tone={REGION_TONE[e.region]} size="sm">
                        {e.region === "VE" ? "Venezuela" : "China"}
                      </Badge>
                    </div>
                    <p
                      style={{
                        font: "400 13px/1.5 var(--f-sans)",
                        color: "var(--ink-soft)",
                        margin: 0,
                        maxWidth: "72ch",
                      }}
                    >
                      {e.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
