/**
 * Almacén China · «En camino» (SDD-0682 §2.2). Server component.
 *
 * Los contenedores que ya zarparon («En el mar») y una fila por
 * contenedor (`FilaCamino`): número DTD, naviera, ETA, días que faltan y
 * porcentaje de avance; al abrirlo, sus recepciones con MARKBOX. Nunca el
 * nombre del importador.
 */

import { EmptyState } from "@/app/studio/_components/ui/EmptyState";
import { Aviso } from "@/app/studio/_components/ui/Aviso";
import { t, type Locale } from "@/lib/i18n";
import type { ContenedorEnCamino } from "@/lib/studio/almacen-cn-contenedores";
import { COLUMNAS_CAMINO } from "@/lib/studio/almacen-cn-vistas";
import { FilaCamino } from "./FilaCamino";

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
        <div role="table" aria-label={titulo} style={{ minWidth: 960 }}>
          <div
            role="row"
            style={{
              display: "grid",
              gridTemplateColumns: COLUMNAS_CAMINO,
              gap: "var(--s-3)",
              padding: "var(--s-2) var(--s-4)",
              font: "700 11px/1 var(--f-sans)",
              letterSpacing: ".05em",
              textTransform: "uppercase",
              color: "var(--ink-soft)",
            }}
          >
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_container")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_carrier")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_eta")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_days")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_progress")}</span>
            <span role="columnheader">{t(locale, "warehouse_cn.camino.col_load")}</span>
          </div>
          {lista.map((c) => (
            <FilaCamino key={c.id} c={c} />
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
    </>
  );
}
