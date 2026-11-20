/**
 * Encabezado de Almacén China (SDD-0016, SDD-0682): título, descripción y
 * acciones. Lo comparten las dos vistas («En almacén» y «En camino»).
 *
 * En «En camino» no hay recepciones que crear, así que solo queda el selector
 * de idioma.
 */

import { t, type Locale } from "@/lib/i18n";
import { HeaderActions } from "./HeaderActions";
import { LangToggle } from "./LangToggle";

export function EncabezadoCn({
  locale,
  conAcciones = true,
}: {
  locale: Locale;
  conAcciones?: boolean;
}) {
  // El sufijo 中国 va siempre como guiño visual del design canónico.
  const titlePrefix = t(locale, "warehouse_cn.page.title_prefix");
  const description = t(locale, "warehouse_cn.page.description_template", {
    hubs: t(locale, "warehouse_cn.page.hubs_label"),
  });

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: "var(--s-6)",
        marginBottom: "var(--s-4)",
        flexWrap: "wrap",
      }}
    >
      <div>
        <span className="studio-eyebrow">{t(locale, "warehouse_cn.page.eyebrow")}</span>
        <h1
          className="studio-display"
          style={{ fontSize: 30, margin: "var(--s-2) 0 var(--s-2)", color: "var(--ink)" }}
        >
          {titlePrefix} ·{" "}
          <span style={{ fontFamily: '"Noto Sans SC", var(--f-sans)', color: "var(--wine-text)" }}>
            中国
          </span>
        </h1>
        <p
          style={{
            font: "400 13px/1.4 var(--f-sans)",
            color: "var(--ink-soft)",
            margin: 0,
            maxWidth: "70ch",
          }}
        >
          {description}
        </p>
      </div>
      {conAcciones ? <HeaderActions /> : <LangToggle />}
    </div>
  );
}
