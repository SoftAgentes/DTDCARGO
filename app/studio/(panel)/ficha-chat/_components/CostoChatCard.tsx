"use client";

/**
 * Costo de referencia del chat en la Ficha DTD (SDD-0585, paso 2.8).
 *
 * «N mensajes enviados × tarifa = US$X», con el mercado, la fecha y la fuente de la
 * tarifa. Es informativo y lo dice: no descuenta los 1.000 mensajes gratis del mes ni
 * distingue las plantillas. No muestra el teléfono: solo el mercado que sale de él.
 */

import { useId } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/format";
import { fechaCorta } from "@/lib/studio/client-account";
import type { CostoChat } from "@/lib/studio/chatwoot/costo-chat";

const TITULO = { font: "700 11px/1.2 var(--f-sans)", color: "var(--ink-soft)", margin: 0 } as const;
const CIFRA = { font: "700 15px/1.35 var(--f-sans)", color: "var(--ink)", margin: 0 } as const;
const NOTA = { font: "400 12px/1.45 var(--f-sans)", color: "var(--ink-soft)", margin: 0 } as const;

export function CostoChatCard({ costo }: { costo: CostoChat }) {
  const t = useT();
  const locale = useLocale();
  const titulo = useId();
  const usd = (n: number, decimales: number) =>
    `US$ ${formatNumber(n, locale, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`;
  return (
    <section aria-labelledby={titulo} style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)" }}>
      <p id={titulo} style={TITULO}>
        {t("bandeja.ficha.costo.title")}
      </p>
      <p style={CIFRA}>
        {t(costo.completo ? "bandeja.ficha.costo.linea" : "bandeja.ficha.costo.linea_piso", {
          n: formatNumber(costo.enviados, locale),
          tarifa: usd(costo.tarifa, 4),
          total: usd(costo.total, 2),
        })}
      </p>
      <p style={NOTA}>
        {t("bandeja.ficha.costo.fuente", { mercado: costo.mercado, fecha: fechaCorta(costo.vigenteDesde) })}{" "}
        <a href={costo.fuente} target="_blank" rel="noopener noreferrer" style={{ color: "var(--wine-text)" }}>
          {t("bandeja.ficha.costo.fuente_link")}
        </a>
      </p>
      <p style={NOTA}>{t("bandeja.ficha.costo.nota")}</p>
    </section>
  );
}
